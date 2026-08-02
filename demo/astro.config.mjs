import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { fileURLToPath } from 'node:url'

// The demo consumes the library straight from source, so changes hot-reload
// without a build step. Consumers installed from git resolve the same
// specifiers through the package's dist/ exports instead.
const lib = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url))

export default defineConfig({
  integrations: [react()],
  vite: {
    resolve: {
      alias: [
        { find: 'lightbox/styles.css', replacement: lib('styles.css') },
        { find: 'lightbox/core', replacement: lib('core/index.ts') },
        { find: 'lightbox', replacement: lib('index.ts') },
      ],
      dedupe: ['react', 'react-dom'],
    },
  },
})
