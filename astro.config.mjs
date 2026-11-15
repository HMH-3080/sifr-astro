import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://sifr.studio',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // three.js is heavy (~600 kB minified); warn later than the 500 kB default
      // because it is already code-split out of the initial page bundle.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Force three into its own long-lived chunk so the small site bundle
          // stays cacheable independently of the 3D scene.
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three';
          },
        },
      },
    },
  },
  devToolbar: { enabled: false },
});