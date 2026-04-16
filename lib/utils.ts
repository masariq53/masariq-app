import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Iraqi Dinar amount: integer with comma separator, no decimal points.
 * Examples: 1000 → "1,000", 50000 → "50,000", 100 → "100"
 */
export function formatIQD(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const num = Math.round(Number(value));
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-US");
}
