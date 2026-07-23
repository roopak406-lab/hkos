import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Kitchen, UserRole } from '@/lib/database.types';

export interface CurrentContext {
  userId: string;
  email: string | null;
  kitchen: Kitchen;
  role: UserRole;
}

/**
 * Resolves the logged-in user and their (first) kitchen. Redirects to /login
 * if unauthenticated, or to /onboarding if the user has no kitchen yet.
 * This is the single entry point every admin server component uses.
 */
export async function requireKitchen(): Promise<CurrentContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('kitchen_users')
    .select('role, kitchen_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect('/onboarding');

  const { data: kitchen } = await supabase
    .from('kitchens')
    .select('*')
    .eq('id', membership.kitchen_id)
    .maybeSingle();

  if (!kitchen) redirect('/onboarding');

  return {
    userId: user.id,
    email: user.email ?? null,
    kitchen: kitchen as Kitchen,
    role: membership.role,
  };
}
