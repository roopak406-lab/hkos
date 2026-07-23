'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireKitchen } from '@/lib/auth';
import { rupeesToPaise } from '@/lib/money';
import type { Kitchen, Order, OrderStatus } from '@/lib/database.types';

/**
 * All admin mutations. Every call re-resolves the current kitchen and relies on
 * RLS to guarantee the user can only touch their own kitchen's rows.
 */

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch: Partial<Order> = { status };
  if (status === 'accepted') patch.accepted_at = now;
  else if (status === 'ready') patch.ready_at = now;
  else if (status === 'delivered') patch.delivered_at = now;
  else if (status === 'cancelled') patch.cancelled_at = now;
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/orders');
  revalidatePath('/admin/kitchen');
  revalidatePath('/admin');
}

export async function markOrderPaid(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/orders');
}

/**
 * Publish (or update) a menu for a date. `selections` is a list of product ids
 * with optional per-day price override + batch cap. Wipes items not selected.
 */
export async function publishMenu(
  menuDate: string,
  selections: { productId: string; priceOverride?: number | null; qty?: number | null }[],
  notes?: string,
) {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();

  // Upsert the daily_menu row.
  const { data: menu, error: menuErr } = await supabase
    .from('daily_menus')
    .upsert(
      {
        kitchen_id: kitchen.id,
        menu_date: menuDate,
        status: 'published',
        notes: notes ?? null,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'kitchen_id,menu_date' },
    )
    .select('id')
    .single();
  if (menuErr) throw new Error(menuErr.message);

  const menuId = menu.id;
  const selectedIds = selections.map((s) => s.productId);

  // Remove de-selected items (only if none sold — protect history).
  await supabase
    .from('daily_menu_items')
    .delete()
    .eq('daily_menu_id', menuId)
    .eq('sold_qty', 0)
    .not('product_id', 'in', `(${selectedIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);

  // Upsert selected items.
  for (const s of selections) {
    await supabase.from('daily_menu_items').upsert(
      {
        daily_menu_id: menuId,
        product_id: s.productId,
        price_override_paise:
          s.priceOverride != null ? rupeesToPaise(s.priceOverride) : null,
        available_qty: s.qty ?? null,
        is_available: true,
      },
      { onConflict: 'daily_menu_id,product_id' },
    );
  }

  revalidatePath('/admin/menu');
  revalidatePath('/admin');
  revalidatePath(`/k/${kitchen.slug}`);
}

export async function addExpense(input: {
  expenseCategoryId: string;
  amount: number;
  note?: string;
  spentOn: string;
}) {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').insert({
    kitchen_id: kitchen.id,
    expense_category_id: input.expenseCategoryId,
    amount_paise: rupeesToPaise(input.amount),
    note: input.note ?? null,
    spent_on: input.spentOn,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/finance');
  revalidatePath('/admin');
}

export async function saveProduct(input: {
  id?: string;
  name: string;
  categoryId: string | null;
  description?: string;
  defaultPrice: number;
  isAlwaysAvailable?: boolean;
  imageUrl?: string;
}) {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();
  const row = {
    kitchen_id: kitchen.id,
    name: input.name,
    category_id: input.categoryId,
    description: input.description || null,
    default_price_paise: rupeesToPaise(input.defaultPrice),
    is_always_available: input.isAlwaysAvailable ?? false,
    image_url: input.imageUrl || null,
  };
  const { error } = input.id
    ? await supabase.from('products').update(row).eq('id', input.id)
    : await supabase.from('products').insert(row);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/menu');
}

export async function updateKitchenSettings(input: {
  orderCutoffTime?: string;
  orderingStatus?: 'auto' | 'open' | 'closed';
  upiId?: string;
  upiDisplayName?: string;
  notificationEmail?: string;
  upiQrUrl?: string | null;
}) {
  const { kitchen } = await requireKitchen();
  const supabase = await createClient();
  const patch: Partial<Kitchen> = {};
  if (input.orderCutoffTime !== undefined) patch.order_cutoff_time = input.orderCutoffTime;
  if (input.orderingStatus !== undefined) patch.ordering_status = input.orderingStatus;
  if (input.upiId !== undefined) patch.upi_id = input.upiId || null;
  if (input.upiDisplayName !== undefined) patch.upi_display_name = input.upiDisplayName || null;
  if (input.notificationEmail !== undefined)
    patch.notification_email = input.notificationEmail || null;
  if (input.upiQrUrl !== undefined) patch.upi_qr_url = input.upiQrUrl;

  const { error } = await supabase.from('kitchens').update(patch).eq('id', kitchen.id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath(`/k/${kitchen.slug}`);
  revalidatePath('/order');
}

export async function archiveProduct(id: string, archived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ is_archived: archived })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/menu');
}
