import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { buildUpiLink } from '@/lib/ordering';
import { PaymentPanel } from '@/components/customer/payment-panel';

interface Props {
  kitchenName: string;
  upiId: string | null;
  upiDisplayName: string | null;
  whatsappNumber: string | null;
  orderNumber: string;
  totalPaise: number;
  /** Where "Back to menu" returns to. */
  backHref: string;
}

/**
 * Order confirmation + UPI instructions. Shared by both the `/order` public
 * route and the multi-tenant `/k/[slug]` route. Generates a UPI-intent QR
 * server-side (amount pre-filled) — falls back to NEXT_PUBLIC_UPI_QR_URL.
 */
export async function OrderSuccess({
  kitchenName,
  upiId,
  upiDisplayName,
  whatsappNumber,
  orderNumber,
  totalPaise,
  backHref,
}: Props) {
  let qrDataUrl: string | null = process.env.NEXT_PUBLIC_UPI_QR_URL ?? null;
  if (!qrDataUrl && upiId) {
    try {
      const link = buildUpiLink({
        upiId,
        payeeName: upiDisplayName ?? kitchenName,
        amountRupees: paiseToRupees(totalPaise),
        note: `Order ${orderNumber}`,
      });
      qrDataUrl = await QRCode.toDataURL(link, { margin: 1, width: 320 });
    } catch {
      qrDataUrl = null;
    }
  }

  return (
    <div className="container flex min-h-dvh flex-col items-center justify-center py-12">
      <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-10" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">Order placed!</h1>
      <p className="mt-1 text-center text-muted-foreground">
        Thank you for ordering from {kitchenName}.
      </p>

      <Card className="mt-6 w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Order number</span>
            <span className="font-mono text-lg font-bold">{orderNumber}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Amount to pay</span>
            <span className="text-lg font-bold">{formatPaise(totalPaise)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Payment status</span>
            <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Payment pending
            </span>
          </div>

          <PaymentPanel
            upiId={upiId}
            payeeName={upiDisplayName}
            whatsappNumber={whatsappNumber}
            orderNumber={orderNumber}
            totalPaise={totalPaise}
            qrDataUrl={qrDataUrl}
          />
        </CardContent>
      </Card>

      <div className="mt-6 w-full max-w-md">
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href={backHref}>Back to menu</Link>
        </Button>
      </div>
    </div>
  );
}
