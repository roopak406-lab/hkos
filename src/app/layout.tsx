import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HKOS — Home Kitchen Operating System',
  description:
    'The operating system for home kitchens. Publish tomorrow’s menu, take orders, run your kitchen.',
  applicationName: 'HKOS',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HKOS' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#17482f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>{children}</body>
    </html>
  );
}
