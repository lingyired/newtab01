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

  // v0.2.127: collect every signal so we can log them when the
  //  user reports a wrong shortcut. The function still returns a
  //  single boolean; the collected `signals` object is only
  //  used for the one-off `console.log` at the bottom of this
  //  function. To disable the log, comment out the line marked
  //  `DEBUG_LOG`.
  const signals: { name: string; raw: string; matched: boolean }[] = [];

  // 1. navigator.userAgentData.platform (Chrome 90+, also Edge).
  //    On macOS the userAgentData.platform string is "macOS" by
  //    default. On Edge on macOS this is reliable when the API
  //    is present.
  const uaDataPlatform = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData?.platform;
  if (typeof uaDataPlatform === 'string') {
    const matched = /^mac/i.test(uaDataPlatform);
    signals.push({ name: 'userAgentData.platform', raw: uaDataPlatform, matched });
    if (matched) return true;
  } else {
    signals.push({ name: 'userAgentData.platform', raw: '(undefined)', matched: false });
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
    const matched = /^mac/i.test(legacyPlatform);
    signals.push({ name: 'navigator.platform', raw: legacyPlatform, matched });
    if (matched) return true;
  } else {
    signals.push({ name: 'navigator.platform', raw: '(undefined)', matched: false });
  }

  // 3. UA-string sniff (last-resort fallback). On macOS the UA
  //    contains "Macintosh" or "Mac OS X" or "Mac_PowerPC".
  //    This works on every browser, including Edge on macOS
  //    (Edge's UA is "Edg/<ver>" but the OS portion keeps the
  //    "Macintosh; ... Mac OS X" prefix). Sniffing the OS
  //    portion of the UA is the most reliable cross-browser
  //    signal even in 2026.
  const ua = navigator.userAgent ?? '';
  const matched = /Macintosh|Mac OS X|Mac_PowerPC/i.test(ua);
  signals.push({ name: 'userAgent sniff', raw: ua, matched });
  if (matched) return true;

  // DEBUG_LOG: v0.2.127 — temporary diagnostic log so users on
  //  Mac Edge (or any other browser where detection fails) can
  //  copy-paste the result back to the developer. The output
  //  shows the raw value of every signal, which one matched,
  //  and the final decision. Remove this line once the bug is
  //  closed.
  // eslint-disable-next-line no-console
  console.log('[newtab01:platform] isMacPlatform() =', false, '\n  signals:', signals);

  return false;
}
