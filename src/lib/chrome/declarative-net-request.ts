// Typed wrappers for chrome.declarativeNetRequest API

export async function updateDynamicRules(
  addRules?: chrome.declarativeNetRequest.Rule[],
  removeRuleIds?: number[]
): Promise<void> {
  return chrome.declarativeNetRequest.updateDynamicRules({
    addRules: addRules ?? [],
    removeRuleIds: removeRuleIds ?? [],
  });
}

/**
 * Register dynamic rules to remove X-Frame-Options and CSP frame-ancestors headers,
 * allowing iframes in split view to load external sites.
 */
export async function registerFrameHeaderRules(): Promise<void> {
  // Remove existing rules first, then add new ones
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map(r => r.id);

  const rules: chrome.declarativeNetRequest.Rule[] = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        responseHeaders: [
          { header: 'X-Frame-Options', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
          { header: 'Content-Security-Policy', operation: 'remove' as chrome.declarativeNetRequest.HeaderOperation },
        ],
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ['sub_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    },
  ];

  await updateDynamicRules(rules, ruleIdsToRemove.length > 0 ? ruleIdsToRemove : undefined);
}
