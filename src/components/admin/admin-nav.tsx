'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  ChefHat,
  Wallet,
  Users,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/kitchen', label: 'Kitchen', icon: ChefHat },
  { href: '/admin/finance', label: 'Finance', icon: Wallet },
  { href: '/admin/customers', label: 'Customers', icon: Users },
];

export function AdminNav({
  kitchenName,
  slug,
  email,
}: {
  kitchenName: string;
  slug: string;
  email: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={38} />
            <div className="leading-tight">
              <p className="text-sm font-bold">{kitchenName}</p>
              <p className="text-xs text-muted-foreground">HKOS Admin</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive(item.href, item.exact)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href={`/k/${slug}`}
              target="_blank"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary sm:inline-flex"
              title="Open customer page"
            >
              <ExternalLink className="size-4" /> Storefront
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
              title={email ?? 'Sign out'}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden safe-bottom">
        <div className="grid grid-cols-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive(item.href, item.exact) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
