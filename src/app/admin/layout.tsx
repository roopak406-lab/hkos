import { requireKitchen } from '@/lib/auth';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireKitchen();
  return (
    <div className="min-h-dvh bg-secondary/40">
      <AdminNav kitchenName={ctx.kitchen.name} slug={ctx.kitchen.slug} email={ctx.email} />
      <main className="container py-6 pb-24 md:pb-6">{children}</main>
    </div>
  );
}
