import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  kitchenId: z.string().uuid(),
  orderNumber: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(''),
});

/**
 * POST /api/reviews — public review submission. Tied to a real order number so
 * only actual customers can review; one review per order.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid review' },
      { status: 422 },
    );
  }
  const { kitchenId, orderNumber, rating, comment } = parsed.data;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, customer_name')
    .eq('kitchen_id', kitchenId)
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'This order has already been reviewed.' }, { status: 409 });
  }

  const { error } = await supabase.from('reviews').insert({
    kitchen_id: kitchenId,
    order_id: order.id,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    rating,
    comment: comment || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
