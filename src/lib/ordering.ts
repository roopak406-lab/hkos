/**
 * Ordering-window helpers. Cut-off is enforced in the kitchen's own timezone
 * (Asia/Kolkata for the pilot) so behaviour is correct regardless of where the
 * server runs. Used by both the public page (to show a closed state) and the
 * order API (defence in depth).
 */

/** The kitchen slug the bare `/order` route resolves to (single-kitchen pilot). */
export const DEFAULT_KITCHEN_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_KITCHEN_SLUG ?? 'aromatic-tadka';

/** Current wall-clock in a timezone as a sortable 'YYYY-MM-DDTHH:mm' string. */
function wallClock(tz: string, at: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Today's date ('YYYY-MM-DD') in a given timezone. */
export function todayInTz(tz: string, at: Date = new Date()): string {
  return wallClock(tz, at).slice(0, 10);
}

/** Subtract one day from a 'YYYY-MM-DD' date string (timezone-agnostic). */
function previousDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export interface OrderingWindow {
  closed: boolean;
  /** 'HH:mm' cut-off time shown to the customer. */
  cutoffLabel: string;
  /** Reason ordering is closed, when applicable. */
  reason?: 'cutoff' | 'manual';
}

export type OrderingStatus = 'auto' | 'open' | 'closed';

/**
 * Ordering for a delivery `menuDate` closes at `cutoffTime` on the PREVIOUS day
 * (e.g. 18:00 the day before), evaluated in `tz`. An `override` set by the owner
 * can force ordering open or closed regardless of the cut-off.
 */
export function getOrderingWindow(
  menuDate: string,
  cutoffTime: string,
  tz: string,
  override: OrderingStatus = 'auto',
): OrderingWindow {
  const cutoffHm = cutoffTime.slice(0, 5); // 'HH:mm'
  if (override === 'open') return { closed: false, cutoffLabel: cutoffHm };
  if (override === 'closed') {
    return { closed: true, cutoffLabel: cutoffHm, reason: 'manual' };
  }
  const cutoffMoment = `${previousDay(menuDate)}T${cutoffHm}`;
  const nowMoment = wallClock(tz);
  const closed = nowMoment >= cutoffMoment;
  return { closed, cutoffLabel: cutoffHm, reason: closed ? 'cutoff' : undefined };
}

/** Build a UPI intent deep link (scanned by any UPI app, pre-fills amount). */
export function buildUpiLink(opts: {
  upiId: string;
  payeeName: string;
  amountRupees: number;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: opts.amountRupees.toFixed(2),
    cu: 'INR',
  });
  if (opts.note) params.set('tn', opts.note);
  return `upi://pay?${params.toString()}`;
}
