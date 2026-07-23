import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner used across all UI primitives. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
