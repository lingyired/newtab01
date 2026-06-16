import { registerFrameHeaderRules } from './lib/chrome/declarative-net-request';

// Background service worker
console.log('newtab01 background service worker loaded');

// Register declarativeNetRequest dynamic rules on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('newtab01 installed');
  void registerFrameHeaderRules();
});
