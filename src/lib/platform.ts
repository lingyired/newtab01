// Platform detection — macOS vs. Windows/Linux. Used for rendering
// keyboard shortcuts correctly in the UI (e.g. the topbar search
// placeholder shows ⌘K on Mac, Ctrl+K on Windows/Linux).
//
// Detection strategy (in priority order):
//  1. `navigator.userAgentData.platform` (Chrome 90+, behind a flag in
//     some Chromium-based browsers; preferred when present because it
//     is the only platform string the UA team officially guarantees to
//     keep stable)
//  2. `navigator.platform` (legacy, deprecated but still present in
//     every browser as of 2026 — the string is fixed at install time
//     and never updated, but for shortcut-hint purposes that's fine)
//  3. UA-string sniff (last-resort fallback for the rare environment
//     where both above are missing — WebViews, very old browsers)
//
// The function returns a single boolean (isMac) which is the only
// platform distinction the UI needs for shortcut rendering. If the
// call site needs more granular data later (e.g. distinguishing
// Windows from Linux for a future shortcut), add new flags here.

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;

  // 1. navigator.userAgentData.platform (preferred)
  const uaDataPlatform = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData?.platform;
  if (typeof uaDataPlatform === 'string') {
    // Returns values like "macOS", "Windows", "Linux", "Android", "iOS",
    // "Chrome OS", "Unknown" — see the spec.
    if (/^mac/i.test(uaDataPlatform)) return true;
    if (/^win|linux|android|cros|chrome os/i.test(uaDataPlatform)) return false;
  }

  // 2. navigator.platform (legacy; values like "MacIntel", "Win32",
  //    "Linux x86_64")
  const legacyPlatform = (navigator as Navigator & {
    platform?: string;
  }).platform;
  if (typeof legacyPlatform === 'string') {
    if (/^mac/i.test(legacyPlatform)) return true;
    if (/^win|linux/i.test(legacyPlatform)) return false;
  }

  // 3. UA-string sniff
  const ua = navigator.userAgent ?? '';
  if (/Macintosh|Mac OS X|Mac_PowerPC/i.test(ua)) return true;

  // Unknown → default to non-Mac (Ctrl) which is the most common case
  // and matches what most Linux / Windows users will recognize.
  return false;
}
