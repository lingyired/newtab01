import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        newtab: 'newtab.html',
        popup: 'popup.html',
      },
    },
  },
});
