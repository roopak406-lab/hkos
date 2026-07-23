import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MenuPlanner } from '@/components/admin/menu-planner';
import { tomorrowKey, prettyDate } from '@/lib/format';
import { todayInTz } from '@/lib/ordering';
import type { Category, Product, DailyMenuItem, Kitchen } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

interface Params {
  searchParams: Promise<{ date?: string }>;
}

export default async function MenuPage({ searchParams }: Params) {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();
  const { date } = await searchParams;

  const today = todayInTz(kitchen.timezone);
  // Selected date to plan; default tomorrow, never earlier than today.
  const menuDate = date && date >= today ? date : tomorrowKey();

  const [{ data: categories }, { data: products }, { data: menu }, { data: upcoming }] =
    await Promise.all([
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
      supabase
        .from('daily_menus')
        .select('menu_date, status')
        .eq('kitchen_id', kitchen.id)
        .gte('menu_date', today)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('menu_date', { ascending: true })
        .limit(14),
    ]);

  const existingItems = (menu?.daily_menu_items ?? []) as DailyMenuItem[];

  return (
    <MenuPlanner
      key={menuDate}
      kitchen={kitchen as Kitchen}
      categories={(categories ?? []) as Category[]}
      products={(products ?? []) as Product[]}
      existingItems={existingItems}
      published={menu?.status === 'published'}
      menuDate={menuDate}
      menuDateLabel={prettyDate(menuDate)}
      today={today}
      upcomingDates={(upcoming ?? []).map((u) => u.menu_date)}
    />
  );
}
