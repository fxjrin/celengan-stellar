import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // The contract bindings are a symlinked file: package; force Vite to resolve
    // the SDK from web/node_modules so its imports work when the linked package
    // has no node_modules of its own (as on Vercel).
    dedupe: ['@stellar/stellar-sdk'],
  },
  server: {
    proxy: {
      // the Blend faucet lambda sends no CORS headers; Vercel rewrites cover production
      '/faucet': {
        target: 'https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/faucet/, '/getAssets'),
      },
    },
  },
})
