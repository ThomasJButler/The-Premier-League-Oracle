import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MessageList from './MessageList.svelte';

describe('MessageList', () => {
  it('renders an empty state when messages is empty', () => {
    const { container } = render(MessageList, { props: { messages: [] } });
    expect(container.querySelector('[data-message-list-empty]')).toBeTruthy();
  });

  it('renders one [data-message] row per message with data-role attribute', () => {
    const { container } = render(MessageList, {
      props: {
        messages: [
          { role: 'user', content: 'hi', timestamp: 1 },
          { role: 'assistant', content: 'hello', timestamp: 2 },
        ],
      },
    });
    const rows = container.querySelectorAll('[data-message]');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('data-role')).toBe('user');
    expect(rows[1].getAttribute('data-role')).toBe('assistant');
  });

  it('renders streamingContent as a trailing [data-streaming] bubble when isStreaming', () => {
    const { container } = render(MessageList, {
      props: {
        messages: [{ role: 'user', content: 'go', timestamp: 1 }],
        streamingContent: 'thinking',
        isStreaming: true,
      },
    });
    expect(container.querySelector('[data-streaming]')?.textContent).toContain('thinking');
  });

  it('does not render [data-streaming] bubble when isStreaming is false', () => {
    const { container } = render(MessageList, {
      props: {
        messages: [{ role: 'user', content: 'go', timestamp: 1 }],
        streamingContent: 'leftover',
        isStreaming: false,
      },
    });
    expect(container.querySelector('[data-streaming]')).toBeNull();
  });
});
