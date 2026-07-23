import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tomorrowKey, prettyDate } from '@/lib/format';
import { DEFAULT_KITCHEN_SLUG } from '@/lib/ordering';
import { CheckoutClient } from '@/components/customer/checkout-client';
import type { DeliverySlot, Kitchen } from '@/lib/database.types';

/** Public checkout at `/order/checkout`. */
export default async function OrderCheckoutPage() {
  const supabase = await createClient();

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('slug', DEFAULT_KITCHEN_SLUG)
    .maybeSingle();
  if (!kitchen) notFound();

  const { data: slots } = await supabase
    .from('delivery_slots')
    .select('*')
    .eq('kitchen_id', kitchen.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const menuDate = tomorrowKey();

  return (
    <CheckoutClient
      kitchen={kitchen as Kitchen}
      slots={(slots ?? []) as DeliverySlot[]}
      menuDate={menuDate}
      menuDateLabel={prettyDate(menuDate)}
      basePath="/order"
    />
  );
}
