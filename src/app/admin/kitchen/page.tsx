import Link from 'next/link';
import { Package, ChefHat, ListChecks } from 'lucide-react';
import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/admin/stat-card';
import { toDateKey, tomorrowKey, prettyDate } from '@/lib/format';
import type { Order, OrderItem } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

interface Params {
  searchParams: Promise<{ date?: string }>;
}

/**
 * Kitchen dashboard: auto-generated preparation list (aggregate quantities to
 * cook) and packing list (per order) for a delivery date.
 */
export default async function KitchenPage({ searchParams }: Params) {
  const { kitchen } = await requireKitchen();
  const { date } = await searchParams;
  const target = date === 'today' ? toDateKey() : tomorrowKey();

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('kitchen_id', kitchen.id)
    .eq('delivery_date', target)
    .neq('status', 'cancelled')
    .is('deleted_at', null)
    .order('placed_at', { ascending: true });

  const orders = (data ?? []) as (Order & { order_items: OrderItem[] })[];

  // Aggregate prep list: qty per product+variant.
  const prep = new Map<string, { name: string; qty: number }>();
  let totalItems = 0;
  for (const o of orders) {
    for (const it of o.order_items) {
      const key = `${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ''}`;
      const row = prep.get(key) ?? { name: key, qty: 0 };
      row.qty += it.quantity;
      prep.set(key, row);
      totalItems += it.quantity;
    }
  }
  const prepList = Array.from(prep.values()).sort((a, b) => b.qty - a.qty);
  const showingTomorrow = target === tomorrowKey();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Kitchen dashboard</h1>
          <p className="text-muted-foreground">Production plan for {prettyDate(target)}.</p>
        </div>
        <div className="flex gap-2 rounded-full bg-secondary p-1">
          <Link
            href="/admin/kitchen?date=today"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${!showingTomorrow ? 'bg-primary text-primary-foreground' : ''}`}
          >
            Today
          </Link>
          <Link
            href="/admin/kitchen?date=tomorrow"
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${showingTomorrow ? 'bg-primary text-primary-foreground' : ''}`}
          >
            Tomorrow
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Orders" value={String(orders.length)} icon={ListChecks} tone="primary" />
        <StatCard label="Items to cook" value={String(totalItems)} icon={ChefHat} tone="warning" />
        <StatCard label="Packets to pack" value={String(orders.length)} icon={Package} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Preparation list */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ChefHat className="size-5 text-primary" />
            <CardTitle>Preparation list</CardTitle>
          </CardHeader>
          <CardContent>
            {prepList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No orders to prep yet.
              </p>
            ) : (
              <ul className="divide-y">
                {prepList.map((p) => (
                  <li key={p.name} className="flex items-center justify-between py-2.5">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="default" className="text-sm">
                      × {p.qty}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Packing list */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Package className="size-5 text-primary" />
            <CardTitle>Packing list</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing to pack yet.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <li key={o.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">{o.order_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {[o.tower, o.flat_number].filter(Boolean).join(' · ') || o.customer_name}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {o.order_items.map((it) => `${it.quantity}× ${it.product_name}`).join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
