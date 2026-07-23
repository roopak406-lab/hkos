'use client';

import { useMemo, useState, useTransition } from 'react';
import { Phone, MapPin, ChevronRight, Search, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatPaise } from '@/lib/money';
import { ORDER_STATUS_META, ORDER_PIPELINE, prettyDate } from '@/lib/format';
import { updateOrderStatus, markOrderPaid } from '@/app/admin/actions';
import type { OrderStatus } from '@/lib/database.types';
import type { OrderWithItems } from '@/app/admin/orders/page';

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'delivered', label: 'Delivered' },
];

export function OrdersBoard({ orders }: { orders: OrderWithItems[] }) {
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        (o.order_number ?? '').toLowerCase().includes(q) ||
        (o.flat_number ?? '').toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              }`}
            >
              {f.label}
              {counts[f.key] ? <span className="ml-1 opacity-70">{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Search name, phone, order #"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No orders here yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderWithItems }) {
  const [pending, startTransition] = useTransition();
  const meta = ORDER_STATUS_META[order.status];
  const nextStatus = getNextStatus(order.status);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{order.order_number}</span>
              <Badge variant={meta.badge}>{meta.label}</Badge>
              {order.payment_status === 'paid' ? (
                <Badge variant="success">Paid</Badge>
              ) : (
                <Badge variant="secondary">Unpaid</Badge>
              )}
            </div>
            <p className="mt-1 font-medium">{order.customer_name}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatPaise(order.total_paise)}</p>
            <p className="text-xs text-muted-foreground">{prettyDate(order.delivery_date)}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <a href={`tel:${order.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
            <Phone className="size-3.5" /> {order.phone}
          </a>
          {(order.flat_number || order.tower) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {[order.tower, order.flat_number].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <ul className="mt-3 space-y-1 rounded-lg bg-secondary/50 p-3 text-sm">
          {order.order_items.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span>
                {it.quantity} × {it.product_name}
                {it.variant_name ? ` (${it.variant_name})` : ''}
              </span>
              <span className="text-muted-foreground">{formatPaise(it.line_total_paise)}</span>
            </li>
          ))}
        </ul>

        {order.special_instructions && (
          <p className="mt-2 rounded-lg bg-warning/10 p-2 text-xs text-amber-800">
            📝 {order.special_instructions}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatus && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => startTransition(() => updateOrderStatus(order.id, nextStatus))}
            >
              Mark {ORDER_STATUS_META[nextStatus].label} <ChevronRight className="size-4" />
            </Button>
          )}
          {order.payment_status !== 'paid' && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(() => markOrderPaid(order.id))}
            >
              <Check className="size-4" /> Mark paid
            </Button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => startTransition(() => updateOrderStatus(order.id, 'cancelled'))}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getNextStatus(status: OrderStatus): OrderStatus | null {
  const idx = ORDER_PIPELINE.indexOf(status);
  if (idx < 0 || idx >= ORDER_PIPELINE.length - 1) return null;
  return ORDER_PIPELINE[idx + 1];
}
