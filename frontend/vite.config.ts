import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
// Keep in sync with api/chat.ts ALLOWED_MODELS and src/lib/constants.ts AI_MODELS.
const ALLOWED_MODELS = [
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

/**
 * Vite plugin that mirrors the api/chat.ts Edge Function locally.
 * In production, Vercel serves api/chat.ts as a serverless function.
 * In dev, this middleware handles /api/chat so the ChatBot works without `vercel dev`.
 * Applies the same ephemeral prompt caching on the system prompt as prod.
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

          // Resolve model: request body → env var → default
          const requestedModel = parsed.model;
          const envModel = process.env.ORACLE_AI_MODEL;
          const resolvedModel =
            (requestedModel && ALLOWED_MODELS.includes(requestedModel) ? requestedModel : null)
            ?? (envModel && ALLOWED_MODELS.includes(envModel) ? envModel : null)
            ?? DEFAULT_MODEL;

          // Resolve API key: env var takes priority, then request body.
          // Key check runs BEFORE the messages check (mirroring api/chat.ts)
          // so ChatBot's server-key probe (which sends empty messages) can
          // accurately detect whether a server key is configured — without
          // this ordering, the messages check fires first in dev, tricking
          // the probe into setting useServerKey=true even when ANTHROPIC_API_KEY
          // is absent, which hides the "Connect Anthropic" UI.
          const apiKey = process.env.ANTHROPIC_API_KEY || parsed.apiKey;

          if (!apiKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No API key configured. Please enter your Anthropic key.' }));
            return;
          }

          if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Messages array required.' }));
            return;
          }

          try {
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

            const systemField = systemPrompt
              ? [{
                  type: 'text' as const,
                  text: systemPrompt,
                  cache_control: { type: 'ephemeral' as const },
                }]
              : undefined;

            const upstream = await fetch(ANTHROPIC_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
              },
              body: JSON.stringify({
                model: resolvedModel,
                max_tokens: 1024,
                ...(systemField ? { system: systemField } : {}),
                messages: userMessages,
              }),
            });

            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.end(JSON.stringify({ error: `Anthropic API error (${upstream.status}).` }));
              return;
            }

            const data = await upstream.json() as {
              content?: Array<{ type: string; text?: string }>;
              model?: string;
              usage?: unknown;
            };
            // Concatenate all text blocks — adaptive thinking produces thinking
            // blocks before the text block on Opus 4.6/4.7.
            const text = (data.content ?? [])
              .filter((b) => b.type === 'text' && typeof b.text === 'string')
              .map((b) => b.text as string)
              .join('');

            res.statusCode = 200;
            res.end(JSON.stringify({
              choices: [{ message: { role: 'assistant', content: text } }],
              model: data.model,
              usage: data.usage,
            }));
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Failed to connect to Anthropic.' }));
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
      },
      // Backend health probe — canonical path served by FastAPI directly
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
