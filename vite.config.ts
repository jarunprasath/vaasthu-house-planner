/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/vaasthu-house-planner/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Konva + React are ~650 kB minified; the PDF code is split into its own lazily loaded chunk.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
