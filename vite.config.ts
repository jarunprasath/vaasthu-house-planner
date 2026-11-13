/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/vaasthu-house-planner/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Konva + React are ~700 kB minified. PDF (jsPDF) and 3D (three.js) are split into lazily loaded chunks.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
