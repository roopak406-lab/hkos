# HKOS — Deployment Guide

## Overview
- **Frontend/API**: Next.js 15 on **Vercel**
- **Backend**: **Supabase** (Postgres + Auth + Storage)

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions_views.sql`
   - `supabase/seed.sql`
3. **Storage** → create a public bucket `menu-images` for food photography
   (product `image_url` values can point at it or any HTTPS image).
4. **Authentication → Providers** → keep Email enabled. For the pilot, disable
   public sign-ups (owner accounts are provisioned manually).
5. **Authentication → Users** → add the owner (email + password), then run the
   commented link block at the bottom of `seed.sql`.
6. **Settings → API** → copy the Project URL, `anon` key, and `service_role` key.

### Using the Supabase CLI (optional)
```bash
supabase link --project-ref <ref>
supabase db push          # applies migrations/
supabase db execute -f supabase/seed.sql
```

---

## 2. Vercel deployment

1. Push this repo to GitHub.
2. **Vercel → New Project → Import** the repo (framework auto-detected as Next.js).
3. Add environment variables (Production **and** Preview):

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` |

4. **Deploy.** The build runs `next build`.
5. Add your custom domain under **Vercel → Settings → Domains**.

### Customer link + custom domain
- Default (works immediately): `https://<project>.vercel.app/order`
- Custom subdomain (recommended to share): **`https://order.aromatictadkakitchen.in`**

To set up the subdomain:
1. **Vercel → Settings → Domains → Add** `order.aromatictadkakitchen.in`.
2. At your DNS provider, add the record Vercel shows — typically a **CNAME**
   `order` → `cname.vercel-dns.com` (Vercel verifies + issues HTTPS automatically).
3. The app already handles this host: **any host starting with `order.` redirects
   its root `/` straight to the ordering page** (`src/middleware.ts`), so
   `https://order.aromatictadkakitchen.in` shows the menu directly — no `/order`
   needed. Add other customer hosts via `NEXT_PUBLIC_CUSTOMER_HOSTS` if required.
4. Set `NEXT_PUBLIC_SITE_URL=https://order.aromatictadkakitchen.in` in Vercel.

> The admin dashboard stays at `…/admin` on the same domain. The WhatsApp share
> message auto-uses whichever domain the admin has open (it reads the live
> origin), so it will emit the custom-domain link once you're on it.

> ⚠️ Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. It is only read in
> server code (`src/lib/supabase/admin.ts`, used by `/api/orders`).

---

## 3. Post-deploy checklist
- [ ] Storefront loads at `/k/aromatic-tadka` and shows tomorrow’s menu.
- [ ] A test order places successfully and appears in `/admin/orders`.
- [ ] Owner can sign in at `/login` and reach `/admin`.
- [ ] PWA installs (Chrome → “Install app”). Add real icons at
      `public/icons/icon-192.png` and `icon-512.png`.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the deployed domain (used in WhatsApp links).

---

## 4. Going multi-tenant (future)
No schema change needed. To onboard a second kitchen:
1. `INSERT` a row into `kitchens` (unique `slug`).
2. Seed its categories, delivery slots, expense categories, products.
3. Create its owner in Auth and link via `kitchen_users`.
4. It is immediately live at `/k/<new-slug>` and `/admin` (scoped by RLS).
