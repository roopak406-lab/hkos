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
