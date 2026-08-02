import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { fileURLToPath } from 'node:url'

const lib = (path) => fileURLToPath(new URL(`../packages/lightbox/src/${path}`, import.meta.url))

export default defineConfig({
  integrations: [react()],
  vite: {
    resolve: {
      alias: [
        { find: '@lightbox/react/styles.css', replacement: lib('styles.css') },
        { find: '@lightbox/react', replacement: lib('index.ts') },
      ],
    },
  },
})
