'use client';

import { useState, useTransition } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Plus, Loader2, IndianRupee, TrendingUp, Wallet } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/admin/stat-card';
import { formatPaise, paiseToRupees } from '@/lib/money';
import { toDateKey } from '@/lib/format';
import { addExpense } from '@/app/admin/actions';
import type { ExpenseCategory, FinanceSummary } from '@/lib/database.types';

interface RecentExpense {
  id: string;
  amount_paise: number;
  note: string | null;
  spent_on: string;
  expense_categories: { name: string } | null;
}

interface Props {
  summary: FinanceSummary;
  categories: ExpenseCategory[];
  recentExpenses: RecentExpense[];
  monthLabel: string;
}

export function FinanceClient({ summary, categories, recentExpenses, monthLabel }: Props) {
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [spentOn, setSpentOn] = useState(toDateKey());
  const [error, setError] = useState<string | null>(null);

  const revenue = summary.revenue_paise ?? 0;
  const expenses = summary.expenses_paise ?? 0;
  const profit = revenue - expenses;

  const chartData = (summary.daily ?? []).map((d) => ({
    day: format(parseISO(d.day), 'd'),
    Revenue: paiseToRupees(d.revenue_paise),
    Expenses: paiseToRupees(d.expense_paise),
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!categoryId || !amt || amt <= 0) {
      setError('Pick a category and enter an amount.');
      return;
    }
    startTransition(async () => {
      await addExpense({ expenseCategoryId: categoryId, amount: amt, note, spentOn });
      setAmount('');
      setNote('');
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Finance</h1>
        <p className="text-muted-foreground">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Revenue" value={formatPaise(revenue)} icon={IndianRupee} tone="success" />
        <StatCard label="Expenses" value={formatPaise(expenses)} icon={Wallet} tone="warning" />
        <StatCard
          label="Profit"
          value={formatPaise(profit)}
          icon={TrendingUp}
          tone={profit >= 0 ? 'success' : 'warning'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses · {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: number) => `₹${v}`}
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="Revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Add expense */}
        <Card>
          <CardHeader>
            <CardTitle>Log an expense</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Category</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                        categoryId === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-input'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Amount (₹)</Label>
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Date</Label>
                  <Input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Note (optional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Vegetables from mandi" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Add expense</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Category breakdown + recent */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>By category</CardTitle>
            </CardHeader>
            <CardContent>
              {(summary.by_expense_category ?? []).filter((c) => c.amount_paise > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses logged this month.</p>
              ) : (
                <ul className="divide-y">
                  {(summary.by_expense_category ?? [])
                    .filter((c) => c.amount_paise > 0)
                    .map((c) => (
                      <li key={c.name} className="flex justify-between py-2 text-sm">
                        <span>{c.name}</span>
                        <span className="font-semibold">{formatPaise(c.amount_paise)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
              ) : (
                <ul className="divide-y">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{e.expense_categories?.name ?? 'Expense'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(e.spent_on), 'd MMM')}
                          {e.note ? ` · ${e.note}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold">{formatPaise(e.amount_paise)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
