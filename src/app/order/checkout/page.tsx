import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prettyDate } from '@/lib/format';
import { DEFAULT_KITCHEN_SLUG } from '@/lib/ordering';
import { loadPublicMenu } from '@/lib/public-menu';
import { CheckoutClient } from '@/components/customer/checkout-client';
import type { Kitchen } from '@/lib/database.types';

/** Public checkout at `/order/checkout`. */
export default async function OrderCheckoutPage() {
  const supabase = await createClient();

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('slug', DEFAULT_KITCHEN_SLUG)
    .maybeSingle();
  if (!kitchen) notFound();

  const menu = await loadPublicMenu(supabase, kitchen as Kitchen);
  // No orderable menu (none published or ordering closed) → back to the menu.
  if (!menu.menuDate || menu.orderingClosed) redirect('/order');

  return (
    <CheckoutClient
      kitchen={kitchen as Kitchen}
      slots={menu.slots}
      menuDate={menu.menuDate}
      menuDateLabel={prettyDate(menu.menuDate)}
      basePath="/order"
    />
  );
}
