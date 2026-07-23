# Implementation Note — Public Ordering Workflow

Audit of the existing HKOS codebase and the scoped additions made to deliver the
public customer ordering workflow (the "replace the Google Sheet" objective).

## 1. What already exists (audited, preserved)

| Area | Status | Location |
|------|--------|----------|
| Framework | Next.js 15.1.4 (App Router, RSC, Server Actions), React 19, TypeScript | — |
| DB | Supabase Postgres, 14 tables, UUIDs, soft-delete, audit cols | `supabase/migrations/0001–0003` |
| Auth | Supabase Auth (owner/staff), middleware guards `/admin` | `src/middleware.ts`, `src/lib/auth.ts` |
| Menu management + publish | ✅ Full, with WhatsApp message generator | `src/app/admin/menu`, `menu-planner.tsx` |
| **Public storefront** | ✅ Existed at `/k/[slug]` (no login, mobile-first) | `src/app/k/[slug]` |
| **Cart** | ✅ Zustand, persisted, batch-cap aware | `src/stores/cart.ts` |
| **Checkout** | ✅ RHF + Zod, Indian mobile validation | `checkout-client.tsx` |
| **Order creation** | ✅ `place_order` RPC — server-side price recompute, atomic, repeat-customer upsert by phone, limited-batch enforcement | `0003_functions_views.sql`, `/api/orders` |
| Repeat customer | ✅ Upsert by `(kitchen_id, phone)` in `place_order` | RPC |
| Admin Orders / Customers / Dashboard | ✅ New orders appear immediately | `src/app/admin/*` |
| RLS | ✅ Public reads only published menus/catalog; cannot read orders/customers; order placement via service-role route only | `0002_rls.sql` |
| Prices | ✅ Never trusted from browser; recomputed in DB | RPC |
| Design system | Green + gold brand tokens (CSS variables), shadcn-style primitives | `globals.css` |

**Conclusion:** the ordering workflow was ~90% already built. This task did NOT
rebuild it — it added the specific pieces the spec required on top.

## 2. What was missing (the actual gaps)

1. A clean, single **`/order`** public URL (spec's preferred shareable link). Only
   `/k/[slug]` existed.
2. **Order cut-off enforcement** (6:00 PM previous day, `Asia/Kolkata`) — the
   storefront showed the menu regardless of time.
3. **UPI QR code** on the confirmation screen (only a UPI ID string was shown).
4. **Functional "Copy UPI ID"** button (it was a static icon), an optional
   **payment-reference** field, and a **"confirm payment initiated"** action.
5. **Business-config environment variables** documented in `.env.example`
   (`NEXT_PUBLIC_UPI_QR_URL`, `NEXT_PUBLIC_DEFAULT_KITCHEN_SLUG`, etc.).
6. WhatsApp admin message pointed at `/k/<slug>` instead of `/order`.

## 3. What was reused (not rebuilt)

`MenuClient`, `ProductCard`, `CheckoutClient`, the cart store, the `place_order`
RPC, `/api/orders`, all RLS, the admin modules, and the design system. The new
`/order` routes are thin wrappers that render the **same** components with a
`basePath` prop.

## 4. Files created

- `src/app/order/page.tsx` — public menu at `/order`
- `src/app/order/checkout/page.tsx` — checkout at `/order/checkout`
- `src/app/order/success/page.tsx` — confirmation at `/order/success`
- `src/components/customer/order-success.tsx` — shared confirmation UI (used by both `/order` and `/k/[slug]`)
- `src/components/customer/payment-panel.tsx` — client: working Copy-UPI, QR, reference field, "I've paid → notify kitchen"
- `src/lib/ordering.ts` — timezone-aware cut-off logic + default-kitchen slug resolver
- `docs/IMPLEMENTATION_NOTE.md` — this file

## 5. Files modified (minimally)

- `src/components/customer/menu-client.tsx` — optional `basePath`; cut-off closed-state banner + disabled checkout
- `src/components/customer/checkout-client.tsx` — optional `basePath`
- `src/app/k/[slug]/page.tsx` + `checkout` — pass ordering-open state / basePath
- `src/app/k/[slug]/success/page.tsx` — now renders the shared `OrderSuccess` with a generated UPI QR
- `src/app/api/orders/route.ts` — **server-side cut-off enforcement** (defence in depth)
- `src/components/admin/menu-planner.tsx` — WhatsApp message uses the `/order` URL
- `.env.example` — business-config variables

## 6. No schema change required

The existing schema already supports everything (customers keyed by phone,
orders/order_items/payments, published daily menus, `order_cutoff_time` +
`timezone` on `kitchens`). **No migration was needed** — a deliberate outcome of
reusing the existing data model.

## 7. Decisions / trade-offs

- **Business config stays DB-first** (the `kitchens` row is the "secure business
  configuration" the spec allows), with env vars as documented fallbacks/overrides
  (`NEXT_PUBLIC_UPI_QR_URL`, `NEXT_PUBLIC_DEFAULT_KITCHEN_SLUG`). This keeps the
  app multi-kitchen-capable without hardcoding operational values in the UI.
- **Payment reference** is relayed to the kitchen via a pre-filled WhatsApp
  message rather than written to the DB by an anonymous user — this keeps the
  public RLS surface minimal (no public write path to `payments`). Manual
  verification by the owner is unchanged. Persisting the reference is a possible
  future enhancement (would need a service-role endpoint).
