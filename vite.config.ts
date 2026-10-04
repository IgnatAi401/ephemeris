import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// orbit.ignat.ai is served from the root of its own subdomain.
// Port 3001: 3000 belongs to the personal site.
const server = { host: '127.0.0.1', port: 3001, strictPort: true };

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server,
  preview: server,
});
