import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Kitchen,
  ResolvedMenuItem,
  DeliverySlot,
  ProductVariant,
} from '@/lib/database.types';
import { getOrderingWindow, todayInTz } from '@/lib/ordering';

export interface PublicMenu {
  menuDate: string | null;
  items: ResolvedMenuItem[];
  slots: DeliverySlot[];
  variantsByProduct: Record<string, ProductVariant[]>;
  orderingClosed: boolean;
  cutoffLabel: string;
}

/**
 * Resolves the menu the public page should show: the soonest upcoming published
 * menu the customer can still order for (respecting cut-off + the owner's
 * open/closed override). Falls back to the soonest published date shown as
 * "closed", or nothing when no menu is published.
 */
export async function loadPublicMenu(
  supabase: SupabaseClient<Database>,
  kitchen: Kitchen,
): Promise<PublicMenu> {
  const today = todayInTz(kitchen.timezone);

  const { data: menus } = await supabase
    .from('daily_menus')
    .select('menu_date')
    .eq('kitchen_id', kitchen.id)
    .eq('status', 'published')
    .gte('menu_date', today)
    .is('deleted_at', null)
    .order('menu_date', { ascending: true })
    .limit(14);

  const dates = (menus ?? []).map((m) => m.menu_date);
  const empty: PublicMenu = {
    menuDate: null,
    items: [],
    slots: [],
    variantsByProduct: {},
    orderingClosed: false,
    cutoffLabel: kitchen.order_cutoff_time.slice(0, 5),
  };
  if (dates.length === 0) return empty;

  // Prefer the soonest date still open; else the soonest date (shown closed).
  let chosen = dates[0];
  let window = getOrderingWindow(
    chosen,
    kitchen.order_cutoff_time,
    kitchen.timezone,
    kitchen.ordering_status,
  );
  for (const d of dates) {
    const w = getOrderingWindow(
      d,
      kitchen.order_cutoff_time,
      kitchen.timezone,
      kitchen.ordering_status,
    );
    if (!w.closed) {
      chosen = d;
      window = w;
      break;
    }
  }

  const [{ data: items }, { data: slots }] = await Promise.all([
    supabase
      .from('v_daily_menu_resolved')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .eq('menu_date', chosen)
      .eq('is_available', true)
      .order('category_sort', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('delivery_slots')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const productIds = (items ?? []).map((i) => i.product_id);
  const { data: variants } = productIds.length
    ? await supabase
        .from('product_variants')
        .select('*')
        .in('product_id', productIds)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
    : { data: [] as ProductVariant[] };

  const variantsByProduct: Record<string, ProductVariant[]> = {};
  for (const v of (variants ?? []) as ProductVariant[]) {
    (variantsByProduct[v.product_id] ??= []).push(v);
  }

  return {
    menuDate: chosen,
    items: (items ?? []) as ResolvedMenuItem[],
    slots: (slots ?? []) as DeliverySlot[],
    variantsByProduct,
    orderingClosed: window.closed,
    cutoffLabel: window.cutoffLabel,
  };
}
