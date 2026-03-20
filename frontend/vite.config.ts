import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'gpt-4o-mini';
const ALLOWED_MODELS = [
  'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo',
  'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest',
];

function isAnthropicModel(model: string): boolean {
  return model.startsWith('claude');
}

/**
 * Vite plugin that mirrors the api/chat.ts Edge Function locally.
 * In production, Vercel serves api/chat.ts as a serverless function.
 * In dev, this middleware handles /api/chat so the ChatBot works without `vercel dev`.
 */
function chatApiProxy(): Plugin {
  return {
    name: 'chat-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json');

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          let parsed: { messages?: Array<{ role: string; content: string }>; apiKey?: string; model?: string };
          try {
            parsed = JSON.parse(body);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
            return;
          }

          if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Messages array required.' }));
            return;
          }

          // Resolve model: request body → env var → default
          const requestedModel = parsed.model;
          const envModel = process.env.ORACLE_AI_MODEL;
          const resolvedModel =
            (requestedModel && ALLOWED_MODELS.includes(requestedModel) ? requestedModel : null)
            ?? (envModel && ALLOWED_MODELS.includes(envModel) ? envModel : null)
            ?? DEFAULT_MODEL;

          const useAnthropic = isAnthropicModel(resolvedModel);

          // Resolve API key: env var takes priority, then request body
          const apiKey = useAnthropic
            ? (process.env.ANTHROPIC_API_KEY || parsed.apiKey)
            : (process.env.OPENAI_API_KEY || parsed.apiKey);

          if (!apiKey) {
            const provider = useAnthropic ? 'Anthropic' : 'OpenAI';
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `No API key configured. Please enter your ${provider} key.` }));
            return;
          }

          try {
            if (useAnthropic) {
              // Extract system message — Anthropic uses a separate `system` field
              let systemPrompt = '';
              const userMessages: Array<{ role: string; content: string }> = [];
              for (const msg of parsed.messages) {
                if (msg.role === 'system') {
                  systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
                } else {
                  userMessages.push({ role: msg.role, content: msg.content });
                }
              }

              const upstream = await fetch(ANTHROPIC_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': ANTHROPIC_VERSION,
                },
                body: JSON.stringify({
                  model: resolvedModel,
                  max_tokens: 800,
                  ...(systemPrompt ? { system: systemPrompt } : {}),
                  messages: userMessages,
                }),
              });

              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end(JSON.stringify({ error: `Anthropic API error (${upstream.status}).` }));
                return;
              }

              const data = await upstream.json() as { content?: Array<{ text?: string }>; model?: string; usage?: unknown };
              const text = data.content?.[0]?.text || '';

              // Normalise to OpenAI response shape
              res.statusCode = 200;
              res.end(JSON.stringify({
                choices: [{ message: { role: 'assistant', content: text } }],
                model: data.model,
                usage: data.usage,
              }));
            } else {
              const upstream = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: resolvedModel,
                  messages: parsed.messages,
                  max_tokens: 800,
                  temperature: 0.7,
                }),
              });

              const data = await upstream.text();
              res.statusCode = upstream.status;
              res.end(data);
            }
          } catch {
            const provider = useAnthropic ? 'Anthropic' : 'OpenAI';
            res.statusCode = 502;
            res.end(JSON.stringify({ error: `Failed to connect to ${provider}.` }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), chatApiProxy()],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'chart': ['chart.js', 'svelte-chartjs'],
          'vendor': ['date-fns', 'dompurify'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api/football-data': {
        target: 'https://api.football-data.org/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/football-data/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the API key from the original request headers
            const apiKey = req.headers['x-auth-token'];
            if (apiKey) {
              proxyReq.setHeader('X-Auth-Token', apiKey as string);
            }
          });
        }
      },
      // Python ML backend (spec 03)
      '/api/oracle': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oracle/, '')
      }
    }
  }
})
