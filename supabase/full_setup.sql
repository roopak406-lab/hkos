-- ================================================================
-- HKOS — COMPLETE DATABASE SETUP (run this whole file once)
-- Paste EVERYTHING below into the Supabase SQL Editor and Run.
-- ================================================================

-- ===== 1/4: migrations/0001_init.sql =====
-- ============================================================================
-- HKOS — Home Kitchen Operating System
-- Migration 0001: Core schema (multi-tenant)
-- ----------------------------------------------------------------------------
-- Design notes:
--   * Multi-tenant from day one. Every business row carries `kitchen_id`.
--     A single kitchen runs today; N kitchens run tomorrow with zero redesign.
--   * UUID primary keys everywhere.
--   * Soft delete via `deleted_at` (archive instead of destroy).
--   * Audit columns `created_at` / `updated_at` on every table (auto-maintained).
--   * Money stored as integer PAISE to avoid floating point drift
--     (₹169.00 == 16900). Helper views expose rupees for reporting.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy search on customers/products

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role       as enum ('owner', 'manager', 'staff');
create type menu_status      as enum ('draft', 'published', 'closed');
create type order_status     as enum ('new', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled');
create type payment_status   as enum ('pending', 'paid', 'failed', 'refunded');
create type payment_method   as enum ('upi', 'cash', 'other');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- TENANT: kitchens + staff
-- ===========================================================================
create table kitchens (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,                 -- public URL: /k/aromatic-tadka
  name                text not null,
  tagline             text,
  logo_url            text,
  hero_url            text,
  phone               text,
  whatsapp_number     text,
  address             text,
  upi_id              text,                                 -- e.g. aromatictadka@okhdfc
  upi_display_name    text,
  currency            text not null default 'INR',
  timezone            text not null default 'Asia/Kolkata',
  business_open       time not null default '08:00',
  business_close      time not null default '19:00',
  -- order cutoff for NEXT day, e.g. 18:00 previous day
  order_cutoff_time   time not null default '18:00',
  delivery_radius_note text,                                -- "Within Fortuna Krrish Apartment"
  -- White-label theming for the public page (HSL token overrides).
  theme               jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create trigger trg_kitchens_updated before update on kitchens
  for each row execute function set_updated_at();

-- Links a Supabase auth user to a kitchen with a role.
create table kitchen_users (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        user_role not null default 'owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (kitchen_id, user_id)
);
create index idx_kitchen_users_user on kitchen_users(user_id) where deleted_at is null;
create trigger trg_kitchen_users_updated before update on kitchen_users
  for each row execute function set_updated_at();

-- Helper used by RLS: kitchens the current auth user belongs to.
create or replace function current_kitchen_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select kitchen_id from kitchen_users
  where user_id = auth.uid() and deleted_at is null;
$$;

-- ===========================================================================
-- CATALOG: categories, delivery slots, products, variants
-- ===========================================================================
create table categories (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null,                    -- Breakfast, Lunch, Evening, Pickles
  slug        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (kitchen_id, slug)
);
create trigger trg_categories_updated before update on categories
  for each row execute function set_updated_at();

create table delivery_slots (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null,                    -- Breakfast, Lunch, Evening
  start_time  time not null,
  end_time    time not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create trigger trg_delivery_slots_updated before update on delivery_slots
  for each row execute function set_updated_at();

create table products (
  id                  uuid primary key default gen_random_uuid(),
  kitchen_id          uuid not null references kitchens(id) on delete cascade,
  category_id         uuid references categories(id) on delete set null,
  name                text not null,
  description         text,                       -- "2 Stuffed Paratha, 40ml Curd, 2 tsp Pickle"
  image_url           text,
  default_price_paise int not null default 0,     -- ₹ * 100
  -- Pickles etc. that are on the menu every day regardless of daily selection.
  is_always_available boolean not null default false,
  prep_notes          text,                       -- shown on the kitchen prep list
  packing_notes       text,                       -- shown on the packing list
  sort_order          int not null default 0,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index idx_products_kitchen on products(kitchen_id) where deleted_at is null;
create index idx_products_name_trgm on products using gin (name gin_trgm_ops);
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();

-- Product variants, e.g. Stuffed Paratha: Paneer / Aloo / Aloo-Onion / Gobi.
create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null,
  price_delta_paise int not null default 0,       -- +/- on top of the base price
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_variants_product on product_variants(product_id) where deleted_at is null;
create trigger trg_variants_updated before update on product_variants
  for each row execute function set_updated_at();

-- ===========================================================================
-- DAILY MENU: what is actually cooked on a given date ("Chef's menu of the day")
-- ===========================================================================
create table daily_menus (
  id           uuid primary key default gen_random_uuid(),
  kitchen_id   uuid not null references kitchens(id) on delete cascade,
  menu_date    date not null,
  status       menu_status not null default 'draft',
  notes        text,                              -- free note shown on customer page
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (kitchen_id, menu_date)
);
create index idx_daily_menus_date on daily_menus(kitchen_id, menu_date);
create trigger trg_daily_menus_updated before update on daily_menus
  for each row execute function set_updated_at();

create table daily_menu_items (
  id             uuid primary key default gen_random_uuid(),
  daily_menu_id  uuid not null references daily_menus(id) on delete cascade,
  product_id     uuid not null references products(id) on delete cascade,
  -- NULL => use product.default_price_paise. Otherwise a one-day override.
  price_override_paise int,
  is_available   boolean not null default true,
  -- Optional limited-batch cap. NULL = unlimited. Enables "no food waste".
  available_qty  int,
  sold_qty       int not null default 0,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (daily_menu_id, product_id)
);
create index idx_menu_items_menu on daily_menu_items(daily_menu_id);
create trigger trg_menu_items_updated before update on daily_menu_items
  for each row execute function set_updated_at();

-- ===========================================================================
-- CUSTOMERS
-- ===========================================================================
create table customers (
  id           uuid primary key default gen_random_uuid(),
  kitchen_id   uuid not null references kitchens(id) on delete cascade,
  name         text not null,
  phone        text not null,
  flat_number  text,
  tower        text,
  notes        text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (kitchen_id, phone)
);
create index idx_customers_kitchen on customers(kitchen_id) where deleted_at is null;
create index idx_customers_name_trgm on customers using gin (name gin_trgm_ops);
create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();

-- ===========================================================================
-- ORDERS
-- ===========================================================================
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  kitchen_id         uuid not null references kitchens(id) on delete cascade,
  -- Human-friendly per-kitchen sequence: ATK-1043. Set by trigger below.
  order_number       text,
  daily_menu_id      uuid references daily_menus(id) on delete set null,
  customer_id        uuid references customers(id) on delete set null,
  -- Snapshot of customer details at order time (public checkout, no login).
  customer_name      text not null,
  phone              text not null,
  flat_number        text,
  tower              text,
  delivery_slot_id   uuid references delivery_slots(id) on delete set null,
  delivery_date      date not null,
  status             order_status not null default 'new',
  payment_status     payment_status not null default 'pending',
  subtotal_paise     int not null default 0,
  discount_paise     int not null default 0,
  total_paise        int not null default 0,
  special_instructions text,
  placed_at          timestamptz not null default now(),
  accepted_at        timestamptz,
  ready_at           timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index idx_orders_kitchen_date on orders(kitchen_id, delivery_date);
create index idx_orders_status on orders(kitchen_id, status) where deleted_at is null;
create index idx_orders_customer on orders(customer_id);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  product_id     uuid references products(id) on delete set null,
  variant_id     uuid references product_variants(id) on delete set null,
  -- Snapshots so historic orders are immutable even if the product changes.
  product_name   text not null,
  variant_name   text,
  unit_price_paise int not null,
  quantity       int not null check (quantity > 0),
  line_total_paise int not null,
  special_instructions text,
  created_at     timestamptz not null default now()
);
create index idx_order_items_order on order_items(order_id);
create index idx_order_items_product on order_items(product_id);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  order_id    uuid not null references orders(id) on delete cascade,
  method      payment_method not null default 'upi',
  amount_paise int not null,
  status      payment_status not null default 'pending',
  reference   text,                              -- UPI txn ref / UTR
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_payments_order on payments(order_id);
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ===========================================================================
-- FINANCE: expenses
-- ===========================================================================
create table expense_categories (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references kitchens(id) on delete cascade,
  name        text not null,                     -- Groceries, Vegetables, Oil, Gas, Packaging, Misc
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (kitchen_id, name)
);
create trigger trg_expense_categories_updated before update on expense_categories
  for each row execute function set_updated_at();

create table expenses (
  id                  uuid primary key default gen_random_uuid(),
  kitchen_id          uuid not null references kitchens(id) on delete cascade,
  expense_category_id uuid references expense_categories(id) on delete set null,
  amount_paise        int not null,
  note                text,
  spent_on            date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index idx_expenses_kitchen_date on expenses(kitchen_id, spent_on) where deleted_at is null;
create trigger trg_expenses_updated before update on expenses
  for each row execute function set_updated_at();

-- ===========================================================================
-- FUNCTIONS: order numbering
-- ===========================================================================
-- Per-kitchen incrementing order number, prefixed with an uppercase code
-- derived from the kitchen slug. Runs BEFORE INSERT on orders.
create or replace function assign_order_number()
returns trigger language plpgsql as $$
declare
  seq_count int;
  prefix    text;
begin
  select upper(regexp_replace(coalesce(k.slug, 'ord'), '[^a-zA-Z]', '', 'g'))
    into prefix
  from kitchens k where k.id = new.kitchen_id;
  prefix := coalesce(nullif(left(prefix, 3), ''), 'ORD');

  select count(*) + 1001 into seq_count
  from orders where kitchen_id = new.kitchen_id;

  new.order_number := prefix || '-' || seq_count::text;
  return new;
end;
$$;
create trigger trg_orders_number before insert on orders
  for each row when (new.order_number is null)
  execute function assign_order_number();

-- ===== 2/4: migrations/0002_rls.sql =====
-- ============================================================================
-- HKOS — Migration 0002: Row-Level Security
-- ----------------------------------------------------------------------------
-- Access model:
--   * PUBLIC (anon) may READ active kitchens and their PUBLISHED menus +
--     catalog (so the customer page works with no login).
--   * Order placement is done server-side with the service-role key (a Next.js
--     route handler), which validates the cart and bypasses RLS — so there is
--     deliberately NO broad anon INSERT policy on orders.
--   * KITCHEN STAFF (authenticated members) get full access to THEIR kitchen's
--     rows only, scoped by current_kitchen_ids().
-- ============================================================================

alter table kitchens            enable row level security;
alter table kitchen_users       enable row level security;
alter table categories          enable row level security;
alter table delivery_slots      enable row level security;
alter table products            enable row level security;
alter table product_variants    enable row level security;
alter table daily_menus         enable row level security;
alter table daily_menu_items    enable row level security;
alter table customers           enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table payments            enable row level security;
alter table expense_categories  enable row level security;
alter table expenses            enable row level security;

-- ---------------------------------------------------------------------------
-- PUBLIC READ (anon + authenticated)
-- ---------------------------------------------------------------------------
create policy "public reads active kitchens"
  on kitchens for select using (is_active and deleted_at is null);

create policy "public reads categories"
  on categories for select using (deleted_at is null);

create policy "public reads active delivery slots"
  on delivery_slots for select using (is_active and deleted_at is null);

create policy "public reads non-archived products"
  on products for select using (is_archived = false and deleted_at is null);

create policy "public reads variants"
  on product_variants for select using (deleted_at is null);

create policy "public reads published menus"
  on daily_menus for select using (status = 'published' and deleted_at is null);

create policy "public reads items of published menus"
  on daily_menu_items for select using (
    exists (
      select 1 from daily_menus m
      where m.id = daily_menu_items.daily_menu_id
        and m.status = 'published' and m.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- STAFF FULL ACCESS (authenticated members of the kitchen)
-- A single ALL policy per table keeps it simple and auditable.
-- ---------------------------------------------------------------------------
create policy "staff manage their kitchen"
  on kitchens for all
  using (id in (select current_kitchen_ids()))
  with check (id in (select current_kitchen_ids()));

create policy "staff read their membership"
  on kitchen_users for select
  using (kitchen_id in (select current_kitchen_ids()));

-- Macro-like block: same shape for every kitchen-scoped table.
create policy "staff manage categories"
  on categories for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage delivery_slots"
  on delivery_slots for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage products"
  on products for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage variants"
  on product_variants for all
  using (exists (
    select 1 from products p
    where p.id = product_variants.product_id
      and p.kitchen_id in (select current_kitchen_ids())
  ))
  with check (exists (
    select 1 from products p
    where p.id = product_variants.product_id
      and p.kitchen_id in (select current_kitchen_ids())
  ));

create policy "staff manage daily_menus"
  on daily_menus for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage daily_menu_items"
  on daily_menu_items for all
  using (exists (
    select 1 from daily_menus m
    where m.id = daily_menu_items.daily_menu_id
      and m.kitchen_id in (select current_kitchen_ids())
  ))
  with check (exists (
    select 1 from daily_menus m
    where m.id = daily_menu_items.daily_menu_id
      and m.kitchen_id in (select current_kitchen_ids())
  ));

create policy "staff manage customers"
  on customers for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage orders"
  on orders for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage order_items"
  on order_items for all
  using (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.kitchen_id in (select current_kitchen_ids())
  ))
  with check (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and o.kitchen_id in (select current_kitchen_ids())
  ));

create policy "staff manage payments"
  on payments for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage expense_categories"
  on expense_categories for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

create policy "staff manage expenses"
  on expenses for all
  using (kitchen_id in (select current_kitchen_ids()))
  with check (kitchen_id in (select current_kitchen_ids()));

-- ===== 3/4: migrations/0003_functions_views.sql =====
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

-- ===== 4/4: seed.sql =====
-- ============================================================================
-- HKOS — Seed data for the pilot kitchen: Aromatic Tadka Kitchen
-- Idempotent: safe to re-run (uses stable slugs / on conflict).
-- Prices are in PAISE (₹169 => 16900).
-- ----------------------------------------------------------------------------
-- After running this, link the owner login:
--   1) Create a user in Supabase Auth (e.g. owner@aromatictadka.in).
--   2) INSERT into kitchen_users (see the commented block at the bottom).
-- ============================================================================

-- ---- Kitchen ---------------------------------------------------------------
insert into kitchens (slug, name, tagline, phone, whatsapp_number, address,
  upi_id, upi_display_name, business_open, business_close, order_cutoff_time,
  delivery_radius_note, hero_url, logo_url)
values (
  'aromatic-tadka', 'Aromatic Tadka Kitchen',
  'Authentic Flavours. Purely Homemade.',
  '+91 90000 00000', '+91 90000 00000', 'Fortuna Krrish Apartment',
  'aromatictadka@okhdfc', 'Aromatic Tadka Kitchen',
  '08:00', '19:00', '18:00',
  'Currently delivering within Fortuna Krrish Apartment',
  'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1200&q=80',
  '/brand/logo.png'
)
on conflict (slug) do update set
  tagline = excluded.tagline, logo_url = excluded.logo_url, updated_at = now();

-- Capture the kitchen id for the rest of the seed.
do $$
declare k uuid;
declare c_breakfast uuid; declare c_lunch uuid; declare c_evening uuid; declare c_pickles uuid;
declare p uuid;
begin
  select id into k from kitchens where slug = 'aromatic-tadka';

  -- ---- Categories ----------------------------------------------------------
  insert into categories (kitchen_id, name, slug, sort_order) values
    (k,'Breakfast','breakfast',1),(k,'Lunch','lunch',2),
    (k,'Evening','evening',3),(k,'Pickles','pickles',4)
  on conflict (kitchen_id, slug) do nothing;

  select id into c_breakfast from categories where kitchen_id=k and slug='breakfast';
  select id into c_lunch     from categories where kitchen_id=k and slug='lunch';
  select id into c_evening   from categories where kitchen_id=k and slug='evening';
  select id into c_pickles   from categories where kitchen_id=k and slug='pickles';

  -- ---- Delivery slots ------------------------------------------------------
  insert into delivery_slots (kitchen_id, name, start_time, end_time, sort_order) values
    (k,'Breakfast','08:30','10:30',1),
    (k,'Lunch','12:30','14:00',2),
    (k,'Evening','17:30','19:30',3)
  on conflict do nothing;

  -- ---- Expense categories --------------------------------------------------
  insert into expense_categories (kitchen_id, name, sort_order) values
    (k,'Groceries',1),(k,'Vegetables',2),(k,'Oil',3),
    (k,'Gas',4),(k,'Packaging',5),(k,'Miscellaneous',6)
  on conflict (kitchen_id, name) do nothing;

  -- Helper note: only insert products if none exist yet for this kitchen.
  if not exists (select 1 from products where kitchen_id = k) then

    -- ===== BREAKFAST ========================================================
    insert into products (kitchen_id, category_id, name, description, default_price_paise, sort_order)
    values (k, c_breakfast, 'Stuffed Paratha Meal',
      '2 Stuffed Paratha, 40 ml Curd, 2 tsp Homemade Pickle', 16900, 1)
    returning id into p;
    insert into product_variants (product_id, name, is_default, sort_order) values
      (p,'Paneer',true,1),(p,'Aloo',false,2),(p,'Aloo Onion',false,3),(p,'Gobi',false,4);

    insert into products (kitchen_id, category_id, name, description, default_price_paise, sort_order) values
      (k, c_breakfast, 'Puri & Aloo Sabji', 'Fluffy puris with masala aloo sabji', 12900, 2),
      (k, c_breakfast, 'Puri & Chole', 'Puris served with home-style chole', 13900, 3),
      (k, c_breakfast, 'Chole Bhature', 'Bhature with rich chole', 14900, 4),
      (k, c_breakfast, 'Plain Paratha + Aloo Sabji', '2 plain parathas with aloo sabji', 11900, 5);

    -- ===== LUNCH ============================================================
    insert into products (kitchen_id, category_id, name, description, default_price_paise, sort_order) values
      (k, c_lunch, 'Chicken Curry', '400 ml bowl, home-style chicken curry', 22900, 1),
      (k, c_lunch, 'Egg Curry', 'Home-style egg curry', 15900, 2),
      (k, c_lunch, 'Paneer Butter Masala', 'Rich, creamy paneer butter masala', 18900, 3),
      (k, c_lunch, 'Soya Aloo Sabji', 'Protein-rich soya with aloo', 13900, 4),
      (k, c_lunch, 'Mushroom Masala', 'Button mushrooms in onion-tomato masala', 17900, 5);

    -- ===== EVENING ==========================================================
    insert into products (kitchen_id, category_id, name, description, default_price_paise, sort_order) values
      (k, c_evening, 'Veg Pasta', 'Creamy/red-sauce veg pasta', 14900, 1),
      (k, c_evening, 'Paneer Sourdough Toast', 'Sourdough toast topped with spiced paneer', 15900, 2),
      (k, c_evening, 'Mushroom Sourdough Toast', 'Sourdough toast topped with garlic mushrooms', 15900, 3),
      (k, c_evening, 'Dahi Bara', 'Soft lentil dumplings in whipped curd', 11900, 4);

    -- ===== PICKLES (always available) =======================================
    insert into products (kitchen_id, category_id, name, description, default_price_paise, is_always_available, sort_order) values
      (k, c_pickles, 'Special Chilli Pickle', 'Homemade fiery chilli pickle (jar)', 9900, true, 1),
      (k, c_pickles, 'Sweet Shredded Mango Pickle', 'Sweet shredded mango pickle (jar)', 9900, true, 2);
  end if;

  -- ---- A published menu for TOMORROW so the demo works immediately --------
  declare v_menu uuid; declare v_tomorrow date := current_date + 1;
  begin
    insert into daily_menus (kitchen_id, menu_date, status, published_at, notes)
    values (k, v_tomorrow, 'published', now(), 'Freshly prepared, limited batch.')
    on conflict (kitchen_id, menu_date) do update set status='published', published_at=now()
    returning id into v_menu;

    -- Put a curated selection on tomorrow's menu.
    insert into daily_menu_items (daily_menu_id, product_id, available_qty, sort_order)
    select v_menu, pr.id, 20, pr.sort_order
    from products pr
    where pr.kitchen_id = k
      and pr.name in ('Stuffed Paratha Meal','Chicken Curry','Paneer Butter Masala',
                      'Veg Pasta','Special Chilli Pickle','Sweet Shredded Mango Pickle')
    on conflict (daily_menu_id, product_id) do nothing;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Link the owner login (run AFTER creating the auth user):
-- ---------------------------------------------------------------------------
-- insert into kitchen_users (kitchen_id, user_id, role)
-- select k.id, u.id, 'owner'
-- from kitchens k, auth.users u
-- where k.slug = 'aromatic-tadka' and u.email = 'owner@aromatictadka.in'
-- on conflict (kitchen_id, user_id) do nothing;
