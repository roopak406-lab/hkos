import Link from 'next/link';
import { ArrowRight, Store, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';

/** Product landing page for HKOS. The pilot kitchen lives at /k/aromatic-tadka. */
export default function Home() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="container flex min-h-dvh flex-col items-center justify-center py-16 text-center">
        <BrandLogo size={96} className="mb-6 shadow-lg ring-1 ring-primary/10" />
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
          Home Kitchen Operating System
        </p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
          Run your home kitchen in under 5 minutes a day.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Publish tomorrow’s menu, take orders, auto-generate your prep list, and
          track every rupee — built for kitchens that cook, not click.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/order">
              <Store className="size-5" /> Open the ordering page
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/admin">
              <LayoutDashboard className="size-5" /> Owner dashboard
            </Link>
          </Button>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Pilot customer:{' '}
          <span className="font-semibold text-foreground">Aromatic Tadka Kitchen</span>
          {' · '}Authentic Flavours. Purely Homemade.
        </p>
      </div>
    </main>
  );
}
