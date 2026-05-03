// Thin Anthropic adapter. Routes consume the AnthropicClient interface so
// integration tests can inject a fake without booting the real SDK.
//
// Lazy real-client construction keeps the SDK out of the import graph for
// tests (and cold-start cost out of the unhappy path when ANTHROPIC_API_KEY
// is missing — getAnthropic() returns null and the route 503s).

import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MessageParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: ChatMessage[];
}

export interface AnthropicClient {
  streamText(params: MessageParams): AsyncIterable<string>;
  createText(params: MessageParams): Promise<string>;
}

let _override: AnthropicClient | null | undefined = undefined;
let _real: AnthropicClient | null | undefined = undefined;

function buildRealClient(apiKey: string): AnthropicClient {
  const sdk = new Anthropic({ apiKey });
  return {
    async *streamText(params) {
      const stream = sdk.messages.stream(params);
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    },
    async createText(params) {
      const message = await sdk.messages.create(params);
      return message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
  };
}

export function getAnthropic(): AnthropicClient | null {
  if (_override !== undefined) return _override;
  if (_real !== undefined) return _real;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  _real = apiKey ? buildRealClient(apiKey) : null;
  return _real;
}

// Test seam: undefined = use real (env-driven), null = simulate missing key,
// AnthropicClient = inject fake.
export function _setAnthropic(client: AnthropicClient | null | undefined): void {
  _override = client;
  _real = undefined;
}
