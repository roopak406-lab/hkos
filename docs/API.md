# HKOS — API & Data Access Reference

HKOS uses three access layers, each with the least privilege it needs:

| Layer | Client | Auth | Used by |
|-------|--------|------|---------|
| Public read | anon key | none | Storefront reads (kitchens, published menus, catalog) |
| Owner app | anon key + session cookie | Supabase Auth | `/admin/*` reads & Server Actions (RLS-scoped) |
| Trusted server | **service role** | server-only secret | `POST /api/orders` → `place_order` RPC |

Most data flows through Supabase’s auto-generated PostgREST API (via the JS
SDK) governed by RLS. The only bespoke HTTP endpoint is order placement.

---

## HTTP endpoint

### `POST /api/orders`
Public checkout. Validates with Zod, then calls the `place_order` Postgres
function with the service role. Prices are recomputed server-side.

**Request body**
```json
{
  "kitchenId": "uuid",
  "deliveryDate": "2026-07-24",
  "deliverySlotId": "uuid",
  "customer": { "name": "Priya", "phone": "9876543210", "flatNumber": "1203", "tower": "B" },
  "items": [
    { "product_id": "uuid", "variant_id": "uuid-or-null", "quantity": 2, "note": "" }
  ],
  "specialInstructions": "Less spicy"
}
```

**Responses**
| Status | Meaning | Body |
|--------|---------|------|
| `201` | Order placed | `{ "order_id", "order_number", "total_paise" }` |
| `422` | Validation failed | `{ "error": "<message>" }` |
| `409` | Limited batch exceeded | `{ "error": "Only N of X left" }` |
| `400` | No published menu / bad product | `{ "error": "<message>" }` |

---

## Postgres RPCs (callable via `supabase.rpc(...)`)

### `place_order(p_kitchen_id, p_customer jsonb, p_delivery_date, p_delivery_slot_id, p_items jsonb, p_special_instructions)`
`SECURITY DEFINER`. Upserts the customer by phone, creates the order + items +
a pending UPI payment, enforces `available_qty`, and returns
`{ order_id, order_number, total_paise }`. **Atomic.**

### `business_dashboard(p_kitchen_id, p_date default current_date) → jsonb`
Headline numbers for a date: orders today, pending/preparing/delivered, revenue,
expenses, profit, month revenue, AOV, best-seller, repeat customers.

### `finance_summary(p_kitchen_id, p_from, p_to) → jsonb`
Revenue, expenses, per-category expense breakdown, and a per-day series for
charting.

---

## Views

### `v_daily_menu_resolved` (`security_invoker`)
One row per menu item with the **resolved price** (`price_override` ?? default),
`qty_remaining`, category and product details. Powers the storefront and prep
list. RLS-enforced as the querying role.

---

## Common SDK reads (RLS-scoped)

```ts
// Tomorrow's published menu for the storefront
supabase.from('v_daily_menu_resolved')
  .select('*').eq('kitchen_id', id).eq('menu_date', date).eq('is_available', true);

// Orders board (owner)
supabase.from('orders').select('*, order_items(*)')
  .eq('kitchen_id', id).in('delivery_date', [today, tomorrow]);
```

All admin **mutations** go through Server Actions in
`src/app/admin/actions.ts` (`updateOrderStatus`, `markOrderPaid`, `publishMenu`,
`addExpense`, `saveProduct`, `archiveProduct`).
