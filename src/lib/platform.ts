// Platform detection — macOS vs. Windows/Linux. Used for rendering
// keyboard shortcuts correctly in the UI (e.g. the topbar search
// placeholder shows ⌘K on Mac, Ctrl+K on Windows/Linux).
//
// Detection strategy: check MULTIPLE signals and OR them together.
// A single signal isn't reliable across browsers — see the comments
// inline for each. We treat the OS as "Mac" if ANY signal says so.
//
// The function returns a single boolean (isMac) which is the only
// platform distinction the UI needs for shortcut rendering. If the
// call site needs more granular data later (e.g. distinguishing
// Windows from Linux for a future shortcut), add new flags here.

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;

  // 1. navigator.userAgentData.platform (Chrome 90+, also Edge).
  //    On macOS the userAgentData.platform string is "macOS" by
  //    default. On Edge on macOS this is reliable when the API
  //    is present.
  const uaDataPlatform = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData?.platform;
  if (typeof uaDataPlatform === 'string') {
    if (/^mac/i.test(uaDataPlatform)) return true;
  }

  // 2. navigator.platform (legacy, but still present in every
  //    shipping browser as of 2026). On macOS the value is
  //    "MacIntel" (or "MacPPC" / "MacARM64" on Apple Silicon
  //    / older PowerPC). On Windows it's "Win32" / "Win64".
  //    On Linux it varies ("Linux x86_64", "Linux i686", ...).
  //    Note: Chrome has marked this deprecated, but it still
  //    returns the real value for now. We treat its presence
  //    as authoritative when the legacy Mac-prefix matches.
  const legacyPlatform = (navigator as Navigator & {
    platform?: string;
  }).platform;
  if (typeof legacyPlatform === 'string') {
    if (/^mac/i.test(legacyPlatform)) return true;
  }

  // 3. UA-string sniff (last-resort fallback). On macOS the UA
  //    contains "Macintosh" or "Mac OS X" or "Mac_PowerPC".
  //    This works on every browser, including Edge on macOS
  //    (Edge's UA is "Edg/<ver>" but the OS portion keeps the
  //    "Macintosh; ... Mac OS X" prefix). Sniffing the OS
  //    portion of the UA is the most reliable cross-browser
  //    signal even in 2026.
  const ua = navigator.userAgent ?? '';
  if (/Macintosh|Mac OS X|Mac_PowerPC/i.test(ua)) return true;

  // No signal matched Mac → assume non-Mac (the default Ctrl
  // shortcut is the right answer for Windows / Linux / Chrome
  // OS / Android / iPad-with-keyboard-in-desktop-mode / etc.).
  return false;
}
