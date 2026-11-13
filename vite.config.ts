/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Writes sw.js at build time with the full list of built files, so the service worker can
 * pre-cache the whole app and it keeps working offline after the first visit.
 */
function serviceWorker(): Plugin {
  return {
    name: 'vhp-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const version = Date.now().toString(36);
      const source = `// Generated at build time. ignoreVary: module scripts are requested with an Origin header, so a
// server's "Vary: Origin" would otherwise stop cached files from matching when offline.
// Pre-caches the app; network first for pages, cache first for hashed assets.
const CACHE = 'vhp-${version}';
const PRECACHE = ['./', ${files.map((f) => JSON.stringify('./' + f)).join(', ')}, './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('vhp-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; }).catch(() => caches.match('./', { ignoreVary: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreVary: true, ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/vaasthu-house-planner/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), serviceWorker()],
  // Konva + React are ~700 kB minified. PDF (jsPDF, pdf.js) and 3D (three.js) are lazily loaded chunks.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
