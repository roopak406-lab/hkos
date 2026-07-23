import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prettyDate } from '@/lib/format';
import { loadPublicMenu } from '@/lib/public-menu';
import { CheckoutClient } from '@/components/customer/checkout-client';
import type { Kitchen } from '@/lib/database.types';

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

  const menu = await loadPublicMenu(supabase, kitchen as Kitchen);
  if (!menu.menuDate || menu.orderingClosed) redirect(`/k/${slug}`);

  return (
    <CheckoutClient
      kitchen={kitchen as Kitchen}
      slots={menu.slots}
      menuDate={menu.menuDate}
      menuDateLabel={prettyDate(menu.menuDate)}
      basePath={`/k/${slug}`}
    />
  );
}
