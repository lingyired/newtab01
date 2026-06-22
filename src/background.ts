import { registerFrameHeaderRules } from './lib/chrome/declarative-net-request';
import { isValidMessage, type Message } from './lib/chrome/messages';
import { groupTabs, updateGroup } from './lib/chrome/tab-groups';

// Background service worker
// CLAUDE.md § 5.2: pure router + alarm tasks, no business state.
console.log('newtab01 background service worker loaded');

type CreateTabGroupResponse = { ok: true; groupId: number } | { ok: false; error: string };
type RefreshDnrResponse = { ok: true } | { ok: false; error: string };
type FetchThemeJsonResponse = { ok: true; text: string } | { ok: false; error: string };

const OPEN_SETTINGS_MENU_ID = 'newtab01-open-settings';

// v0.2.118: locale lookup table for the right-click "Open Settings"
// menu. The service worker is a separate build chunk and does not
// import the newtab page's i18n module (which would pull in chrome
// bookmarks API shims via dynamic import), so we keep a minimal copy
// of just the strings we need. v0.2.120 expanded the table to all
// 10 supported locales; the fallback chain `user-pref → browser
// → en` is implemented in `pickOpenSettingsTitle`.
//
// Each value is the localized translation of `actionMenu.openSettings`
// from src/lib/i18n/catalog/<code>.ts. Keep in sync when adding a
// new locale.
const SETTINGS_MENU_TITLES: Record<string, string> = {
  en: 'Open Settings',
  zh: '打开设置',
  es: 'Abrir ajustes',
  ar: 'فتح الإعدادات',
  hi: 'सेटिंग्स खोलें',
  fr: 'Ouvrir les paramètres',
  pt: 'Abrir configurações',
  de: 'Einstellungen öffnen',
  ja: '設定を開く',
  ru: 'Открыть настройки',
};

function pickOpenSettingsTitle(): string {
  // 1. Try the user's explicit language preference (if set) — read from
  //    storage synchronously to avoid a race with the menu builder.
  // 2. Fall back to the browser's navigator.language.
  // 3. Fall back to 'en'.
  const navLang = chrome.i18n?.getUILanguage?.() ?? 'en';
  const primary = navLang.split('-')[0]?.toLowerCase() ?? 'en';
  // We cannot read storage here without `await`, and `chrome.contextMenus.create`
  // is synchronous. Use the browser's UI language as the only signal;
  // the language pref can be applied on the next SW restart (the menu
  // is rebuilt on onInstalled and on chrome.storage.onChanged).
  return SETTINGS_MENU_TITLES[navLang]
    ?? SETTINGS_MENU_TITLES[primary]
    ?? SETTINGS_MENU_TITLES.en
    ?? 'Open Settings';
}

// Register declarativeNetRequest dynamic rules and the right-click "Open
// Settings" menu item on install. The menu item is recreated on every
// install / update because the service worker can be restarted at any
// time and the menu entries do not survive SW termination.
chrome.runtime.onInstalled.addListener(() => {
  console.log('newtab01 installed');
  void registerFrameHeaderRules();
  void registerContextMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== OPEN_SETTINGS_MENU_ID) return;
  // Open a new-tab page with a hash marker; newtab's initApp reads the
  // hash and opens the floating settings panel automatically.
  void chrome.tabs.create({ url: 'chrome://newtab#settings=1' });
});

async function registerContextMenu(): Promise<void> {
  try {
    await chrome.contextMenus.remove(OPEN_SETTINGS_MENU_ID);
  } catch {
    // The entry may not exist on first install — safe to ignore.
  }
  // v0.2.118: title is resolved per-locale. We re-resolve from the
  // user's settings.language on every storage change, so the right-
  // click menu tracks the active UI language even if the SW was
  // started by an earlier onInstalled event.
  let title = pickOpenSettingsTitle();
  try {
    const stored = await chrome.storage.sync.get('settings');
    const lang = (stored as { settings?: { language?: string } } | undefined)
      ?.settings?.language;
    if (lang && lang !== 'auto') {
      const localized =
        SETTINGS_MENU_TITLES[lang] ??
        SETTINGS_MENU_TITLES[lang.split('-')[0] ?? ''];
      if (localized) title = localized;
    } else if (lang === 'auto') {
      // Resolve auto: use the browser UI language.
      title = pickOpenSettingsTitle();
    }
  } catch {
    // Storage read failed — keep the browser-language fallback.
  }
  chrome.contextMenus.create({
    id: OPEN_SETTINGS_MENU_ID,
    title,
    contexts: ['action'],
  });
}

