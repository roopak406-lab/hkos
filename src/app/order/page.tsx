import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prettyDate } from '@/lib/format';
import { DEFAULT_KITCHEN_SLUG } from '@/lib/ordering';
import { loadPublicMenu } from '@/lib/public-menu';
import { MenuClient } from '@/components/customer/menu-client';
import type { Kitchen } from '@/lib/database.types';

export const revalidate = 30;

/**
 * The public, WhatsApp-shareable ordering page — a single clean URL (`/order`)
 * bound to the default kitchen. Shows the next orderable published menu.
 */
export default async function OrderPage() {
  const supabase = await createClient();

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('slug', DEFAULT_KITCHEN_SLUG)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (!kitchen) notFound();

  const menu = await loadPublicMenu(supabase, kitchen as Kitchen);

  return (
    <MenuClient
      kitchen={kitchen as Kitchen}
      items={menu.items}
      slots={menu.slots}
      variantsByProduct={menu.variantsByProduct}
      menuDate={menu.menuDate ?? ''}
      menuDateLabel={menu.menuDate ? prettyDate(menu.menuDate) : ''}
      basePath="/order"
      orderingClosed={menu.orderingClosed}
      cutoffLabel={menu.cutoffLabel}
    />
  );
}
