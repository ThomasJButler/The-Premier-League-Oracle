import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DURATION_SEC,
  createMockTrack,
  formatTime,
  isAtEnd,
  tick
} from './mockPlayback';

describe('mockPlayback', () => {
  describe('formatTime', () => {
    it('formats whole minutes and seconds as MM:SS', () => {
      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(59)).toBe('00:59');
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(272)).toBe('04:32');
      expect(formatTime(1094)).toBe('18:14');
    });

    it('clamps negative inputs to 00:00', () => {
      expect(formatTime(-5)).toBe('00:00');
    });
  });

  describe('tick', () => {
    it('advances position by delta', () => {
      expect(tick(10, 5, 100)).toBe(15);
    });

    it('clamps at 0 when delta would push below zero', () => {
      expect(tick(3, -15, 100)).toBe(0);
    });

    it('clamps at duration when delta would overshoot', () => {
      expect(tick(95, 15, 100)).toBe(100);
    });
  });

  describe('createMockTrack', () => {
    it('builds a deterministic id from its inputs', () => {
      const a = createMockTrack({
        personaId: 'volcano',
        source: 'broadsheet',
        title: 'GW32 BROADSHEET',
        subtitle: 'Mickey · 04:32'
      });
      const b = createMockTrack({
        personaId: 'volcano',
        source: 'broadsheet',
        title: 'GW32 BROADSHEET',
        subtitle: 'Mickey · 04:32'
      });
      expect(a.id).toBe(b.id);
      expect(a.durationSec).toBe(DEFAULT_DURATION_SEC);
      expect(a.markers).toEqual([]);
    });

    it('respects an explicit duration and marker list', () => {
      const track = createMockTrack({
        personaId: 'voice',
        source: 'column',
        title: 'On that back four',
        subtitle: 'Mickey · 04:32',
        durationSec: 120,
        markers: [{ positionSec: 30, label: 'OPEN' }]
      });
      expect(track.durationSec).toBe(120);
      expect(track.markers).toHaveLength(1);
      expect(track.markers[0].label).toBe('OPEN');
    });
  });

  describe('isAtEnd', () => {
    it('is true once position has reached duration', () => {
      expect(isAtEnd(99, 100)).toBe(false);
      expect(isAtEnd(100, 100)).toBe(true);
      expect(isAtEnd(101, 100)).toBe(true);
    });
  });
});
