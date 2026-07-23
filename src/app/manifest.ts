import type { MetadataRoute } from 'next';

/** PWA manifest served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HKOS — Home Kitchen Operating System',
    short_name: 'HKOS',
    description: 'Run your home kitchen: menu, orders, kitchen, finance.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f3e8',
    theme_color: '#17482f',
    icons: [
      { src: '/brand/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
