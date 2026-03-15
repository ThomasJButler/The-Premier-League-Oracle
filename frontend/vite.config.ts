import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib')
    }
  },
  server: {
    proxy: {
      '/api/football-data': {
        target: 'https://api.football-data.org/v4',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/football-data/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward the API key from the original request headers
            const apiKey = req.headers['x-auth-token'];
            if (apiKey) {
              proxyReq.setHeader('X-Auth-Token', apiKey);
            }
            // Log for debugging
            console.log('Proxying:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('error', (err, req, res) => {
            console.error('Proxy error:', err);
          });
        }
      }
    }
  }
})