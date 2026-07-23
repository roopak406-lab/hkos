import { requireKitchen } from '@/lib/auth';
import { SettingsClient } from '@/components/admin/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { kitchen } = await requireKitchen();
  return <SettingsClient kitchen={kitchen} />;
}
