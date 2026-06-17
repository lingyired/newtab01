import { registerFrameHeaderRules } from './lib/chrome/declarative-net-request';
import { isValidMessage, type Message } from './lib/chrome/messages';
import { groupTabs, updateGroup } from './lib/chrome/tab-groups';

// Background service worker
// CLAUDE.md § 5.2: pure router + alarm tasks, no business state.
console.log('newtab01 background service worker loaded');

type CreateTabGroupResponse = { ok: true; groupId: number } | { ok: false; error: string };
type RefreshDnrResponse = { ok: true } | { ok: false; error: string };

// Register declarativeNetRequest dynamic rules on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('newtab01 installed');
  void registerFrameHeaderRules();
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
