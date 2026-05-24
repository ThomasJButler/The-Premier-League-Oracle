import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readVerdict, writeVerdict, clearVerdict } from './verdictsStore';

describe('verdictsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no entry exists', () => {
    expect(readVerdict('2003/04', 'voice')).toBeNull();
  });

  it('round-trips a verdict body keyed by season + persona', () => {
    const entry = writeVerdict('2003/04', 'voice', 'The Invincibles delivered a 38-game refusal.');
    expect(entry.body).toBe('The Invincibles delivered a 38-game refusal.');
    expect(entry.season).toBe('2003/04');
    expect(entry.personaId).toBe('voice');
    const read = readVerdict('2003/04', 'voice');
    expect(read).not.toBeNull();
    expect(read!.body).toBe(entry.body);
    expect(read!.generatedAt).toBe(entry.generatedAt);
  });

  it('namespaces by both season AND persona', () => {
    writeVerdict('2003/04', 'voice', 'Voice take');
    writeVerdict('2003/04', 'scouser', 'Macca take');
    expect(readVerdict('2003/04', 'voice')!.body).toBe('Voice take');
    expect(readVerdict('2003/04', 'scouser')!.body).toBe('Macca take');
    expect(readVerdict('2004/05', 'voice')).toBeNull();
  });

  it('clearVerdict removes only the targeted entry', () => {
    writeVerdict('2003/04', 'voice', 'a');
    writeVerdict('2004/05', 'voice', 'b');
    clearVerdict('2003/04', 'voice');
    expect(readVerdict('2003/04', 'voice')).toBeNull();
    expect(readVerdict('2004/05', 'voice')!.body).toBe('b');
  });

  it('recovers from corrupt JSON by returning null', () => {
    localStorage.setItem('kicker:verdict:2003/04:voice', '{not json');
    expect(readVerdict('2003/04', 'voice')).toBeNull();
  });

  it('rejects entries missing required fields', () => {
    localStorage.setItem('kicker:verdict:2003/04:voice', JSON.stringify({ season: '2003/04', personaId: 'voice' }));
    expect(readVerdict('2003/04', 'voice')).toBeNull();
  });
});
