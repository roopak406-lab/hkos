import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tomorrowKey, prettyDate } from '@/lib/format';
import { CheckoutClient } from '@/components/customer/checkout-client';
import type { DeliverySlot, Kitchen } from '@/lib/database.types';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function CheckoutPage({ params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('slug', slug)
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
    />
  );
}
