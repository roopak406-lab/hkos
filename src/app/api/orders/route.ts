import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { placeOrderSchema } from '@/lib/validators';
import { getOrderingWindow } from '@/lib/ordering';
import { sendOrderEmail } from '@/lib/email';

/**
 * POST /api/orders — public checkout endpoint.
 * Runs server-side with the service role and delegates to the `place_order`
 * Postgres function, which recomputes all prices from the DB and enforces
 * limited-batch caps atomically. The client cannot tamper with amounts.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order' },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  // Server-side cut-off enforcement (defence in depth — the public page also
  // hides ordering after cut-off). Evaluated in the kitchen's own timezone.
  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('order_cutoff_time, timezone')
    .eq('id', input.kitchenId)
    .maybeSingle();
  if (kitchen) {
    const win = getOrderingWindow(
      input.deliveryDate,
      kitchen.order_cutoff_time,
      kitchen.timezone,
    );
    if (win.closed) {
      return NextResponse.json(
        { error: 'Orders for this menu are now closed.' },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabase.rpc('place_order', {
    p_kitchen_id: input.kitchenId,
    p_customer: {
      name: input.customer.name,
      phone: input.customer.phone,
      flat_number: input.customer.flatNumber,
      tower: input.customer.tower ?? '',
    },
    p_delivery_date: input.deliveryDate,
    p_delivery_slot_id: input.deliverySlotId,
    p_items: input.items,
    p_special_instructions: input.specialInstructions || null,
  });

  if (error) {
    // P0002 = limited batch exceeded; surface a friendly message.
    const status = error.message.includes('left') ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const result = data as { order_id: string; order_number: string; total_paise: number };

  // Best-effort owner email (only when RESEND_API_KEY is configured).
  if (process.env.RESEND_API_KEY) {
    try {
      const [{ data: k }, { data: items }] = await Promise.all([
        supabase.from('kitchens').select('name, notification_email').eq('id', input.kitchenId).maybeSingle(),
        supabase.from('order_items').select('quantity, product_name, variant_name').eq('order_id', result.order_id),
      ]);
      if (k?.notification_email) {
        await sendOrderEmail({
          to: k.notification_email,
          kitchenName: k.name,
          orderNumber: result.order_number,
          customerName: input.customer.name,
          phone: input.customer.phone,
          flat: input.customer.flatNumber,
          tower: input.customer.tower ?? null,
          totalPaise: result.total_paise,
          deliveryDate: input.deliveryDate,
          items: (items ?? []) as { quantity: number; product_name: string; variant_name: string | null }[],
        });
      }
    } catch {
      /* never fail the order because of a notification */
    }
  }

  return NextResponse.json(data, { status: 201 });
}
