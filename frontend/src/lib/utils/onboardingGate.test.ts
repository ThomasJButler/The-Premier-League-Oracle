import { describe, expect, it } from 'vitest';
import { ONBOARDING_PATH, shouldRedirectToOnboarding } from './onboardingGate';

describe('shouldRedirectToOnboarding', () => {
  it('redirects when no persona is stored and route is not /onboarding', () => {
    expect(shouldRedirectToOnboarding(null, '/today')).toBe(true);
  });

  it('does not redirect when a valid persona is stored', () => {
    expect(shouldRedirectToOnboarding('voice', '/today')).toBe(false);
    expect(shouldRedirectToOnboarding('scouser', '/fixtures')).toBe(false);
  });

  it('does not redirect when an invalid persona string is stored only because we are already on /onboarding', () => {
    expect(shouldRedirectToOnboarding('not-a-persona', ONBOARDING_PATH)).toBe(false);
  });

  it('redirects when stored value is an unknown persona id', () => {
    expect(shouldRedirectToOnboarding('not-a-persona', '/today')).toBe(true);
  });

  it('never redirects from /onboarding even if persona is missing', () => {
    expect(shouldRedirectToOnboarding(null, ONBOARDING_PATH)).toBe(false);
  });
});
