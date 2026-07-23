import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { env } from '@/lib/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Hosts whose ROOT (`/`) should land directly on the customer ordering page.
 * Any host whose first label is `order` (e.g. order.aromatictadkakitchen.in)
 * matches automatically; extra hosts can be listed in NEXT_PUBLIC_CUSTOMER_HOSTS
 * (comma-separated).
 */
function isCustomerHost(host: string): boolean {
  const bare = host.split(':')[0].toLowerCase();
  if (bare.split('.')[0] === 'order') return true;
  return (process.env.NEXT_PUBLIC_CUSTOMER_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .includes(bare);
}

/**
 * Refreshes the Supabase session cookie on every request and guards /admin.
 * Unauthenticated visitors to /admin are redirected to /login. On the
 * customer-facing host, `/` redirects straight to `/order`.
 */
export async function middleware(request: NextRequest) {
  // Customer host: send the bare domain root to the ordering page.
  if (
    request.nextUrl.pathname === '/' &&
    isCustomerHost(request.headers.get('host') ?? '')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/order';
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/login'],
};
