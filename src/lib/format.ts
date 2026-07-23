import { format, addDays, parseISO } from 'date-fns';
import type { OrderStatus } from '@/lib/database.types';

/** yyyy-MM-dd for a date (defaults to today). */
export const toDateKey = (d: Date = new Date()): string => format(d, 'yyyy-MM-dd');

/** Tomorrow's date key — the default menu horizon for HKOS. */
export const tomorrowKey = (): string => toDateKey(addDays(new Date(), 1));

/** "Fri, 24 Jul" style label. */
export const prettyDate = (iso: string): string => format(parseISO(iso), 'EEE, d MMM');

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badge: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  new: { label: 'New', badge: 'warning' },
  accepted: { label: 'Accepted', badge: 'default' },
  preparing: { label: 'Preparing', badge: 'default' },
  ready: { label: 'Ready', badge: 'success' },
  delivered: { label: 'Delivered', badge: 'secondary' },
  cancelled: { label: 'Cancelled', badge: 'destructive' },
};

/** Ordered pipeline used by the orders board. */
export const ORDER_PIPELINE: OrderStatus[] = [
  'new',
  'accepted',
  'preparing',
  'ready',
  'delivered',
];
