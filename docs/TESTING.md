# HKOS — Testing Guide

A pragmatic manual-first test plan covering the critical paths. Automated tests
(Vitest + Playwright) are on the roadmap; the scenarios below map 1:1 to future
E2E specs.

## Prerequisites
- DB migrated + seeded (`0001`→`0003` + `seed.sql`).
- `npm run dev` running on :5210.
- Owner user created and linked (see DEPLOYMENT §1.5).

---

## A. Customer storefront (`/k/aromatic-tadka`)

| # | Steps | Expected |
|---|-------|----------|
| A1 | Open the storefront | Hero, tomorrow’s date, categories, seeded items |
| A2 | Pick a variant (Stuffed Paratha → Gobi) and **Add** | Price updates; sticky cart shows count + total |
| A3 | Increase quantity beyond the batch cap | Stepper disables at `qty_remaining` |
| A4 | **Checkout** → submit with blank name/phone | Inline validation errors |
| A5 | Enter valid details, pick a slot, **Place order** | Redirect to success page with order # + UPI details |
| A6 | Re-open storefront | Cart cleared (persisted store reset after order) |

## B. Limited batch / concurrency

| # | Steps | Expected |
|---|-------|----------|
| B1 | Set an item’s `available_qty` to 1 (admin menu) | Storefront shows “1 left” |
| B2 | Order that 1 unit | Success |
| B3 | Order it again | `409` “Only 0 of … left”, order rejected |

## C. Owner — orders (`/admin/orders`)

| # | Steps | Expected |
|---|-------|----------|
| C1 | New order appears | Status **New**, **Unpaid** |
| C2 | Advance status | New → Accepted → Preparing → Ready → Delivered |
| C3 | **Mark paid** | Badge flips to **Paid** |
| C4 | Search by phone / order # / flat | List filters correctly |
| C5 | Cancel an order | Status **Cancelled**; excluded from revenue/prep |

## D. Owner — menu publish (`/admin/menu`)

| # | Steps | Expected |
|---|-------|----------|
| D1 | Toggle products, set a price override + qty | Selection state updates |
| D2 | **Publish menu** | Storefront reflects changes within ~30s (revalidate) |
| D3 | **Copy** WhatsApp message | Clipboard has a formatted menu with the storefront link |
| D4 | **New product** → save | Appears in the correct category |

## E. Kitchen dashboard (`/admin/kitchen`)
- E1: Prep list aggregates identical items across orders (qty summed).
- E2: Packing list shows one row per order with flat/tower.
- E3: Today/Tomorrow toggle switches the target date.

## F. Finance (`/admin/finance`)
- F1: Log an expense → appears in “Recent”, category total, and the chart.
- F2: Profit = revenue − expenses updates.

## G. Security / RLS
- G1: Signed out, `GET /admin` → redirect to `/login`.
- G2: With the **anon** key, selecting a `draft` menu returns 0 rows.
- G3: With the **anon** key, selecting `orders`/`expenses` returns 0 rows.
- G4: Tampering with `unit_price` in the `/api/orders` body has no effect
      (server recomputes from the DB).

---

## Quick DB sanity (SQL editor)
```sql
select order_number, status, total_paise from orders order by placed_at desc limit 5;
select * from business_dashboard((select id from kitchens where slug='aromatic-tadka'));
```
