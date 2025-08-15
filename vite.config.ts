import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      '/api/football-data': {
        target: 'https://api.football-data.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/football-data/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add the API key from environment variable
            const apiKey = process.env.VITE_FOOTBALL_DATA_API_KEY || '7cac5e059eaf4111a73b52e727197c1b';
            proxyReq.setHeader('X-Auth-Token', apiKey);
          });
        }
      }
    }
  }
})