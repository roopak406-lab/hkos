import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MenuPlanner } from '@/components/admin/menu-planner';
import { tomorrowKey, prettyDate } from '@/lib/format';
import type { Category, Product, DailyMenuItem, Kitchen } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();
  const menuDate = tomorrowKey();

  const [{ data: categories }, { data: products }, { data: menu }] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('daily_menus')
      .select('id, status, daily_menu_items(*)')
      .eq('kitchen_id', kitchen.id)
      .eq('menu_date', menuDate)
      .maybeSingle(),
  ]);

  const existingItems = (menu?.daily_menu_items ?? []) as DailyMenuItem[];

  return (
    <MenuPlanner
      kitchen={kitchen as Kitchen}
      categories={(categories ?? []) as Category[]}
      products={(products ?? []) as Product[]}
      existingItems={existingItems}
      published={menu?.status === 'published'}
      menuDate={menuDate}
      menuDateLabel={prettyDate(menuDate)}
    />
  );
}
