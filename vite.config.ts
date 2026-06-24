import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// The source manifest carries a "DO NOT LOAD" warning (name + description)
// so anyone opening the project root in chrome://extensions immediately
// sees they should be loading dist/ instead. @crxjs/vite-plugin copies
// the manifest verbatim into dist/ and only rewrites the background
// service-worker path, so we have to scrub the warning fields back to
// their public-facing values in a post-build hook — otherwise the
// extension the user actually loads also shows the warning.
//
// PUBLIC_DESCRIPTION is bounded by Chrome Web Store's 132-char manifest
// description limit. The previous English copy (138 chars) tripped
// validation; the current copy is 42 chars and within budget.
const PUBLIC_NAME = 'newtab01';
const PUBLIC_DESCRIPTION = '是基于书签的新标签页，支持以 group 和 split view 形式打开标签目录';

function fixupDistManifest(): Plugin {
  return {
    name: 'fixup-dist-manifest',
    closeBundle() {
      const path = resolve('dist/manifest.json');
      const json = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
      json.name = PUBLIC_NAME;
      json.description = PUBLIC_DESCRIPTION;
      writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
    },
  };
}

export default defineConfig({
  plugins: [
    crx({ manifest }),
    fixupDistManifest(),
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
