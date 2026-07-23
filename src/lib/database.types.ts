/**
 * Hand-authored types mirroring the SQL schema (migrations 0001–0003).
 * In a real project regenerate with: `npm run db:types` (Supabase CLI).
 * Kept lean but accurate for the tables/RPCs the app actually uses.
 */

export type UserRole = 'owner' | 'manager' | 'staff';
export type MenuStatus = 'draft' | 'published' | 'closed';
export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'upi' | 'cash' | 'other';

export type Kitchen = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  upi_id: string | null;
  upi_display_name: string | null;
  currency: string;
  timezone: string;
  business_open: string;
  business_close: string;
  order_cutoff_time: string;
  delivery_radius_note: string | null;
  theme: Record<string, string>;
  is_active: boolean;
  /** auto = follow cut-off; open = always accept; closed = force closed. */
  ordering_status: 'auto' | 'open' | 'closed';
  upi_qr_url: string | null;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type Review = {
  id: string;
  kitchen_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type KitchenUser = {
  id: string;
  kitchen_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type Category = {
  id: string;
  kitchen_id: string;
  name: string;
  slug: string;
  sort_order: number;
  deleted_at: string | null;
}

export type DeliverySlot = {
  id: string;
  kitchen_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
}

export type Product = {
  id: string;
  kitchen_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  default_price_paise: number;
  is_always_available: boolean;
  prep_notes: string | null;
  packing_notes: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  price_delta_paise: number;
  is_default: boolean;
  sort_order: number;
  deleted_at: string | null;
}

export type DailyMenu = {
  id: string;
  kitchen_id: string;
  menu_date: string;
  status: MenuStatus;
  notes: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyMenuItem = {
  id: string;
  daily_menu_id: string;
  product_id: string;
  price_override_paise: number | null;
  is_available: boolean;
  available_qty: number | null;
  sold_qty: number;
  sort_order: number;
}

export type Customer = {
  id: string;
  kitchen_id: string;
  name: string;
  phone: string;
  flat_number: string | null;
  tower: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type Order = {
  id: string;
  kitchen_id: string;
  order_number: string | null;
  daily_menu_id: string | null;
  customer_id: string | null;
  customer_name: string;
  phone: string;
  flat_number: string | null;
  tower: string | null;
  delivery_slot_id: string | null;
  delivery_date: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  special_instructions: string | null;
  placed_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  unit_price_paise: number;
  quantity: number;
  line_total_paise: number;
  special_instructions: string | null;
}

export type ExpenseCategory = {
  id: string;
  kitchen_id: string;
  name: string;
  sort_order: number;
}

export type Expense = {
  id: string;
  kitchen_id: string;
  expense_category_id: string | null;
  amount_paise: number;
  note: string | null;
  spent_on: string;
  created_at: string;
  deleted_at: string | null;
}

/** Row from the v_daily_menu_resolved view. */
export type ResolvedMenuItem = {
  menu_item_id: string;
  daily_menu_id: string;
  kitchen_id: string;
  menu_date: string;
  menu_status: MenuStatus;
  product_id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_sort: number | null;
  price_paise: number;
  is_available: boolean;
  available_qty: number | null;
  sold_qty: number;
  qty_remaining: number | null;
  sort_order: number;
}

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type RowR<T, R> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: R };

// Foreign-key metadata so PostgREST-style embedded selects resolve their types.
type Fk<Cols extends string, Ref extends string> = {
  foreignKeyName: string;
  columns: [Cols];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      kitchens: Row<Kitchen>;
      kitchen_users: RowR<KitchenUser, [Fk<'kitchen_id', 'kitchens'>]>;
      categories: Row<Category>;
      delivery_slots: Row<DeliverySlot>;
      products: Row<Product>;
      product_variants: RowR<ProductVariant, [Fk<'product_id', 'products'>]>;
      daily_menus: Row<DailyMenu>;
      daily_menu_items: RowR<DailyMenuItem, [Fk<'daily_menu_id', 'daily_menus'>, Fk<'product_id', 'products'>]>;
      customers: Row<Customer>;
      orders: RowR<Order, [Fk<'daily_menu_id', 'daily_menus'>, Fk<'customer_id', 'customers'>, Fk<'delivery_slot_id', 'delivery_slots'>]>;
      order_items: RowR<OrderItem, [Fk<'order_id', 'orders'>, Fk<'product_id', 'products'>, Fk<'variant_id', 'product_variants'>]>;
      expense_categories: Row<ExpenseCategory>;
      expenses: RowR<Expense, [Fk<'expense_category_id', 'expense_categories'>]>;
      reviews: RowR<Review, [Fk<'order_id', 'orders'>, Fk<'customer_id', 'customers'>]>;
    };
    Views: {
      v_daily_menu_resolved: { Row: ResolvedMenuItem; Relationships: [] };
    };
    Functions: {
      place_order: {
        Args: {
          p_kitchen_id: string;
          p_customer: Record<string, string>;
          p_delivery_date: string;
          p_delivery_slot_id: string;
          p_items: unknown;
          p_special_instructions?: string | null;
        };
        Returns: { order_id: string; order_number: string; total_paise: number };
      };
      business_dashboard: {
        Args: { p_kitchen_id: string; p_date?: string };
        Returns: DashboardSummary;
      };
      finance_summary: {
        Args: { p_kitchen_id: string; p_from: string; p_to: string };
        Returns: FinanceSummary;
      };
    };
    Enums: {
      user_role: UserRole;
      menu_status: MenuStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type DashboardSummary = {
  date: string;
  orders_today: number;
  pending_orders: number;
  preparing: number;
  delivered: number;
  revenue_today_paise: number;
  expenses_today_paise: number;
  profit_today_paise: number;
  revenue_month_paise: number;
  avg_order_value_paise: number;
  best_selling: string | null;
  repeat_customers: number;
}

export type FinanceSummary = {
  revenue_paise: number;
  expenses_paise: number;
  by_expense_category: { name: string; amount_paise: number }[];
  daily: { day: string; revenue_paise: number; expense_paise: number }[];
}
