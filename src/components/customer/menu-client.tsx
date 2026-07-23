'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, MapPin, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPaise } from '@/lib/money';
import {
  useCart,
  selectCartCount,
  selectCartTotalPaise,
} from '@/stores/cart';
import type {
  ResolvedMenuItem,
  DeliverySlot,
  Kitchen,
  ProductVariant,
} from '@/lib/database.types';
import { BrandLogo } from '@/components/brand-logo';
import { ProductCard } from './product-card';

interface Props {
  kitchen: Kitchen;
  items: ResolvedMenuItem[];
  slots: DeliverySlot[];
  variantsByProduct: Record<string, ProductVariant[]>;
  menuDate: string;
  menuDateLabel: string;
  /** URL base for checkout links (default `/k/<slug>`; `/order` for the public link). */
  basePath?: string;
  /** True once the cut-off has passed — ordering is disabled. */
  orderingClosed?: boolean;
  /** Cut-off time label, e.g. "18:00". */
  cutoffLabel?: string;
}

export function MenuClient({
  kitchen,
  items,
  variantsByProduct,
  menuDateLabel,
  basePath,
  orderingClosed = false,
  cutoffLabel,
}: Props) {
  const router = useRouter();
  const setKitchen = useCart((s) => s.setKitchen);
  const count = useCart(selectCartCount);
  const totalPaise = useCart(selectCartTotalPaise);
  const checkoutBase = basePath ?? `/k/${kitchen.slug}`;

  useEffect(() => setKitchen(kitchen.id), [kitchen.id, setKitchen]);

  // Group items by category, preserving the sorted order from the server.
  const grouped = useMemo(() => {
    const map = new Map<string, ResolvedMenuItem[]>();
    for (const it of items) {
      const key = it.category_name ?? 'Menu';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const [activeCat, setActiveCat] = useState(grouped[0]?.[0] ?? '');

  const scrollToCat = (cat: string) => {
    setActiveCat(cat);
    document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasMenu = items.length > 0;

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div
          className="h-56 w-full bg-cover bg-center sm:h-72"
          style={{
            backgroundImage: `linear-gradient(to top, hsl(152 58% 12% / 0.92), hsl(152 58% 18% / 0.35)), url(${
              kitchen.hero_url ?? ''
            })`,
            backgroundColor: 'hsl(var(--primary))',
          }}
        />
        <div className="container -mt-24 relative">
          <div className="rounded-2xl border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo
                  size={64}
                  src={kitchen.logo_url ?? undefined}
                  alt={kitchen.name}
                  className="shrink-0 ring-1 ring-primary/10"
                />
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight">
                    {kitchen.name}
                  </h1>
                  {kitchen.tagline && (
                    <p className="mt-1 text-sm text-muted-foreground">{kitchen.tagline}</p>
                  )}
                </div>
              </div>
              {orderingClosed ? (
                <Badge variant="destructive" className="shrink-0">Orders closed</Badge>
              ) : (
                <Badge variant="success" className="shrink-0">
                  <span className="mr-1 size-2 rounded-full bg-success" /> Taking orders
                </Badge>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {kitchen.delivery_radius_note && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {kitchen.delivery_radius_note}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> Order by{' '}
                {formatTime(kitchen.order_cutoff_time)} the day before
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Menu date banner */}
      <div className="container mt-5">
        <div className="flex items-center gap-2 rounded-xl bg-accent/15 px-4 py-3 text-sm font-medium text-accent-foreground">
          <Sparkles className="size-4 text-accent" />
          Tomorrow’s Chef’s Menu · <span className="font-bold">{menuDateLabel}</span>
        </div>
      </div>

      {orderingClosed && hasMenu && (
        <div className="container mt-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            Orders for this menu are now closed
            {cutoffLabel ? ` (cut-off ${cutoffLabel} the day before).` : '.'} Please
            check the WhatsApp group for the next update.
          </div>
        </div>
      )}

      {!hasMenu ? (
        <div className="container mt-16 text-center">
          <p className="text-lg font-semibold">
            Tomorrow’s menu has not been published yet.
          </p>
          <p className="mt-1 text-muted-foreground">
            Please check the WhatsApp group for the next update.
          </p>
        </div>
      ) : (
        <>
          {/* Sticky category rail */}
          <nav className="sticky top-0 z-20 mt-4 border-b bg-background/90 backdrop-blur">
            <div className="container no-scrollbar flex gap-2 overflow-x-auto py-3">
              {grouped.map(([cat]) => (
                <button
                  key={cat}
                  onClick={() => scrollToCat(cat)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    activeCat === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </nav>

          <main className="container space-y-8 py-6">
            {grouped.map(([cat, list]) => (
              <section key={cat} id={`cat-${cat}`} className="scroll-mt-16">
                <h2 className="mb-3 font-display text-xl font-bold">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((item) => (
                    <ProductCard
                      key={item.menu_item_id}
                      item={item}
                      variants={variantsByProduct[item.product_id] ?? []}
                    />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </>
      )}

      {/* Sticky cart bar */}
      {count > 0 && !orderingClosed && (
        <div className="fixed inset-x-0 bottom-0 z-30 safe-bottom">
          <div className="container pb-3">
            <Button
              size="lg"
              className="w-full justify-between shadow-xl"
              onClick={() => router.push(`${checkoutBase}/checkout`)}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="size-5" />
                {count} item{count > 1 ? 's' : ''}
              </span>
              <span>Checkout · {formatPaise(totalPaise)}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}
