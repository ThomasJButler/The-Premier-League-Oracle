import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readAnalysis, writeAnalysis, clearAnalysis } from './analysisStore';

describe('analysisStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a body keyed by fixtureId + persona (cache hit)', () => {
    const entry = writeAnalysis('m-1', 'voice', 'Arsenal edge it on the model.');
    const read = readAnalysis('m-1', 'voice');
    expect(read).not.toBeNull();
    expect(read!.body).toBe(entry.body);
    expect(read!.generatedAt).toBe(entry.generatedAt);
  });

  it('persona switch invalidates the cache (different persona returns null)', () => {
    writeAnalysis('m-1', 'voice', 'Voice take');
    expect(readAnalysis('m-1', 'scouser')).toBeNull();
    writeAnalysis('m-1', 'scouser', 'Macca take');
    expect(readAnalysis('m-1', 'voice')!.body).toBe('Voice take');
    expect(readAnalysis('m-1', 'scouser')!.body).toBe('Macca take');
  });

  it('clearAnalysis removes only the targeted entry', () => {
    writeAnalysis('m-1', 'voice', 'a');
    writeAnalysis('m-2', 'voice', 'b');
    clearAnalysis('m-1', 'voice');
    expect(readAnalysis('m-1', 'voice')).toBeNull();
    expect(readAnalysis('m-2', 'voice')!.body).toBe('b');
  });
});
