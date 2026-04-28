import { fireEvent, render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ThreadRail from './ThreadRail.svelte';
import type { OracleThread } from '../../lib/oracle/threads';

function thread(id: string, title: string, overrides: Partial<OracleThread> = {}): OracleThread {
  const ts = 1_700_000_000_000;
  return {
    id,
    title,
    messages: [{ role: 'user', content: title, timestamp: ts }],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('ThreadRail', () => {
  it('renders one [data-thread] per thread plus a [data-new-thread] button', () => {
    const { container } = render(ThreadRail, {
      props: {
        threads: [thread('a', 'A'), thread('b', 'B')],
        activeThreadId: null,
        onSelect: vi.fn(),
        onNewThread: vi.fn(),
      },
    });
    expect(container.querySelector('[data-thread-rail]')).toBeTruthy();
    expect(container.querySelectorAll('[data-thread]')).toHaveLength(2);
    expect(container.querySelector('[data-new-thread]')).toBeTruthy();
  });

  it('clicking a thread row calls onSelect with the thread id', async () => {
    const onSelect = vi.fn();
    const { container } = render(ThreadRail, {
      props: {
        threads: [thread('a', 'A')],
        activeThreadId: null,
        onSelect,
        onNewThread: vi.fn(),
      },
    });
    await fireEvent.click(container.querySelector('[data-thread]')!);
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('marks the active thread with data-active="true"', () => {
    const { container } = render(ThreadRail, {
      props: {
        threads: [thread('a', 'A'), thread('b', 'B')],
        activeThreadId: 'b',
        onSelect: vi.fn(),
        onNewThread: vi.fn(),
      },
    });
    const rows = container.querySelectorAll('[data-thread]');
    expect(rows[0].getAttribute('data-active')).not.toBe('true');
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('clicking [data-new-thread] calls onNewThread', async () => {
    const onNewThread = vi.fn();
    const { container } = render(ThreadRail, {
      props: {
        threads: [],
        activeThreadId: null,
        onSelect: vi.fn(),
        onNewThread,
      },
    });
    await fireEvent.click(container.querySelector('[data-new-thread]')!);
    expect(onNewThread).toHaveBeenCalledTimes(1);
  });
});
