import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { MatchStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Svelte action that traps keyboard focus within an element.
 * Pressing Tab at the last focusable child wraps to the first;
 * Shift+Tab at the first wraps to the last. Auto-focuses the
 * first focusable element on mount.
 */
export function focusTrap(node: HTMLElement, active = true) {
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let enabled = active;

  function handleKeydown(e: KeyboardEvent) {
    if (!enabled || e.key !== 'Tab') return;
    const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function activate() {
    requestAnimationFrame(() => {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
  }

  if (enabled) activate();

  node.addEventListener('keydown', handleKeydown);
  return {
    update(newActive: boolean) {
      enabled = newActive;
      if (enabled) activate();
    },
    destroy() {
      node.removeEventListener('keydown', handleKeydown);
    }
  };
}

/**
 * Zero-indexed month from which a new Premier League season is considered
 * to have started (July = 6). Fixture lists publish in July; the first
 * match is typically in August.
 */
export const SEASON_START_MONTH = 6;

/**
 * Return the starting calendar year of the PL season that `date` falls in.
 * July onwards = new season, e.g. July 2025 → 2025 (season 2025/26).
 * January 2026 → 2025 (still the 2025/26 season).
 */
export function getSeasonYear(date: Date = new Date()): number {
  return date.getMonth() >= SEASON_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1;
}

/**
 * Derive the current Premier League season label from today's date.
 * July onwards (month >= 6) starts the new season, e.g. "2025/26".
 */
export function getSeasonLabel(): string {
  const year = getSeasonYear();
  return `${year}/${(year + 1).toString().slice(-2)}`;
}

/** Match statuses treated as currently in-play (not scheduled, not finished). */
const LIVE_STATUSES: readonly MatchStatus[] = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];

/**
 * Human-readable label for a match's current state. Used on prediction and
 * live-match cards. Returns an empty string for statuses that shouldn't
 * display a stage label (SCHEDULED, TIMED, POSTPONED, etc.).
 */
export function getMatchStatusLabel(
  match: { status?: MatchStatus | null; minute?: number | null }
): string {
  switch (match.status) {
    case 'FINISHED':         return 'Full Time';
    case 'PAUSED':           return 'Half Time';
    case 'EXTRA_TIME':       return 'Extra Time';
    case 'PENALTY_SHOOTOUT': return 'Penalties';
    case 'IN_PLAY':          return match.minute ? `Live ${match.minute}'` : 'Live';
    case 'SUSPENDED':        return 'Suspended';
    case 'AWARDED':          return 'Awarded';
    default:                 return '';
  }
}

/** True when the match is currently in progress (any live status). */
export function isMatchLive(match: { status?: MatchStatus | null }): boolean {
  return match.status != null && LIVE_STATUSES.includes(match.status);
}
