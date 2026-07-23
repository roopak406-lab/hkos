'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Check, Copy, Loader2, Rocket, MessageCircle, PlusCircle, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { publishMenu, saveProduct } from '@/app/admin/actions';
import type { Category, Product, DailyMenuItem, Kitchen } from '@/lib/database.types';

interface Selection {
  selected: boolean;
  price: string; // rupees, empty = use default
  qty: string; // empty = unlimited
}

interface Props {
  kitchen: Kitchen;
  categories: Category[];
  products: Product[];
  existingItems: DailyMenuItem[];
  published: boolean;
  menuDate: string;
  menuDateLabel: string;
  today: string;
  upcomingDates: string[];
}

export function MenuPlanner({
  kitchen,
  categories,
  products,
  existingItems,
  published,
  menuDate,
  menuDateLabel,
  today,
  upcomingDates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const goToDate = (d: string) => {
    if (d) router.push(`/admin/menu?date=${d}`);
  };

  // Seed selection state from any existing published menu.
  const [sel, setSel] = useState<Record<string, Selection>>(() => {
    const map: Record<string, Selection> = {};
    const byProduct = new Map(existingItems.map((i) => [i.product_id, i]));
    for (const p of products) {
      const existing = byProduct.get(p.id);
      map[p.id] = {
        selected: !!existing || p.is_always_available,
        price:
          existing?.price_override_paise != null
            ? String(paiseToRupees(existing.price_override_paise))
            : '',
        qty: existing?.available_qty != null ? String(existing.available_qty) : '',
      };
    }
    return map;
  });

  const toggle = (id: string) =>
    setSel((s) => ({ ...s, [id]: { ...s[id], selected: !s[id].selected } }));
  const patch = (id: string, key: keyof Selection, value: string) =>
    setSel((s) => ({ ...s, [id]: { ...s[id], [key]: value } }));

  const selectedProducts = products.filter((p) => sel[p.id]?.selected);
  const selectedCount = selectedProducts.length;

  const priceFor = (p: Product) => {
    const override = sel[p.id]?.price;
    return override ? Number(override) * 100 : p.default_price_paise;
  };

  const whatsappText = useMemo(() => {
    const lines = [`*${kitchen.name}*`, `_Menu for ${menuDateLabel}_`, ''];
    for (const c of categories) {
      const items = selectedProducts.filter((p) => p.category_id === c.id);
      if (!items.length) continue;
      lines.push(`*${c.name}*`);
      for (const p of items) lines.push(`• ${p.name} — ${formatPaise(priceFor(p))}`);
      lines.push('');
    }
    lines.push(`Order before ${kitchen.order_cutoff_time?.slice(0, 5)} the day before 🍽️`);
    lines.push(`👉 ${location.origin}/order`);
    return lines.join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts, categories, kitchen, menuDateLabel]);

  const doPublish = () => {
    const selections = selectedProducts.map((p) => ({
      productId: p.id,
      priceOverride: sel[p.id].price ? Number(sel[p.id].price) : null,
      qty: sel[p.id].qty ? Number(sel[p.id].qty) : null,
    }));
    startTransition(() => publishMenu(menuDate, selections));
  };

  const copyWhatsapp = async () => {
    await navigator.clipboard.writeText(whatsappText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Plan the menu</h1>
          <p className="text-muted-foreground">
            {menuDateLabel} · {published ? 'Published' : 'Not published yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAdd((v) => !v)}>
            <PlusCircle className="size-4" /> New product
          </Button>
        </div>
      </div>

      {/* Calendar / date picker */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" /> Menu date
            <Input
              type="date"
              className="h-10 w-auto"
              value={menuDate}
              min={today}
              onChange={(e) => goToDate(e.target.value)}
            />
          </label>
          {upcomingDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Published:</span>
              {upcomingDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => goToDate(d)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    d === menuDate ? 'border-primary bg-primary/10 text-primary' : 'border-input'
                  }`}
                >
                  {format(parseISO(d), 'EEE d MMM')}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && <AddProduct categories={categories} onDone={() => setShowAdd(false)} />}

      {/* Product selection grouped by category */}
      <div className="space-y-5">
        {categories.map((c) => {
          const items = products.filter((p) => p.category_id === c.id);
          if (!items.length) return null;
          return (
            <Card key={c.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 py-4">
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <Badge variant="secondary">
                  {items.filter((p) => sel[p.id]?.selected).length}/{items.length} selected
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((p) => {
                  const s = sel[p.id];
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                        s?.selected ? 'border-primary/40 bg-primary/5' : 'border-input'
                      }`}
                    >
                      <button
                        onClick={() => toggle(p.id)}
                        className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                          s?.selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                        }`}
                      >
                        {s?.selected && <Check className="size-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {p.name}
                          {p.is_always_available && (
                            <Badge variant="success" className="ml-2 align-middle">Always</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Default {formatPaise(p.default_price_paise)}
                        </p>
                      </div>
                      {s?.selected && (
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              placeholder="Price ₹"
                              value={s.price}
                              onChange={(e) => patch(p.id, 'price', e.target.value)}
                            />
                          </div>
                          <div className="w-20">
                            <Input
                              className="h-9"
                              inputMode="numeric"
                              placeholder="Qty"
                              value={s.qty}
                              onChange={(e) => patch(p.id, 'qty', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp preview */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <MessageCircle className="size-5 text-success" />
          <CardTitle>WhatsApp menu message</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-xl bg-secondary/60 p-4 text-sm">
            {whatsappText}
          </pre>
          <Button variant="outline" className="mt-3" onClick={copyWhatsapp}>
            {copied ? <><Check className="size-4" /> Copied!</> : <><Copy className="size-4" /> Copy message</>}
          </Button>
        </CardContent>
      </Card>

      {/* Sticky publish bar */}
      <div className="sticky bottom-16 z-20 md:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur">
          <div className="flex-1 pl-2">
            <p className="text-sm font-semibold">{selectedCount} items selected</p>
            <p className="text-xs text-muted-foreground">Live for {menuDateLabel}</p>
          </div>
          <Button size="lg" onClick={doPublish} disabled={pending || selectedCount === 0}>
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <><Rocket className="size-5" /> {published ? 'Update menu' : 'Publish menu'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddProduct({ categories, onDone }: { categories: Category[]; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    startTransition(async () => {
      await saveProduct({
        name,
        categoryId,
        defaultPrice: Number(price),
        description,
      });
      onDone();
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>New product</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Default price ₹" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select
            className="h-12 rounded-xl border border-input bg-background px-3 text-base"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : 'Save product'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
