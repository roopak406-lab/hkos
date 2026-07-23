# HKOS — Home Kitchen Operating System

> The operating system for home kitchens. Publish tomorrow’s menu, take orders,
> auto-generate your kitchen prep list, and track every rupee — in under 5
> minutes a day.

**Pilot customer:** Aromatic Tadka Kitchen — _Authentic Flavours. Purely Homemade._

HKOS is **not** a restaurant POS, a Swiggy clone, or a Shopify store. It is
purpose-built for the **Chef’s-Menu-of-the-Day** model: a small, freshly-cooked,
limited-batch menu published one day ahead, ordered by a tight community of
repeat customers, with zero food waste.

Built multi-tenant from day one — one kitchen today, hundreds tomorrow, with no
re-architecture.

---

## ✨ What it does (7 modules)

| # | Module | What the owner gets |
|---|--------|---------------------|
| 1 | **Menu management** | Product library, variants, daily availability, one-tap publish, auto WhatsApp message |
| 2 | **Customer ordering** | Public, no-login, mobile-first storefront at `/k/<slug>` with UPI checkout |
| 3 | **Order management** | Live board: New → Accepted → Preparing → Ready → Delivered, search & filters |
| 4 | **Kitchen dashboard** | Auto-generated preparation list + packing list + production counts |
| 5 | **Finance** | Revenue, expenses (6 categories), profit — daily / monthly, with charts |
| 6 | **Customer book** | Repeat customers, order history, favourite items, notes |
| 7 | **Business dashboard** | Today’s revenue/orders/profit, best-seller, AOV, repeat customers |

---

## 🧱 Tech stack

- **Next.js 15** (App Router, RSC, Server Actions) · **React 19** · **TypeScript**
- **Tailwind CSS** + **shadcn/ui**-style primitives · **Recharts**
- **React Hook Form** + **Zod** · **Zustand** (cart)
- **Supabase**: PostgreSQL · Auth · Storage · Row-Level Security
- **PWA** (installable, offline-aware manifest) · deploys to **Vercel**

---

## 🚀 Quick start

### 1. Prerequisites
- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from **Supabase → Settings → API**.

### 4. Set up the database
In the **Supabase SQL Editor**, run the files in order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_functions_views.sql`
4. `supabase/seed.sql`

(Or use the Supabase CLI — see `docs/DEPLOYMENT.md`.)

### 5. Create the owner login
- Supabase → **Authentication → Users → Add user** (email + password).
- Uncomment and run the final block of `supabase/seed.sql` to link that user to
  Aromatic Tadka Kitchen as `owner`.

### 6. Run
```bash
npm run dev
```
- **Public ordering page (share this):** <http://localhost:5210/order>
- Owner dashboard: <http://localhost:5210/admin>
- Multi-tenant storefront (same page, per-kitchen): <http://localhost:5210/k/aromatic-tadka>

The seed publishes a menu for **tomorrow**, so ordering works immediately (until
the 6:00 PM cut-off, evaluated in `Asia/Kolkata`).

### The customer ordering flow (`/order`)
`/order` is the clean, no-login, WhatsApp-shareable link. Customers see the
published menu → add items → checkout (name, mobile, flat, slot) → get an order
number + **UPI QR** (amount pre-filled) → optionally send the payment reference
to the kitchen on WhatsApp. Orders appear instantly in `/admin/orders`, and
customers are matched/created by normalized mobile number in the Customer Book.
Admins generate the share message via **Menu → Copy WhatsApp message** (it embeds
the `/order` link). See [docs/IMPLEMENTATION_NOTE.md](docs/IMPLEMENTATION_NOTE.md)
for the full audit and design decisions.

---

## 📁 Project structure

```
hkos/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 # Landing
│  │  ├─ login/ · onboarding/     # Auth
│  │  ├─ k/[slug]/                # PUBLIC storefront (menu, checkout, success)
│  │  ├─ admin/                   # Owner app (dashboard, menu, orders, kitchen, finance, customers)
│  │  │  └─ actions.ts            # Server actions (all admin mutations)
│  │  └─ api/orders/route.ts      # Public order-placement endpoint (service role)
│  ├─ components/
│  │  ├─ ui/                      # shadcn-style primitives
│  │  ├─ customer/                # Storefront components
│  │  └─ admin/                   # Dashboard components
│  ├─ lib/
│  │  ├─ supabase/                # client / server / admin clients
│  │  ├─ database.types.ts        # Typed schema
│  │  ├─ money.ts · format.ts · validators.ts · auth.ts · env.ts
│  └─ stores/cart.ts              # Zustand cart (persisted)
├─ supabase/
│  ├─ migrations/                 # 0001 schema · 0002 RLS · 0003 functions/views
│  └─ seed.sql                    # Aromatic Tadka seed + tomorrow's menu
└─ docs/                          # Deployment, testing, admin & customer manuals, ER diagram, API
```

---

## 🏗️ Architecture highlights

- **Multi-tenant**: every business row carries `kitchen_id`; RLS scopes all
  access to the signed-in user’s kitchen(s). Adding a kitchen = a new row.
- **Money as integer paise** everywhere — no floating-point drift.
- **Tamper-proof checkout**: the browser never sets prices. The public
  `POST /api/orders` route calls the `place_order` Postgres function (service
  role) which recomputes every price from the DB, enforces limited-batch caps,
  and writes the order atomically.
- **Soft delete + audit columns** (`created_at` / `updated_at` / `deleted_at`)
  on every table.
- **Themeable**: all colours are CSS variables → white-label per kitchen.

See [`docs/`](./docs) for the full ER diagram, API reference, deployment and
manuals.

---

## 📜 Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on :5210 |
| `npm run build` / `start` | Production build & serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next/ESLint |
| `npm run db:types` | Regenerate `database.types.ts` from Supabase |

---

## 🗺️ Roadmap

- Realtime order board (Supabase Realtime)
- WhatsApp Business API auto-send
- Razorpay/UPI intent deep-links + payment webhooks
- Self-serve kitchen sign-up (onboarding flow)
- Delivery-partner assignment & routes

_Built to become a commercial Home Kitchen Operating System._
