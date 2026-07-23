'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPaise } from '@/lib/money';
import { useCart, cartLineKey } from '@/stores/cart';
import type { ResolvedMenuItem, ProductVariant } from '@/lib/database.types';

interface Props {
  item: ResolvedMenuItem;
  variants: ProductVariant[];
}

/** A single menu item. Handles variant choice + add/step quantity. */
export function ProductCard({ item, variants }: Props) {
  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0] ?? null;
  const [variantId, setVariantId] = useState<string | null>(defaultVariant?.id ?? null);

  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useCart((s) => s.lines);

  const activeVariant = variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = item.price_paise + (activeVariant?.price_delta_paise ?? 0);
  const key = cartLineKey(item.product_id, variantId);
  const qtyInCart = lines[key]?.quantity ?? 0;

  const soldOut = item.qty_remaining !== null && item.qty_remaining <= 0;
  const lowStock =
    item.qty_remaining !== null && item.qty_remaining > 0 && item.qty_remaining <= 5;

  const addToCart = () =>
    add(
      {
        productId: item.product_id,
        productName: item.product_name,
        variantId,
        variantName: activeVariant?.name ?? null,
        unitPricePaise: unitPrice,
        imageUrl: item.image_url,
        maxQty: item.qty_remaining,
      },
      1,
    );

  return (
    <Card className="flex overflow-hidden">
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.product_name}
          className="h-auto w-24 shrink-0 object-cover sm:w-28"
        />
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{item.product_name}</h3>
          {lowStock && <Badge variant="warning">{item.qty_remaining} left</Badge>}
          {soldOut && <Badge variant="destructive">Sold out</Badge>}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}

        {variants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  variantId === v.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-bold">{formatPaise(unitPrice)}</span>
          {qtyInCart === 0 ? (
            <Button size="sm" onClick={addToCart} disabled={soldOut}>
              <Plus className="size-4" /> Add
            </Button>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-secondary px-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setQty(key, qtyInCart - 1)}
              >
                <Minus className="size-4" />
              </Button>
              <span className="min-w-4 text-center text-sm font-bold">{qtyInCart}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setQty(key, qtyInCart + 1)}
                disabled={item.qty_remaining !== null && qtyInCart >= item.qty_remaining}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
