# HKOS — Entity Relationship Diagram

All business tables are tenant-scoped by `kitchen_id`. Money is stored in
integer **paise**. Every table has `created_at` / `updated_at`; most also have
`deleted_at` (soft delete).

```mermaid
erDiagram
    kitchens ||--o{ kitchen_users : "has staff"
    kitchens ||--o{ categories : "has"
    kitchens ||--o{ delivery_slots : "has"
    kitchens ||--o{ products : "has"
    kitchens ||--o{ daily_menus : "publishes"
    kitchens ||--o{ customers : "serves"
    kitchens ||--o{ orders : "receives"
    kitchens ||--o{ expense_categories : "has"
    kitchens ||--o{ expenses : "records"

    categories ||--o{ products : "groups"
    products ||--o{ product_variants : "has"
    products ||--o{ daily_menu_items : "listed as"

    daily_menus ||--o{ daily_menu_items : "contains"
    daily_menus ||--o{ orders : "for date"

    customers ||--o{ orders : "places"
    delivery_slots ||--o{ orders : "scheduled in"

    orders ||--o{ order_items : "contains"
    orders ||--o{ payments : "settled by"
    products ||--o{ order_items : "snapshot of"
    product_variants ||--o{ order_items : "snapshot of"

    expense_categories ||--o{ expenses : "classifies"

    kitchens {
        uuid id PK
        text slug UK
        text name
        text upi_id
        time order_cutoff_time
        jsonb theme
    }
    products {
        uuid id PK
        uuid kitchen_id FK
        uuid category_id FK
        int default_price_paise
        bool is_always_available
        bool is_archived
    }
    product_variants {
        uuid id PK
        uuid product_id FK
        int price_delta_paise
        bool is_default
    }
    daily_menus {
        uuid id PK
        uuid kitchen_id FK
        date menu_date
        menu_status status
    }
    daily_menu_items {
        uuid id PK
        uuid daily_menu_id FK
        uuid product_id FK
        int price_override_paise
        int available_qty
        int sold_qty
    }
    orders {
        uuid id PK
        uuid kitchen_id FK
        text order_number
        uuid customer_id FK
        date delivery_date
        order_status status
        payment_status payment_status
        int total_paise
    }
    order_items {
        uuid id PK
        uuid order_id FK
        text product_name
        text variant_name
        int unit_price_paise
        int quantity
        int line_total_paise
    }
    customers {
        uuid id PK
        uuid kitchen_id FK
        text phone
        text flat_number
        text tower
    }
    expenses {
        uuid id PK
        uuid kitchen_id FK
        uuid expense_category_id FK
        int amount_paise
        date spent_on
    }
```

## Key relationships & rules

- **`kitchens`** is the tenant root. `current_kitchen_ids()` (a `SECURITY
  DEFINER` helper) resolves the caller’s kitchens for every RLS policy.
- **`daily_menu_items.available_qty` / `sold_qty`** implement limited batches.
  `place_order` increments `sold_qty` atomically and rejects over-selling.
- **`order_items`** snapshot `product_name`, `variant_name`, and
  `unit_price_paise` so historical orders never change when a product is edited.
- **`orders.order_number`** is a per-kitchen human code (e.g. `ARO-1043`),
  assigned by the `assign_order_number` BEFORE-INSERT trigger.
