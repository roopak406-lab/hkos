import { Users, Phone, MapPin, Repeat } from 'lucide-react';
import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/admin/stat-card';
import { CustomerSearch } from '@/components/admin/customer-search';
import { formatPaise } from '@/lib/money';
import type { Customer, Order, OrderItem } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  flat_number: string | null;
  tower: string | null;
  notes: string | null;
  orderCount: number;
  totalSpentPaise: number;
  lastOrder: string | null;
  favourite: string | null;
}

export default async function CustomersPage() {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();

  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('id, customer_id, total_paise, delivery_date, status, order_items(product_name, quantity)')
      .eq('kitchen_id', kitchen.id)
      .neq('status', 'cancelled')
      .is('deleted_at', null),
  ]);

  const orderList = (orders ?? []) as (Order & { order_items: Pick<OrderItem, 'product_name' | 'quantity'>[] })[];

  const rows: CustomerRow[] = ((customers ?? []) as Customer[]).map((c) => {
    const theirs = orderList.filter((o) => o.customer_id === c.id);
    const fav = new Map<string, number>();
    for (const o of theirs)
      for (const it of o.order_items) fav.set(it.product_name, (fav.get(it.product_name) ?? 0) + it.quantity);
    const favourite = [...fav.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const lastOrder = theirs
      .map((o) => o.delivery_date)
      .sort()
      .at(-1) ?? null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      flat_number: c.flat_number,
      tower: c.tower,
      notes: c.notes,
      orderCount: theirs.length,
      totalSpentPaise: theirs.reduce((n, o) => n + o.total_paise, 0),
      lastOrder,
      favourite,
    };
  }).sort((a, b) => b.orderCount - a.orderCount);

  const repeatCount = rows.filter((r) => r.orderCount > 1).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Customer book</h1>
        <p className="text-muted-foreground">Everyone who has ordered from your kitchen.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total customers" value={String(rows.length)} icon={Users} tone="primary" />
        <StatCard label="Repeat customers" value={String(repeatCount)} icon={Repeat} tone="success" />
        <StatCard
          label="Lifetime revenue"
          value={formatPaise(rows.reduce((n, r) => n + r.totalSpentPaise, 0))}
          icon={Users}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No customers yet — they’ll appear here after the first order.
          </CardContent>
        </Card>
      ) : (
        <CustomerSearch rows={rows} />
      )}
    </div>
  );
}
