import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// Rollup names chunks using the source file path verbatim, so a chunk
// produced from `src/background.ts` ends up as `background.ts-<hash>.js`.
// Chrome's extension resource server sees the `.ts-` in the name, falls
// back to `application/octet-stream` for the MIME type, and refuses to
// load it as a module script. The official fix is to strip any source
// extension (`background.ts` -> `background`) before forming the output
// name, which restores a normal `background-<hash>.js` filename and
// therefore a normal `text/javascript` MIME.
const stripSourceExt = (id: string | undefined): string => {
  const base = (id ?? 'chunk').replace(/^src\//, '').split('/').pop() ?? 'chunk';
  return base.replace(/\.[a-z]+$/i, '') || 'chunk';
};

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
      output: {
        entryFileNames: (chunkInfo) => `assets/${stripSourceExt(chunkInfo.name)}-[hash].js`,
        chunkFileNames: (chunkInfo) => `assets/${stripSourceExt(chunkInfo.name)}-[hash].js`,
      },
    },
  },
});
