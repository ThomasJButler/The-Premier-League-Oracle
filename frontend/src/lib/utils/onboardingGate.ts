import { isPersonaId } from '$lib/personas';

export const ONBOARDING_PATH = '/onboarding';

export function shouldRedirectToOnboarding(
  stored: string | null,
  currentPath: string
): boolean {
  if (currentPath === ONBOARDING_PATH) return false;
  return !isPersonaId(stored);
}
