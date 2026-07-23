import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prettyDate } from '@/lib/format';
import { loadPublicMenu } from '@/lib/public-menu';
import { MenuClient } from '@/components/customer/menu-client';
import type { Kitchen } from '@/lib/database.types';

export const revalidate = 30;

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Public customer page for a specific kitchen. Shows the next orderable
 * published menu, grouped by category.
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

  const menu = await loadPublicMenu(supabase, kitchen as Kitchen);

  return (
    <MenuClient
      kitchen={kitchen as Kitchen}
      items={menu.items}
      slots={menu.slots}
      variantsByProduct={menu.variantsByProduct}
      menuDate={menu.menuDate ?? ''}
      menuDateLabel={menu.menuDate ? prettyDate(menu.menuDate) : ''}
      orderingClosed={menu.orderingClosed}
      cutoffLabel={menu.cutoffLabel}
    />
  );
}
