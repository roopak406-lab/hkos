-- ============================================================================
-- HKOS — Migration 0004: Admin control features
--   * Ordering override (keep open / force closed / auto by cut-off)
--   * Editable UPI QR image + owner notification email
--   * Customer reviews & ratings
--   * Storage bucket for kitchen assets (UPI QR uploads)
--   * Realtime on orders (in-app new-order alerts)
-- Safe to run once on an existing database (idempotent guards throughout).
-- ============================================================================

-- ---- Kitchen: new configurable fields --------------------------------------
alter table kitchens
  add column if not exists ordering_status text not null default 'auto'
    check (ordering_status in ('auto', 'open', 'closed')),
  add column if not exists upi_qr_url text,
  add column if not exists notification_email text;

comment on column kitchens.ordering_status is
  'auto = follow cut-off time; open = always accept; closed = stop accepting';

-- ---- Reviews ----------------------------------------------------------------
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  kitchen_id    uuid not null references kitchens(id) on delete cascade,
  order_id      uuid references orders(id) on delete set null,
  customer_id   uuid references customers(id) on delete set null,
  customer_name text,
  rating        int not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_reviews_kitchen on reviews(kitchen_id, created_at desc);

alter table reviews enable row level security;

-- Staff read their kitchen's reviews. Public reviews are inserted server-side
-- (service role) after validating the order, so no anon insert policy is added.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'reviews'
                 and policyname = 'staff read reviews') then
    create policy "staff read reviews" on reviews for select
      using (kitchen_id in (select current_kitchen_ids()));
  end if;
end $$;

-- ---- Storage bucket for kitchen assets (UPI QR, etc.) ----------------------
insert into storage.buckets (id, name, public)
values ('kitchen-assets', 'kitchen-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage'
                 and tablename = 'objects' and policyname = 'kitchen-assets public read') then
    create policy "kitchen-assets public read" on storage.objects
      for select using (bucket_id = 'kitchen-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage'
                 and tablename = 'objects' and policyname = 'kitchen-assets auth write') then
    create policy "kitchen-assets auth write" on storage.objects
      for insert to authenticated with check (bucket_id = 'kitchen-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage'
                 and tablename = 'objects' and policyname = 'kitchen-assets auth update') then
    create policy "kitchen-assets auth update" on storage.objects
      for update to authenticated using (bucket_id = 'kitchen-assets');
  end if;
end $$;

-- ---- Realtime: emit changes on orders (in-app alerts) ----------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