// v0.2.118: re-register the context menu when the user changes
// `settings.language` so the right-click label tracks the active
// locale without requiring an extension reload.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  const langChange = changes['settings'];
  if (!langChange) return;
  const next = (langChange.newValue as { language?: unknown } | undefined)?.language;
  if (typeof next === 'string') {
    void registerContextMenu();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1. Reject messages from any context that isn't this extension.
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'invalid message' });
    return false;
  }

  // 2. Reject messages that don't match the schema.
  if (!isValidMessage(msg)) {
    sendResponse({ ok: false, error: 'invalid message' });
    return false;
  }

  // 3. Dispatch.
  switch (msg.type) {
    case 'createTabGroup':
      void handleCreateTabGroup(msg, sendResponse);
      return true; // async response
    case 'refreshDeclarativeNetRequest':
      void handleRefreshDeclarativeNetRequest(sendResponse);
      return true; // async response
    case 'fetchThemeJson':
      void handleFetchThemeJson(msg, sendResponse);
      return true; // async response
    default: {
      // Exhaustiveness check
      const _exhaustive: never = msg;
      void _exhaustive;
      sendResponse({ ok: false, error: 'invalid message' });
      return false;
    }
  }
});

async function handleCreateTabGroup(
  msg: Extract<Message, { type: 'createTabGroup' }>,
  sendResponse: (response: CreateTabGroupResponse) => void,
): Promise<void> {
  if (!chrome.tabGroups) {
    sendResponse({ ok: false, error: 'tabGroups API unavailable' });
    return;
  }
  const first = msg.tabIds[0];
  if (first === undefined) {
    sendResponse({ ok: false, error: 'empty tabIds' });
    return;
  }
  try {
    // chrome.tabs.group does not accept `title` in its options — set
    // the title on the resulting group via tabGroups.update.
    const groupId = await groupTabs([first, ...msg.tabIds.slice(1)]);
    await updateGroup(groupId, { title: msg.title ?? 'New Group' });
    sendResponse({ ok: true, groupId });
  } catch (err) {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleRefreshDeclarativeNetRequest(
  sendResponse: (response: RefreshDnrResponse) => void,
): Promise<void> {
  try {
    await registerFrameHeaderRules();
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}

/** Fetch a tweakcn theme JSON via the service worker's full extension
 *  privileges (bypasses CORS, so the URL doesn't need to advertise
 *  `Access-Control-Allow-Origin: *`). The URL is already validated to
 *  be `https://tweakcn.com/r/themes/<id>` by isValidMessage; we do
 *  not re-check the URL shape here.
 *
 *  Why this lives in the SW and not in the newtab page:
 *  - Service worker has unrestricted fetch within host_permissions.
 *  - Extension pages (chrome-extension://...) can also bypass CORS
 *    for the same hosts, but going through the SW keeps the URL
 *    validation policy (isValidMessage) in one place — even if a
 *    future context (popup, content script) reuses the message,
 *    they all hit the same gate. */
async function handleFetchThemeJson(
  msg: Extract<Message, { type: 'fetchThemeJson' }>,
  sendResponse: (response: FetchThemeJsonResponse) => void,
): Promise<void> {
  try {
    const res = await fetch(msg.url, { credentials: 'omit' });
    if (!res.ok) {
      sendResponse({ ok: false, error: `HTTP ${res.status} ${res.statusText}` });
      return;
    }
    const text = await res.text();
    sendResponse({ ok: true, text });
  } catch (err) {
    // Network errors, DNS failures, CORS preflight failures (shouldn't
    // happen for the SW, but be defensive). Caller maps the message
    // to a user-visible status.
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
