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
