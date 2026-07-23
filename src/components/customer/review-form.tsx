'use client';

import { useState } from 'react';
import { Star, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  kitchenId: string;
  orderNumber: string;
}

/** Post-order rating + review. Submits to /api/reviews (one per order). */
export function ReviewForm({ kitchenId, orderNumber }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orderNumber || orderNumber === '—') return null;

  const submit = async () => {
    if (rating < 1) {
      setError('Please tap a star to rate.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchenId, orderNumber, rating, comment }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setDone(true); // already reviewed — treat as done
      return;
    }
    setError(data.error ?? 'Could not submit review.');
  };

  if (done) {
    return (
      <div className="rounded-xl bg-success/10 p-4 text-center text-sm font-medium text-success">
        <Check className="mx-auto mb-1 size-5" /> Thank you for your feedback!
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-semibold">Rate your food</p>
      <div className="mt-2 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star`}
          >
            <Star
              className={`size-8 transition-colors ${
                n <= (hover || rating) ? 'fill-accent text-accent' : 'text-muted-foreground/40'
              }`}
            />
          </button>
        ))}
      </div>
      <Input
        className="mt-3"
        placeholder="Tell us what you loved (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <Button className="mt-3 w-full" onClick={submit} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : 'Submit review'}
      </Button>
    </div>
  );
}
