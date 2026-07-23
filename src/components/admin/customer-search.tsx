'use client';

import { useMemo, useState } from 'react';
import { Search, Phone, MapPin, Heart, Repeat } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPaise } from '@/lib/money';
import { prettyDate } from '@/lib/format';
import type { CustomerRow } from '@/app/admin/customers/page';

export function CustomerSearch({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.flat_number ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, phone or flat"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Phone className="size-3.5" /> {r.phone}
                    </a>
                    {(r.flat_number || r.tower) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {[r.tower, r.flat_number].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                {r.orderCount > 1 && (
                  <Badge variant="success">
                    <Repeat className="mr-1 size-3" /> Repeat
                  </Badge>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Orders" value={String(r.orderCount)} />
                <Stat label="Spent" value={formatPaise(r.totalSpentPaise)} />
                <Stat label="Last" value={r.lastOrder ? prettyDate(r.lastOrder) : '—'} />
              </div>

              {r.favourite && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <Heart className="size-3.5" /> Favourite: {r.favourite}
                </p>
              )}
              {r.notes && <p className="mt-2 text-xs text-muted-foreground">📝 {r.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-2">
      <p className="text-sm font-bold leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
