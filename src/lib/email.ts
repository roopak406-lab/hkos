import { formatPaise } from '@/lib/money';

interface OrderEmail {
  to: string;
  kitchenName: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  flat: string | null;
  tower: string | null;
  totalPaise: number;
  deliveryDate: string;
  items: { quantity: number; product_name: string; variant_name: string | null }[];
}

/**
 * Sends a new-order email to the owner via Resend. Best-effort: no-ops when
 * RESEND_API_KEY is unset and never throws (email must not break checkout).
 * Set RESEND_API_KEY and (optionally) EMAIL_FROM on the server.
 */
export async function sendOrderEmail(opts: OrderEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !opts.to) return;

  const from = process.env.EMAIL_FROM ?? 'HKOS Orders <onboarding@resend.dev>';
  const itemsHtml = opts.items
    .map(
      (i) =>
        `<li>${i.quantity} × ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}</li>`,
    )
    .join('');
  const address = [opts.tower, opts.flat].filter(Boolean).join(', ');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">New order · ${opts.orderNumber}</h2>
      <p style="color:#555;margin:0 0 16px">${opts.kitchenName}</p>
      <p><strong>${opts.customerName}</strong> — ${opts.phone}<br/>
         ${address || ''}<br/>
         Delivery: ${opts.deliveryDate}</p>
      <ul>${itemsHtml}</ul>
      <p style="font-size:18px"><strong>Total: ${formatPaise(opts.totalPaise)}</strong> (payment pending)</p>
    </div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `New order ${opts.orderNumber} — ${formatPaise(opts.totalPaise)}`,
        html,
      }),
    });
  } catch {
    /* swallow — a failed notification must never fail the order */
  }
}
