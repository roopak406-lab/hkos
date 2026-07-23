'use client';

import { useEffect, useRef, useState } from 'react';
import { ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Pixel size of the square logo. */
  size?: number;
  className?: string;
  /** Path to the emblem PNG (defaults to the bundled brand asset). */
  src?: string;
  alt?: string;
}

/**
 * The Aromatic Tadka Kitchen emblem. Renders the brand PNG at
 * `public/brand/logo.png`; if that file is missing it falls back to a
 * green ChefHat badge so the UI never shows a broken image.
 */
export function BrandLogo({
  size = 40,
  className,
  src = '/brand/logo.png',
  alt = 'Aromatic Tadka Kitchen',
}: Props) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The image can 404 during SSR before React attaches onError (the handler
  // then never fires). On mount, detect an already-broken image and fall back.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (failed) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-primary text-primary-foreground',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <ChefHat style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('rounded-full object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}
