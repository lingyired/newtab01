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

// v1.0.14: source manifest uses __MSG_appName__ / __MSG_appDescription__
//  to enable Chrome Web Store listing translations. The source
//  manifest CANNOT carry those __MSG_ tokens (they only resolve at
//  runtime inside Chrome, and "newtab01 [dev — DO NOT LOAD]" needs
//  to stay as a literal warning when the project root is loaded
//  directly via `pnpm dev`). So we have a deliberate two-track
//  setup:
//    1. `pnpm dev`  →  source manifest is used as-is → dev warning
//       shows in chrome://extensions
//    2. `pnpm build` →  @crxjs/vite-plugin copies source manifest to
//       dist/, then THIS post-build hook scrubs the dev warning
//       fields AND, if the source used `__MSG_xxx__`, replaces them
//       with a literal fallback so the built zip uploads to the
//       store correctly while keeping the i18n keys for the store
//       dashboard to discover.
//  With the new setup we keep the i18n path open — the source uses
//  __MSG_appName__ and the build hook now PASSES THROUGH __MSG_ tokens
//  instead of overwriting them. Chrome Web Store will see the i18n
//  keys in dist/manifest.json and unlock the "Manage translations"
//  editor for every locale listed in dist/_locales/.
//
// PUBLIC_DESCRIPTION is bounded by Chrome Web Store's 132-char manifest
// description limit. v1.0.11 used a 42-char Chinese copy as an emergency
// stop-gap (the previous 138-char English copy tripped validation);
// v1.0.12 was a 122-char English copy that named "Chrome tab groups"
// specifically; v1.0.13 drops the Chrome brand so the same copy is
// accurate on the Edge Add-ons store as well. The phrasing still works
// on both stores because both Chrome and Edge expose the same
// chrome.tabGroups API under that name.
const PUBLIC_NAME = 'newtab01: bookmark-driven new tab page';
const PUBLIC_DESCRIPTION = 'Bookmark-driven new tab page. Open folders as tab groups or in split view. 12 built-in themes + unlimited custom themes.';

function fixupDistManifest(): Plugin {
  return {
    name: 'fixup-dist-manifest',
    closeBundle() {
      const path = resolve('dist/manifest.json');
      const json = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
      // If the source manifest already uses __MSG_xxx__ for i18n,
      //  leave it alone — the dist manifest should carry the same
      //  __MSG_ tokens so the Chrome Web Store dashboard can read
      //  _locales/<code>/messages.json and unlock the per-language
      //  store-listing editor. Only fall back to the literal
      //  PUBLIC_* values when the source is missing the i18n keys
      //  entirely (e.g. legacy manifest imported from before the
      //  v1.0.14 migration).
      if (typeof json.name !== 'string' || !/^__MSG_/.test(json.name)) {
        json.name = PUBLIC_NAME;
      }
      if (
        typeof json.description !== 'string' ||
        !/^__MSG_/.test(json.description)
      ) {
        json.description = PUBLIC_DESCRIPTION;
      }
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
