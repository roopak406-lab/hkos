import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tomorrowKey, prettyDate } from '@/lib/format';
import { getOrderingWindow } from '@/lib/ordering';
import { MenuClient } from '@/components/customer/menu-client';
import type {
  ResolvedMenuItem,
  DeliverySlot,
  Kitchen,
  ProductVariant,
} from '@/lib/database.types';

export const revalidate = 30; // menu changes infrequently; keep it snappy

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Public customer page. No login. Shows TOMORROW's published menu for the
 * kitchen identified by :slug, grouped by category.
 */
export default async function KitchenPage({ params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!kitchen) notFound();

  const menuDate = tomorrowKey();

  const [{ data: items }, { data: slots }] = await Promise.all([
    supabase
      .from('v_daily_menu_resolved')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .eq('menu_date', menuDate)
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

  // Fetch variants only for the products actually on the menu.
  const productIds = (items ?? []).map((i) => (i as ResolvedMenuItem).product_id);
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

  const window = getOrderingWindow(
    menuDate,
    kitchen.order_cutoff_time,
    kitchen.timezone,
  );

  return (
    <MenuClient
      kitchen={kitchen as Kitchen}
      items={(items ?? []) as ResolvedMenuItem[]}
      slots={(slots ?? []) as DeliverySlot[]}
      variantsByProduct={variantsByProduct}
      menuDate={menuDate}
      menuDateLabel={prettyDate(menuDate)}
      orderingClosed={window.closed}
      cutoffLabel={window.cutoffLabel}
    />
  );
}
