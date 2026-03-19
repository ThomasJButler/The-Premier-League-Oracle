import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
          let parsed: { messages?: unknown[]; apiKey?: string };
          try {
            parsed = JSON.parse(body);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
            return;
          }

          const apiKey = process.env.OPENAI_API_KEY || parsed.apiKey;
          if (!apiKey) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'No API key configured. Please enter your OpenAI key.' }));
            return;
          }

          if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Messages array required.' }));
            return;
          }

          try {
            const upstream = await fetch(OPENAI_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: parsed.messages,
                max_tokens: 800,
                temperature: 0.7,
              }),
            });

            const data = await upstream.text();
            res.statusCode = upstream.status;
            res.end(data);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI.' }));
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
