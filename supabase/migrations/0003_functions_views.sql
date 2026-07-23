-- ============================================================================
-- HKOS — Migration 0003: Reporting views + transactional RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- VIEW: resolved menu items (price resolved, qty remaining) — used by the
-- customer page and kitchen prep list.
-- ---------------------------------------------------------------------------
create or replace view v_daily_menu_resolved
with (security_invoker = true) as
select
  dmi.id                as menu_item_id,
  dm.id                 as daily_menu_id,
  dm.kitchen_id,
  dm.menu_date,
  dm.status             as menu_status,
  p.id                  as product_id,
  p.name                as product_name,
  p.description,
  p.image_url,
  c.name                as category_name,
  c.slug                as category_slug,
  c.sort_order          as category_sort,
  coalesce(dmi.price_override_paise, p.default_price_paise) as price_paise,
  dmi.is_available,
  dmi.available_qty,
  dmi.sold_qty,
  case
    when dmi.available_qty is null then null
    else greatest(dmi.available_qty - dmi.sold_qty, 0)
  end                   as qty_remaining,
  dmi.sort_order
from daily_menu_items dmi
join daily_menus dm on dm.id = dmi.daily_menu_id
join products p     on p.id = dmi.product_id
left join categories c on c.id = p.category_id;

-- ---------------------------------------------------------------------------
-- RPC: place_order — atomic public checkout (called server-side with service
-- role). Recomputes every price from the DB so the client cannot tamper with
-- amounts, enforces limited-batch caps, upserts the customer, and returns the
-- created order id + number.
--   p_items: jsonb array of { product_id, variant_id, quantity, note }
-- ---------------------------------------------------------------------------
create or replace function place_order(
  p_kitchen_id   uuid,
  p_customer     jsonb,      -- { name, phone, flat_number, tower }
  p_delivery_date date,
  p_delivery_slot_id uuid,
  p_items        jsonb,
  p_special_instructions text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_menu        daily_menus%rowtype;
  v_order_id    uuid;
  v_order_number text;
  v_customer_id uuid;
  v_item        jsonb;
  v_product     products%rowtype;
  v_variant     product_variants%rowtype;
  v_menu_item   daily_menu_items%rowtype;
  v_unit_paise  int;
  v_qty         int;
  v_subtotal    int := 0;
  v_line_total  int;
  v_variant_name text;
begin
  -- Resolve the published menu for the delivery date.
  select * into v_menu from daily_menus
   where kitchen_id = p_kitchen_id and menu_date = p_delivery_date
     and status = 'published' and deleted_at is null;
  if not found then
    raise exception 'No published menu for % on %', p_kitchen_id, p_delivery_date
      using errcode = 'P0001';
  end if;

  -- Upsert customer by phone (soft identity — no login).
  insert into customers (kitchen_id, name, phone, flat_number, tower)
  values (
    p_kitchen_id,
    p_customer->>'name',
    p_customer->>'phone',
    nullif(p_customer->>'flat_number',''),
    nullif(p_customer->>'tower','')
  )
  on conflict (kitchen_id, phone)
  do update set name = excluded.name,
                flat_number = coalesce(excluded.flat_number, customers.flat_number),
                tower = coalesce(excluded.tower, customers.tower)
  returning id into v_customer_id;

  -- Create the order shell (totals filled in after items).
  insert into orders (
    kitchen_id, daily_menu_id, customer_id, customer_name, phone,
    flat_number, tower, delivery_slot_id, delivery_date, special_instructions
  ) values (
    p_kitchen_id, v_menu.id, v_customer_id,
    p_customer->>'name', p_customer->>'phone',
    nullif(p_customer->>'flat_number',''), nullif(p_customer->>'tower',''),
    p_delivery_slot_id, p_delivery_date, p_special_instructions
  ) returning id, order_number into v_order_id, v_order_number;

  -- Line items.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest((v_item->>'quantity')::int, 1);

    select * into v_product from products
      where id = (v_item->>'product_id')::uuid and kitchen_id = p_kitchen_id;
    if not found then
      raise exception 'Product % not in kitchen', v_item->>'product_id';
    end if;

    -- Menu item drives price + batch cap.
    select * into v_menu_item from daily_menu_items
      where daily_menu_id = v_menu.id and product_id = v_product.id;
    if not found or not v_menu_item.is_available then
      raise exception 'Product % is not on today''s menu', v_product.name;
    end if;

    v_unit_paise := coalesce(v_menu_item.price_override_paise, v_product.default_price_paise);
    v_variant_name := null;
    if (v_item->>'variant_id') is not null then
      select * into v_variant from product_variants
        where id = (v_item->>'variant_id')::uuid and product_id = v_product.id;
      if found then
        v_unit_paise := v_unit_paise + v_variant.price_delta_paise;
        v_variant_name := v_variant.name;
      end if;
    end if;

    -- Enforce limited batch (no food waste).
    if v_menu_item.available_qty is not null
       and v_menu_item.sold_qty + v_qty > v_menu_item.available_qty then
      raise exception 'Only % of % left', v_menu_item.available_qty - v_menu_item.sold_qty, v_product.name
        using errcode = 'P0002';
    end if;

    v_line_total := v_unit_paise * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    insert into order_items (
      order_id, product_id, variant_id, product_name, variant_name,
      unit_price_paise, quantity, line_total_paise, special_instructions
    ) values (
      v_order_id, v_product.id, (v_item->>'variant_id')::uuid, v_product.name,
      v_variant_name, v_unit_paise, v_qty, v_line_total, nullif(v_item->>'note','')
    );

    update daily_menu_items set sold_qty = sold_qty + v_qty where id = v_menu_item.id;
  end loop;

  update orders
     set subtotal_paise = v_subtotal, total_paise = v_subtotal
   where id = v_order_id;

  -- Pending UPI payment record.
  insert into payments (kitchen_id, order_id, method, amount_paise, status)
  values (p_kitchen_id, v_order_id, 'upi', v_subtotal, 'pending');

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_paise', v_subtotal
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: business_dashboard — headline numbers for a given date.
-- ---------------------------------------------------------------------------
create or replace function business_dashboard(p_kitchen_id uuid, p_date date default current_date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with day_orders as (
    select * from orders
    where kitchen_id = p_kitchen_id and delivery_date = p_date
      and deleted_at is null and status <> 'cancelled'
  ),
  month_orders as (
    select * from orders
    where kitchen_id = p_kitchen_id
      and date_trunc('month', delivery_date) = date_trunc('month', p_date)
      and deleted_at is null and status <> 'cancelled'
  ),
  day_expense as (
    select coalesce(sum(amount_paise),0) e from expenses
    where kitchen_id = p_kitchen_id and spent_on = p_date and deleted_at is null
  ),
  best as (
    select oi.product_name, sum(oi.quantity) qty
    from order_items oi join day_orders o on o.id = oi.order_id
    group by oi.product_name order by qty desc limit 1
  ),
  repeat_cust as (
    select count(*) c from (
      select customer_id from orders
      where kitchen_id = p_kitchen_id and deleted_at is null and customer_id is not null
      group by customer_id having count(*) > 1
    ) t
  )
  select jsonb_build_object(
    'date', p_date,
    'orders_today', (select count(*) from day_orders),
    'pending_orders', (select count(*) from day_orders where status = 'new'),
    'preparing', (select count(*) from day_orders where status = 'preparing'),
    'delivered', (select count(*) from day_orders where status = 'delivered'),
    'revenue_today_paise', (select coalesce(sum(total_paise),0) from day_orders),
    'expenses_today_paise', (select e from day_expense),
    'profit_today_paise', (select coalesce(sum(total_paise),0) from day_orders) - (select e from day_expense),
    'revenue_month_paise', (select coalesce(sum(total_paise),0) from month_orders),
    'avg_order_value_paise', (select coalesce(round(avg(total_paise)),0) from day_orders),
    'best_selling', (select product_name from best),
    'repeat_customers', (select c from repeat_cust)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: finance_summary — revenue / expense / profit over a range, grouped.
-- ---------------------------------------------------------------------------
create or replace function finance_summary(p_kitchen_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'revenue_paise', (
      select coalesce(sum(total_paise),0) from orders
      where kitchen_id = p_kitchen_id and delivery_date between p_from and p_to
        and status <> 'cancelled' and deleted_at is null),
    'expenses_paise', (
      select coalesce(sum(amount_paise),0) from expenses
      where kitchen_id = p_kitchen_id and spent_on between p_from and p_to and deleted_at is null),
    'by_expense_category', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select ec.name, coalesce(sum(e.amount_paise),0) as amount_paise
        from expense_categories ec
        left join expenses e on e.expense_category_id = ec.id
          and e.spent_on between p_from and p_to and e.deleted_at is null
        where ec.kitchen_id = p_kitchen_id
        group by ec.name order by amount_paise desc
      ) t),
    'daily', (
      select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) from (
        select gs::date as day,
          (select coalesce(sum(total_paise),0) from orders o
             where o.kitchen_id = p_kitchen_id and o.delivery_date = gs::date
               and o.status <> 'cancelled' and o.deleted_at is null) as revenue_paise,
          (select coalesce(sum(amount_paise),0) from expenses e
             where e.kitchen_id = p_kitchen_id and e.spent_on = gs::date and e.deleted_at is null) as expense_paise
        from generate_series(p_from, p_to, interval '1 day') gs
      ) d)
  );
$$;
