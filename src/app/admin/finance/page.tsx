import { requireKitchen } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FinanceClient } from '@/components/admin/finance-client';
import { toDateKey } from '@/lib/format';
import { startOfMonth, endOfMonth } from 'date-fns';
import type { ExpenseCategory, FinanceSummary } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();

  const now = new Date();
  const from = toDateKey(startOfMonth(now));
  const to = toDateKey(endOfMonth(now));

  const [{ data: summary }, { data: categories }, { data: recent }] = await Promise.all([
    supabase.rpc('finance_summary', { p_kitchen_id: kitchen.id, p_from: from, p_to: to }),
    supabase
      .from('expense_categories')
      .select('*')
      .eq('kitchen_id', kitchen.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('expenses')
      .select('*, expense_categories(name)')
      .eq('kitchen_id', kitchen.id)
      .is('deleted_at', null)
      .order('spent_on', { ascending: false })
      .limit(15),
  ]);

  return (
    <FinanceClient
      summary={(summary ?? {}) as FinanceSummary}
      categories={(categories ?? []) as ExpenseCategory[]}
      recentExpenses={(recent ?? []) as never[]}
      monthLabel={now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
    />
  );
}
