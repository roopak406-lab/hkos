import Link from 'next/link';
import {
  IndianRupee,
  ShoppingBag,
  Clock,
  ChefHat,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPaise } from '@/lib/money';
import { toDateKey, tomorrowKey, prettyDate } from '@/lib/format';
import type { DashboardSummary } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();

  const [{ data: dash }, { data: tomorrowMenu }] = await Promise.all([
    supabase.rpc('business_dashboard', { p_kitchen_id: kitchen.id, p_date: toDateKey() }),
    supabase
      .from('daily_menus')
      .select('id, status, menu_date, daily_menu_items(count)')
      .eq('kitchen_id', kitchen.id)
      .eq('menu_date', tomorrowKey())
      .maybeSingle(),
  ]);

  const d = (dash ?? {}) as DashboardSummary;
  const itemCount =
    (tomorrowMenu?.daily_menu_items as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
  const published = tomorrowMenu?.status === 'published';

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Good day, chef 👋</h1>
          <p className="text-muted-foreground">Here’s your kitchen at a glance.</p>
        </div>
        <Button asChild>
          <Link href="/admin/menu">Plan tomorrow’s menu</Link>
        </Button>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today’s revenue" value={formatPaise(d.revenue_today_paise ?? 0)}
          icon={IndianRupee} tone="success" />
        <StatCard label="Today’s orders" value={String(d.orders_today ?? 0)}
          icon={ShoppingBag} tone="primary" />
        <StatCard label="Pending" value={String(d.pending_orders ?? 0)}
          icon={Clock} tone="warning" hint="Awaiting your acceptance" />
        <StatCard label="Preparing" value={String(d.preparing ?? 0)} icon={ChefHat} />
        <StatCard label="Today’s profit" value={formatPaise(d.profit_today_paise ?? 0)}
          icon={TrendingUp} tone="success" hint={`Expenses ${formatPaise(d.expenses_today_paise ?? 0)}`} />
        <StatCard label="Avg order value" value={formatPaise(d.avg_order_value_paise ?? 0)}
          icon={IndianRupee} />
        <StatCard label="Best seller" value={d.best_selling ?? '—'} icon={Trophy} tone="primary" />
        <StatCard label="Repeat customers" value={String(d.repeat_customers ?? 0)} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tomorrow's menu status */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Tomorrow’s menu · {prettyDate(tomorrowKey())}</CardTitle>
            {published ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="warning">Not published</Badge>
            )}
          </CardHeader>
          <CardContent>
            {published ? (
              <p className="text-sm text-muted-foreground">
                {itemCount} item{itemCount === 1 ? '' : 's'} live on your storefront.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven’t published tomorrow’s menu yet. It takes under 2 minutes.
              </p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/menu">
                {published ? 'Edit menu' : 'Publish menu'} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Monthly snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>This month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <IndianRupee className="size-4" /> Revenue
              </span>
              <span className="font-semibold">{formatPaise(d.revenue_month_paise ?? 0)}</span>
            </div>
            <Button asChild variant="ghost" className="w-full justify-between">
              <Link href="/admin/finance">
                <span className="inline-flex items-center gap-2">
                  <Wallet className="size-4" /> Open finance
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
