import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_KITCHEN_SLUG } from '@/lib/ordering';
import { OrderSuccess } from '@/components/customer/order-success';

interface Props {
  searchParams: Promise<{ n?: string; t?: string }>;
}

/** Order confirmation + UPI instructions at `/order/success`. */
export default async function OrderSuccessPage({ searchParams }: Props) {
  const { n: orderNumber, t } = await searchParams;

  const supabase = await createClient();
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('id, name, upi_id, upi_display_name, upi_qr_url, whatsapp_number')
    .eq('slug', DEFAULT_KITCHEN_SLUG)
    .maybeSingle();
  if (!kitchen) notFound();

  return (
    <OrderSuccess
      kitchenId={kitchen.id}
      kitchenName={kitchen.name}
      upiId={kitchen.upi_id}
      upiDisplayName={kitchen.upi_display_name}
      upiQrUrl={kitchen.upi_qr_url}
      whatsappNumber={kitchen.whatsapp_number}
      orderNumber={orderNumber ?? '—'}
      totalPaise={Number(t ?? 0)}
      backHref="/order"
    />
  );
}
