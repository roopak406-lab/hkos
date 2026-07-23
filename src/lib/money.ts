/**
 * Money helpers. HKOS stores all amounts as integer PAISE to avoid floating
 * point drift. UI works in rupees; the DB works in paise.
 */

export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

/** Format paise as an Indian-rupee string, e.g. 16900 => "₹169". */
export function formatPaise(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(rupees);
}
