// Typed message contracts between UI contexts and the service worker.
// CLAUDE.md § 5.2: SW is pure router. UI sends validated messages, SW
// re-validates sender + schema, dispatches, and responds.
//
// Keep this file small and dependency-free. No zod, no runtime schema
// lib (project_rules.md § 1) — the validator is a handwritten type guard.

export type Message =
  | { type: 'createTabGroup'; tabIds: number[]; title?: string }
  | { type: 'refreshDeclarativeNetRequest' };

/**
 * Handwritten type guard for messages sent to the service worker.
 * Returns true only when the value matches a known `Message` variant
 * and its required fields have the right primitive types.
 */
export function isValidMessage(msg: unknown): msg is Message {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;

  if (m['type'] === 'createTabGroup') {
    if (!Array.isArray(m['tabIds'])) return false;
    if (!m['tabIds'].every((id) => typeof id === 'number' && Number.isFinite(id))) return false;
    if (m['title'] !== undefined && typeof m['title'] !== 'string') return false;
    return true;
  }

  if (m['type'] === 'refreshDeclarativeNetRequest') {
    return true;
  }

  return false;
}

/**
 * Promise wrapper around `chrome.runtime.sendMessage`. The SW handler
 * always responds with `{ ok: true, ... } | { ok: false, error: string }`
 * — callers narrow T to the success shape they expect.
 */
export function sendMessage<T = unknown>(msg: Message): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}
