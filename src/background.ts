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
  chrome.contextMenus.create({
    id: OPEN_SETTINGS_MENU_ID,
    title: '打开设置',
    contexts: ['action'],
  });
}

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
