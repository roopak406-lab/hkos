'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPaise } from '@/lib/money';

interface Props {
  upiId: string | null;
  payeeName: string | null;
  whatsappNumber: string | null;
  orderNumber: string;
  totalPaise: number;
  /** Data-URL of the UPI-intent QR, generated server-side. */
  qrDataUrl: string | null;
}

/**
 * UPI payment instructions. Fully client-side: scan the QR (amount pre-filled)
 * or copy the UPI ID, then optionally send the payment reference to the kitchen
 * on WhatsApp. Payment is verified manually by the owner — no gateway.
 */
export function PaymentPanel({
  upiId,
  payeeName,
  whatsappNumber,
  orderNumber,
  totalPaise,
  qrDataUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [reference, setReference] = useState('');
  const [notified, setNotified] = useState(false);

  const copyUpi = async () => {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const notifyKitchen = () => {
    if (!whatsappNumber) return;
    const lines = [
      `Hi! I've made payment for order ${orderNumber}.`,
      `Amount: ${formatPaise(totalPaise)}`,
    ];
    if (reference.trim()) lines.push(`UPI reference: ${reference.trim()}`);
    const url = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
      lines.join('\n'),
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setNotified(true);
  };

  if (!upiId) return null;

  return (
    <div className="rounded-xl bg-accent/10 p-4">
      <p className="text-sm font-semibold">Pay via UPI</p>

      {qrDataUrl && (
        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`UPI QR for ${formatPaise(totalPaise)}`}
            className="size-44 rounded-lg border bg-white p-2"
          />
        </div>
      )}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Scan with any UPI app — amount {formatPaise(totalPaise)} is pre-filled.
      </p>

      {/* UPI ID + copy */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
        <span className="truncate font-mono text-sm font-semibold">{upiId}</span>
        <button
          type="button"
          onClick={copyUpi}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {payeeName && (
        <p className="mt-1 text-xs text-muted-foreground">Payable to {payeeName}.</p>
      )}

      {/* Optional reference + notify */}
      {whatsappNumber && (
        <div className="mt-4 space-y-2 border-t pt-3">
          <Label className="text-xs">UPI reference / transaction ID (optional)</Label>
          <Input
            className="h-10"
            placeholder="e.g. 4051XXXXXXX"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Button type="button" variant="success" className="w-full" onClick={notifyKitchen}>
            <MessageCircle className="size-4" />
            {notified ? 'Sent — thank you!' : "I've paid — notify the kitchen"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Payment is confirmed manually by the kitchen after it’s received.
          </p>
        </div>
      )}
    </div>
  );
}
