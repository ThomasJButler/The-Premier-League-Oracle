import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      // Proxies /api/football-data/* → https://api.football-data.org/v4/*
      // Required: Football-Data.org CORS policy only allows localhost, so
      // any deployed origin needs server-side proxying. The X-Auth-Token
      // header is set by footballData.ts in the request; the proxy just
      // rewrites the URL and forwards all headers.
      '/api/football-data': {
        target: 'https://api.football-data.org/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/football-data/, ''),
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    setupFiles: ['src/test-setup.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
    passWithNoTests: true,
    pool: 'forks'
  }
});
