import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { tomorrowKey, toDateKey } from '@/lib/format';
import { OrdersBoard } from '@/components/admin/orders-board';
import type { Order, OrderItem } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export type OrderWithItems = Order & { order_items: OrderItem[] };

export default async function OrdersPage() {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('kitchen_id', kitchen.id)
    .in('delivery_date', [toDateKey(), tomorrowKey()])
    .is('deleted_at', null)
    .order('placed_at', { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Today &amp; tomorrow. Tap a status to advance an order.</p>
      </div>
      <OrdersBoard orders={(data ?? []) as OrderWithItems[]} />
    </div>
  );
}
