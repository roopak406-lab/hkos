'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check, Upload, Clock, IndianRupee, Bell, DoorOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateKitchenSettings } from '@/app/admin/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Kitchen } from '@/lib/database.types';

type OrderingStatus = 'auto' | 'open' | 'closed';

const ORDERING_OPTIONS: { value: OrderingStatus; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatic', hint: 'Follow the cut-off time below' },
  { value: 'open', label: 'Keep open', hint: 'Always accept orders' },
  { value: 'closed', label: 'Stop orders', hint: 'Pause all ordering now' },
];

export function SettingsClient({ kitchen }: { kitchen: Kitchen }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [orderingStatus, setOrderingStatus] = useState<OrderingStatus>(kitchen.ordering_status);
  const [cutoff, setCutoff] = useState(kitchen.order_cutoff_time.slice(0, 5));
  const [upiId, setUpiId] = useState(kitchen.upi_id ?? '');
  const [upiName, setUpiName] = useState(kitchen.upi_display_name ?? '');
  const [email, setEmail] = useState(kitchen.notification_email ?? '');
  const [qrUrl, setQrUrl] = useState(kitchen.upi_qr_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateKitchenSettings({
          orderCutoffTime: cutoff,
          orderingStatus,
          upiId,
          upiDisplayName: upiName,
          notificationEmail: email,
          upiQrUrl: qrUrl || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save');
      }
    });
  };

  const onQrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `${kitchen.id}/upi-qr-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('kitchen-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('kitchen-assets').getPublicUrl(path);
      setQrUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Ordering, payments &amp; notifications.</p>
        </div>
        <Button onClick={save} disabled={pending || uploading}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <><Check className="size-4" /> Saved</> : 'Save changes'}
        </Button>
      </div>

      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
      )}

      {/* Ordering control */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <DoorOpen className="size-5 text-primary" />
          <CardTitle>Ordering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Order acceptance</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {ORDERING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOrderingStatus(o.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    orderingStatus === o.value ? 'border-primary bg-primary/10' : 'border-input'
                  }`}
                >
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-xs">
            <Label className="mb-1.5 block">
              <Clock className="mr-1 inline size-3.5" /> Cut-off time (the day before delivery)
            </Label>
            <Input type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Only used when acceptance is set to “Automatic”. Timezone: {kitchen.timezone}.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <IndianRupee className="size-5 text-primary" />
          <CardTitle>UPI payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">UPI ID</Label>
              <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
            </div>
            <div>
              <Label className="mb-1.5 block">Payee name (shown to customer)</Label>
              <Input value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="Aromatic Tadka Kitchen" />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Your UPI QR image (optional)</Label>
            <div className="flex items-center gap-4">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="UPI QR" className="size-24 rounded-lg border bg-white object-contain p-1" />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  No image
                </div>
              )}
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-medium hover:bg-secondary">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading ? 'Uploading…' : 'Upload QR'}
                  <input type="file" accept="image/*" className="hidden" onChange={onQrFile} disabled={uploading} />
                </label>
                {qrUrl && (
                  <button
                    type="button"
                    onClick={() => setQrUrl('')}
                    className="ml-2 text-sm text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  If left empty, a QR with the exact amount is auto-generated from your UPI ID.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Bell className="size-5 text-primary" />
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-md">
            <Label className="mb-1.5 block">Email for new-order alerts</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              An email is sent here on every new order (requires the RESEND_API_KEY to be set on the server).
            </p>
          </div>
          <Badge variant="secondary">In-app alerts are always on while the dashboard is open</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
