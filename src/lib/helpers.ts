import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A story-point total as a panel header or a report headline shows it: whole totals read as whole
 * numbers — "13", not "13.0" — while a half-point estimate still shows up rather than being rounded
 * away. Shared by the backlog's panels and the sprint report, which must agree about arithmetic.
 */
export function formatPointTotal(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1)
}
