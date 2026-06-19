// CSS paste import — let users paste a tweakcn-generated CSS
// (`:root` + `.dark` blocks) directly into the settings panel,
// which is the format tweakcn's "Copy" button emits by default.
// Produces the same `TweakcnJson` shape that `validateThemeJson()`
// already accepts, so the entire downstream install + emit pipeline
// is shared with the JSON path. No duplicate validation logic.
//
// Design: docs/superpowers/specs/2026-06-19-css-paste-import-design.md

import type { TweakcnCssVarsBlock, TweakcnJson } from './custom-themes';

export type CssParseResult =
  | { ok: true; json: TweakcnJson }
  | { ok: false; error: string };

/** Key renames applied during parsing. Keeps the CSS path's
 *  storage shape identical to the JSON path's — without this,
 *  the same tweakcn theme pasted in two formats would produce
 *  two different var-name entries in chrome.storage, and a
 *  later JSON re-paste of the same theme would fail to update
 *  the existing CSS-paste entry. */
const KEY_NORMALIZE: Readonly<Record<string, string>> = {
  'shadow-x': 'shadow-offset-x',
  'shadow-y': 'shadow-offset-y',
};

/** Parse a tweakcn CSS string into the `TweakcnJson` shape.
 *  Caller is expected to pass the result through
 *  `validateThemeJson()` — the 8 required shadcn var check +
 *  dark variant validation live there, not here, so both
 *  paths share one source of truth for "what counts as a
 *  valid tweakcn theme". */
export function parseCssTheme(css: string, name: string): CssParseResult {
  const light = extractBlock(css, ':root');
  if (!light) {
    return { ok: false, error: '未找到 :root { ... } 块' };
  }
  const darkRaw = extractBlock(css, '.dark');

  const json: TweakcnJson = {
    name,
    type: 'registry:style',
    cssVars: {
      // `theme` is a "shared tokens" hint in the JSON schema; the
      // project's emitBlock() only reads light/dark, so an empty
      // theme object is functionally equivalent to skipping it.
      theme: {},
      // Loose Record<string, string> from parseBlock() is widened to
      // the strict TweakcnCssVarsBlock.light shape here. The cast is
      // safe at runtime — validateThemeJson() is the single source of
      // truth for "8 required shadcn vars are present" and will reject
      // incomplete pastes with a typed error message.
      light: parseBlock(light) as TweakcnCssVarsBlock['light'],
      ...(darkRaw
        ? { dark: parseBlock(darkRaw) as NonNullable<TweakcnCssVarsBlock['dark']> }
        : {}),
    },
  };
  return { ok: true, json };
}

/** Cheap format detection used by the settings panel Apply
 *  handler. Returns `'css' | 'url'`. v0.2.77: removed the `'json'`
 *  branch — direct raw JSON paste is gone in favour of URL paste
 *  (which is itself a JSON paste under the hood, fetched via the
 *  service worker). Unrecognized input now defaults to `'css'`
 *  rather than `'json'`. */
export function detectInputFormat(raw: string): 'css' | 'url' {
  const t = raw.trim();
  if (t.startsWith(':root') || t.startsWith('@import')) return 'css';
  // Fallback: any CSS custom property declaration anywhere in the
  // input. Catches `body { --foo: ... }` style pastes that the
  // `:root` / `@import` heuristics miss.
  if (/--[\w-]+\s*:/.test(t)) return 'css';
  if (/^https?:\/\/tweakcn\.com\/(r\/)?themes\/[\w-]+/i.test(t)) return 'url';
  return 'css';
}

/** Extract the body of a top-level block whose selector is
 *  `selector { ... }`. Returns the trimmed content between
 *  the braces, or null if not found. Doesn't handle nested
 *  braces — fine for tweakcn's flat `:root` / `.dark` blocks
 *  (no CSS var value in tweakcn output contains a `}`). */
function extractBlock(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  return m && m[1] ? m[1].trim() : null;
}

/** Parse a `:root { ... }`-style body into a var → value map.
 *  Strips comments, applies key normalization, trims values.
 *  Empty values (e.g. `--foo: ;`) are dropped. */
function parseBlock(body: string): Record<string, string> {
  // Strip /* ... */ comments. tweakcn var values are not strings
  // so we don't have to worry about `/* */` inside a value.
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const key = m[1]!.toLowerCase();
    const normalized = KEY_NORMALIZE[key] ?? key;
    const value = m[2]!.trim();
    if (value) out[normalized] = value;
  }
  return out;
}
