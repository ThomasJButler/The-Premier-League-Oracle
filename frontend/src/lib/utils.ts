import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
