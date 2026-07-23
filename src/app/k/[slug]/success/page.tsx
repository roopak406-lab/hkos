import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OrderSuccess } from '@/components/customer/order-success';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ n?: string; t?: string }>;
}

/** Order confirmation for the multi-tenant `/k/[slug]` route. */
export default async function SuccessPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { n: orderNumber, t } = await searchParams;

  const supabase = await createClient();
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('name, upi_id, upi_display_name, whatsapp_number, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!kitchen) notFound();

  return (
    <OrderSuccess
      kitchenName={kitchen.name}
      upiId={kitchen.upi_id}
      upiDisplayName={kitchen.upi_display_name}
      whatsappNumber={kitchen.whatsapp_number}
      orderNumber={orderNumber ?? '—'}
      totalPaise={Number(t ?? 0)}
      backHref={`/k/${kitchen.slug}`}
    />
  );
}
