'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPaise } from '@/lib/money';

interface Toast {
  id: string;
  orderNumber: string;
  customer: string;
  totalPaise: number;
}

/**
 * Live new-order alerts for the owner. Subscribes to Supabase Realtime inserts
 * on `orders` for this kitchen, plays a chime, shows a toast, and refreshes the
 * page data so the order appears immediately. Active on every admin screen.
 */
export function NewOrderAlert({ kitchenId }: { kitchenId: string }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const chime = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current ??= new Ctx();
      const ctx = audioCtxRef.current;
      const play = (freq: number, at: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.001, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
        o.start(ctx.currentTime + at);
        o.stop(ctx.currentTime + at + 0.36);
      };
      play(880, 0);
      play(1174, 0.18); // pleasant two-note chime
    } catch {
      /* audio may be blocked until the owner interacts — toast still shows */
    }
  };

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-alerts-${kitchenId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `kitchen_id=eq.${kitchenId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_number: string | null;
            customer_name: string;
            total_paise: number;
          };
          chime();
          setToasts((t) => [
            {
              id: row.id,
              orderNumber: row.order_number ?? 'New',
              customer: row.customer_name,
              totalPaise: row.total_paise,
            },
            ...t,
          ].slice(0, 4));
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitchenId]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            dismiss(t.id);
            router.push('/admin/orders');
          }}
          className="flex w-72 items-center gap-3 rounded-2xl border border-primary/30 bg-card p-3 text-left shadow-xl animate-in"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShoppingBag className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">New order · {t.orderNumber}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {t.customer} · {formatPaise(t.totalPaise)}
            </span>
          </span>
          <X
            className="size-4 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
          />
        </button>
      ))}
    </div>
  );
}
