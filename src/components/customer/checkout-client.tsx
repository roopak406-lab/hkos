'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { formatPaise } from '@/lib/money';
import { useCart, selectCartTotalPaise } from '@/stores/cart';
import type { DeliverySlot, Kitchen } from '@/lib/database.types';

const formSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name'),
  phone: z.string().trim().regex(/^(\+?91)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile'),
  flatNumber: z.string().trim().min(1, 'Flat number is required'),
  tower: z.string().trim().optional(),
  deliverySlotId: z.string().uuid('Pick a delivery slot'),
  specialInstructions: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  kitchen: Kitchen;
  slots: DeliverySlot[];
  menuDate: string;
  menuDateLabel: string;
  /** URL base (default `/k/<slug>`; `/order` for the public link). */
  basePath?: string;
}

export function CheckoutClient({
  kitchen,
  slots,
  menuDate,
  menuDateLabel,
  basePath,
}: Props) {
  const router = useRouter();
  const base = basePath ?? `/k/${kitchen.slug}`;
  const lines = useCart((s) => s.lines);
  const setQtyByKey = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const totalPaise = useCart(selectCartTotalPaise);
  const [serverError, setServerError] = useState<string | null>(null);

  const cartArr = Object.entries(lines);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { deliverySlotId: slots[0]?.id },
  });

  const selectedSlot = watch('deliverySlotId');

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const items = Object.values(lines).map((l) => ({
      product_id: l.productId,
      variant_id: l.variantId,
      quantity: l.quantity,
      note: '',
    }));

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kitchenId: kitchen.id,
        deliveryDate: menuDate,
        deliverySlotId: values.deliverySlotId,
        customer: {
          name: values.name,
          phone: values.phone,
          flatNumber: values.flatNumber,
          tower: values.tower ?? '',
        },
        items,
        specialInstructions: values.specialInstructions ?? '',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setServerError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    clear();
    const params = new URLSearchParams({
      n: data.order_number,
      t: String(data.total_paise),
    });
    router.push(`${base}/success?${params}`);
  };

  if (cartArr.length === 0) {
    return (
      <div className="container flex min-h-dvh flex-col items-center justify-center text-center">
        <p className="text-lg font-semibold">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => router.push(base)}>
          Browse the menu
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="container flex items-center gap-3 py-4">
          <Button size="icon" variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="font-display text-lg font-bold leading-none">Checkout</h1>
            <p className="text-xs text-muted-foreground">Delivery {menuDateLabel}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="container space-y-5 py-5">
        {/* Order summary */}
        <Card>
          <CardContent className="divide-y p-0">
            {cartArr.map(([key, line]) => (
              <div key={key} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium leading-tight">{line.productName}</p>
                  {line.variantName && (
                    <p className="text-xs text-muted-foreground">{line.variantName}</p>
                  )}
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatPaise(line.unitPricePaise)} × {line.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-secondary px-1">
                  <Button type="button" size="icon" variant="ghost" className="size-7"
                    onClick={() => setQtyByKey(key, line.quantity - 1)}>–</Button>
                  <span className="min-w-4 text-center text-sm font-bold">{line.quantity}</span>
                  <Button type="button" size="icon" variant="ghost" className="size-7"
                    onClick={() => setQtyByKey(key, line.quantity + 1)}
                    disabled={line.maxQty !== null && line.quantity >= line.maxQty}>+</Button>
                </div>
                <span className="w-16 text-right font-semibold">
                  {formatPaise(line.unitPricePaise * line.quantity)}
                </span>
                <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground"
                  onClick={() => remove(key)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery slot */}
        <div>
          <Label className="mb-2 block">Delivery slot</Label>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setValue('deliverySlotId', s.id, { shouldValidate: true })}
                className={`rounded-xl border p-3 text-center transition-colors ${
                  selectedSlot === s.id
                    ? 'border-primary bg-primary/10'
                    : 'border-input'
                }`}
              >
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </span>
              </button>
            ))}
          </div>
          {errors.deliverySlotId && (
            <p className="mt-1 text-xs text-destructive">{errors.deliverySlotId.message}</p>
          )}
        </div>

        {/* Customer details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name?.message}>
            <Input placeholder="e.g. Priya Sharma" {...register('name')} />
          </Field>
          <Field label="Mobile number" error={errors.phone?.message}>
            <Input inputMode="numeric" placeholder="10-digit mobile" {...register('phone')} />
          </Field>
          <Field label="Flat number" error={errors.flatNumber?.message}>
            <Input placeholder="e.g. 1203" {...register('flatNumber')} />
          </Field>
          <Field label="Tower / Block" error={errors.tower?.message}>
            <Input placeholder="e.g. Tower B" {...register('tower')} />
          </Field>
        </div>

        <Field label="Special instructions (optional)">
          <Input placeholder="Less spicy, no onion…" {...register('specialInstructions')} />
        </Field>

        {/* UPI note */}
        {kitchen.upi_id && (
          <div className="rounded-xl bg-accent/10 p-4 text-sm">
            <p className="font-semibold">Pay on delivery via UPI</p>
            <p className="mt-1 text-muted-foreground">
              After you place the order, pay{' '}
              <span className="font-semibold text-foreground">{formatPaise(totalPaise)}</span> to{' '}
              <span className="font-mono font-semibold text-foreground">{kitchen.upi_id}</span>{' '}
              ({kitchen.upi_display_name}). Share the UPI reference on delivery.
            </p>
          </div>
        )}

        {serverError && (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {serverError}
          </p>
        )}

        {/* Sticky place-order bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur safe-bottom">
          <div className="container flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total to pay</p>
              <p className="text-xl font-bold">{formatPaise(totalPaise)}</p>
            </div>
            <Button type="submit" size="lg" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : 'Place order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
