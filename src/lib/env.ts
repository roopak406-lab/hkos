/**
 * Centralised, validated environment access. No secrets are hardcoded anywhere
 * else in the app — everything routes through here.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example and README.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /** Public site URL (used for share links / QR). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5210',
};

/** Server-only secret. Never import this from a client component. */
export function getServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}
