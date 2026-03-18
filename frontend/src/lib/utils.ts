import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derive the current Premier League season label from today's date.
 * July onwards (month >= 6) starts the new season, e.g. "2025/26".
 */
export function getSeasonLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) return `${year}/${(year + 1).toString().slice(-2)}`;
  return `${year - 1}/${year.toString().slice(-2)}`;
}
