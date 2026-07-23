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
