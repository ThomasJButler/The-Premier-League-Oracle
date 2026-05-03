// KickerContext provider with a test-injectable seam. Routes call
// getContext(opts) instead of buildKickerContext(defaultPorts(), opts) so
// integration tests can supply deterministic context without booting the
// preserved data layer.

import { buildKickerContext } from '$lib/context/buildKickerContext';
import { defaultPorts } from '$lib/context/defaultPorts';
import type { BuildKickerContextOptions, KickerContext } from '$lib/context/types';

export type ContextProvider = (opts?: BuildKickerContextOptions) => Promise<KickerContext>;

let _override: ContextProvider | undefined;

export const getContext: ContextProvider = (opts) => {
  if (_override) return _override(opts);
  return buildKickerContext(defaultPorts(), opts);
};

export function _setContextProvider(provider: ContextProvider | undefined): void {
  _override = provider;
}
