// Rumours "notify me" email capture — LOCAL ONLY.
//
// Stored at `kicker:rumoursNotify` as a single JSON object `{ email, at }`.
// There is no email backend yet (that arrives with the K2 backend phase) —
// this module only remembers that the visitor asked, so the CTA can flip to
// a persistent confirmed state across visits. No mail is ever sent.
//
// SSR-safe: every method guards `typeof localStorage`. Schema-validated on
// read so a tampered cache entry can't crash callers.

export const STORAGE_KEY = 'kicker:rumoursNotify';

export interface RumoursSignup {
  email: string;
  /** ISO timestamp. */
  at: string;
}

// Pragmatic — not RFC 5322. Good enough to reject obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function isValidSignup(raw: unknown): raw is RumoursSignup {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return typeof r.email === 'string' && isValidEmail(r.email) && typeof r.at === 'string';
}

export function readRumoursSignup(): RumoursSignup | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidSignup(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persists a signup. Returns false (and stores nothing) if the email is invalid. */
export function saveRumoursSignup(email: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const trimmed = email.trim();
  if (!isValidEmail(trimmed)) return false;
  const signup: RumoursSignup = { email: trimmed, at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signup));
  return true;
}

export function clearRumoursSignup(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
