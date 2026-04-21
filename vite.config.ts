import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/portfolio/svg-path-editor/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
