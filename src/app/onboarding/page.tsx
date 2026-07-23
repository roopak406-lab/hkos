import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Shown when a signed-in user has no kitchen membership yet. In the current
 * pilot, the owner is linked to Aromatic Tadka Kitchen via seed.sql. This page
 * is the hook for future self-serve kitchen creation (multi-tenant sign-up).
 */
export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ChefHat className="size-6" />
          </div>
          <CardTitle className="font-display text-2xl">Almost there</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your account isn’t linked to a kitchen yet. Ask your administrator to
            add you, or (in the pilot) run the link step in{' '}
            <code className="rounded bg-secondary px-1">supabase/seed.sql</code>.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
