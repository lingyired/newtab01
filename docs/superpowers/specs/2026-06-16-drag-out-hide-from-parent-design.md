# Drag-Out Hides From Parent — Design Spec

**Date:** 2026-06-16
**Status:** Draft — pending user approval

---

## 1. Problem

Currently, when a folder is dragged from its parent folder (in the Chrome bookmark tree) to a new column in the layout, the folder still appears in its original parent's children list when that parent is expanded.

Example:

```
Bookmarks Bar
└── Work
    ├── Project A   ← dragged to new column
    └── Project B
```

After dragging Project A to a new column:

- **Today:** Expanding Work still shows Project A → duplicated display.
- **Wanted:** Expanding Work hides Project A → single source of truth.

The folder itself still exists in Chrome's bookmark tree. We only need to **suppress its display** inside the parent that contained it.

---

## 2. Goals

1. When a folder is dragged out of a parent (in the bookmark tree), the parent no longer shows that folder in its expanded children list.
2. Default root folders (Bookmarks Bar / Other Bookmarks) are exempt: their children are always shown in full.
3. Special folders (apps / top / recent / closed / devices) are exempt as children: they are never added to the hide list.
4. Implementation is **render-only** — Chrome's bookmark tree is not modified.
5. The behavior is reversible via storage (a future options page reset can clear it).

## 3. Non-Goals

- No Chrome bookmark tree mutation.
- No UI for undoing / restoring individual folders in v1.
- No auto-clear when a folder is dragged back into its original parent (users can still see it there, but the "moved-out" record stays; v1 keeps the data layer dumb and reversible only via a full reset).
- No migration of existing layout state.

---

## 4. Data Model

### 4.1 Storage key

`chrome.storage.local` key: `newtab01.movedOut`

```ts
type MovedOutMap = Record<string, string[]>;
// key: parent bookmark ID (chrome.bookmarks.BookmarkTreeNode.id)
// value: array of child bookmark IDs that have been dragged out of that parent
```

### 4.2 Exempt sets

```ts
/** Chrome bookmark IDs for the two root folders — these never have the filter applied to their children. */
const DEFAULT_ROOT_IDS = new Set(['1', '2']); // Bookmarks Bar, Other Bookmarks

/** Special folder IDs — these never get recorded as "moved out". */
const SPECIAL_IDS = new Set(['apps', 'top', 'recent', 'closed', 'devices']);
```

### 4.3 Exempt rules

| Role | If matches exempt set | Behavior |
|------|----------------------|----------|
| Parent (the folder whose children we render) | `DEFAULT_ROOT_IDS` | Skip filter — always show all children |
| Child (the folder being dragged) | `SPECIAL_IDS` | Do not record as moved-out |

---

## 5. Module Changes

### 5.1 New module: `src/features/bookmarks/moved-out.ts`

Single responsibility: own the `movedOut` storage + filtering helpers.

```ts
// src/features/bookmarks/moved-out.ts

import type { BookmarkNode } from './types';
import { getLocal, setLocal } from '../../lib/storage';

/** Chrome bookmark IDs for the two root folders — never filtered. */
export const DEFAULT_ROOT_IDS: ReadonlySet<string> = new Set(['1', '2']);

/** Special folder IDs — never recorded as moved-out. */
export const SPECIAL_IDS: ReadonlySet<string> = new Set([
  'apps', 'top', 'recent', 'closed', 'devices',
]);

const STORAGE_KEY = 'movedOut';

export type MovedOutMap = Record<string, string[]>;

/** Load the moved-out map from chrome.storage.local. */
export async function getMovedOut(): Promise<MovedOutMap>;

/** Record that childId was dragged out of parentId. No-op if either is exempt. */
export async function markMovedOut(parentId: string, childId: string): Promise<void>;

/** Remove a record. Exposed for future undo / reset flows; not used in v1 UI. */
export async function unmarkMovedOut(parentId: string, childId: string): Promise<void>;

/**
 * Filter children list for display under parentId.
 * - If parentId is in DEFAULT_ROOT_IDS → return children unchanged.
 * - Otherwise → drop children whose id appears in movedOut[parentId].
 */
export function filterChildren(
  parentId: string,
  children: BookmarkNode[],
  movedOut: MovedOutMap,
): BookmarkNode[];
```

### 5.2 New wrapper: `src/lib/chrome/bookmarks.ts`

Add a small wrapper to look up the parent of a given bookmark id.

```ts
/** Get a single bookmark node by id. Returns undefined if not found. */
export function getBookmark(id: string): Promise<chrome.bookmarks.BookmarkTreeNode | undefined> {
  return new Promise((resolve) => {
    chrome.bookmarks.get(id, (results) => {
      resolve(results && results[0] ? results[0] : undefined);
    });
  });
}
```

### 5.3 Modify: `src/features/drag-drop/layout-ops.ts`

After `addRow` / `addColumn` succeed (the dragged folder has been placed in its new column), record the moved-out relationship. Only one call site needs to change.

**Single point of integration:** wrap the existing `addRow` and `addColumn` so they call `markMovedOut` after a successful move.

```ts
// inside addRow (and similarly addColumn)
const parentNode = await getBookmark(id);
if (parentNode?.parentId && parentNode.parentId !== '0') {
  await markMovedOut(parentNode.parentId, id);
}
```

Why wrap rather than scatter: keeps the moved-out concern in one module and prevents drift between `addRow` / `addColumn`.

**Edge case:** if `parentNode.parentId === '0'` (the dragged folder is a root-level bookmark like Bookmarks Bar itself), there is no meaningful parent to hide from — skip the call.

### 5.4 Modify: `src/features/bookmarks/folder.ts`

When rendering children, apply the filter. The render flow already calls `getChildren(node)` and iterates the result. Wrap that result.

Current code (line ~126):
```ts
const children = await getChildren(node);
```

Becomes:
```ts
let children = await getChildren(node);
const movedOut = await getMovedOut();
children = filterChildren(node.id, children, movedOut);
```

`renderChildrenInto` then renders the filtered list as today. This single change covers every folder expansion path.

**Why `node.id` and not `node.parentId`:** we are rendering children **of** this folder, so the relevant key in `movedOut` is this folder's own id. `filterChildren` checks `DEFAULT_ROOT_IDS` against this folder's id and skips filtering if it matches.

### 5.5 No changes to

- `src/features/bookmarks/column.ts` — column rendering iterates `columns[x][y]` which is the layout (not the bookmark tree). moved-out does not affect top-level layout positions.
- `src/features/drag-drop/drag-folder.ts` / `drag-column.ts` — drag capture stays the same; recording happens at drop time in `layout-ops.ts`.
- `src/features/drag-drop/drop-handler.ts` — unchanged.

---

## 6. Behavior Matrix

| Scenario | Parent in bookmark tree | Child being dragged | Recorded in moved-out? | Filtered in parent's children? |
|----------|------------------------|---------------------|------------------------|---------------------------------|
| Drag Project A out of Work | `Work` (normal) | `Project A` (normal) | Yes — `movedOut[Work.id] = [..., 'Project A.id']` | Yes — Project A hidden in Work |
| Drag Project A out of Bookmarks Bar | `1` (Bookmarks Bar) | `Project A` (normal) | Skipped — parent is default root | No — Bookmarks Bar still shows Project A |
| Drag `apps` out of any parent | any | `apps` (special) | Skipped — child is special folder | N/A (apps is filtered out before recording) |
| Drag Work (top-level root folder) to new column | `0` (root) | `Work` (normal) | Skipped — `parentId === '0'`, no meaningful parent | N/A (Work is a top-level layout item, not rendered as child of root) |

---

## 7. Edge Cases

1. **Folder moved back manually.** If the user later drags the same folder back into the original parent via the layout, the `movedOut` record stays. The folder will continue to be hidden in the original parent's expanded view.
   - **v1 behavior:** record persists. Documented limitation; resolved by future options-page reset action.
   - Consistent with non-goal #3.

2. **Folder deleted externally.** If Chrome bookmarks removes the folder, `movedOut[id]` becomes stale. No-op: the record is harmless dead data; future reset clears it.

3. **Storage quota.** `movedOut` is small (one entry per drag operation). Well under the 10 MB local storage budget.

4. **Multiple drags of the same folder from the same parent.** `markMovedOut` must be idempotent — if `childId` already exists in `movedOut[parentId]`, do not duplicate.

5. **Race conditions.** `markMovedOut` reads-modify-writes; concurrent drags could lose updates. v1: serialize via `Promise` chain or in-memory cache + write at the end. Acceptable for v1 (drag is single-user, low-frequency).

6. **Special folders are synthetic.** `apps`, `top`, `recent`, `closed`, `devices` do not exist as real Chrome bookmark nodes (`chrome.bookmarks.get('apps')` returns `undefined`). Because `SPECIAL_IDS` is checked **before** calling `getBookmark` (see §5.3 implementation note below), `markMovedOut` is never even attempted for these — no edge-case handling needed in the wrapper.

   Implementation note: in `layout-ops.ts`, gate the `getBookmark` call:

   ```ts
   if (SPECIAL_IDS.has(id)) return; // skip recording — never hide special folders
   const parentNode = await getBookmark(id);
   if (parentNode?.parentId && parentNode.parentId !== '0') {
     await markMovedOut(parentNode.parentId, id);
   }
   ```

7. **`getBookmark` rejects or times out.** Wrap in `try/catch` and log via debug; on failure, the layout still updates, only the hide-recording is skipped. Hide-recording is a UX nicety, not a correctness invariant.

---

## 8. Data Flow

```
User drags Project A from inside Work
  → drag-folder.ts captures Project A.id
  → drop on new column target
  → drop-handler.ts calls addRow / addColumn
  → layout-ops.ts places Project A in the new column
  → layout-ops.ts calls markMovedOut('Work.id', 'Project A.id')
      → markMovedOut reads movedOut, appends if not present, writes back
  → saveLayout triggers re-render
  → renderColumns → renderColumn → renderFolder(Work)
  → renderFolder(Work) → getChildren(Work) → filterChildren('Work.id', children, movedOut)
      → movedOut['Work.id'] contains 'Project A.id'
      → Project A is dropped from the rendered list
  → Work now shows only Project B (no duplicate of Project A)
```

---

## 9. Testing Strategy

- **Unit test for `filterChildren`:**
  - parentId in `DEFAULT_ROOT_IDS` → returns input unchanged.
  - parentId normal, childId in movedOut → child dropped.
  - parentId normal, childId not in movedOut → child kept.
  - empty movedOut → returns input unchanged.

- **Manual test scenarios:**
  1. Drag a nested folder out → confirm parent's expanded view no longer shows it.
  2. Drag a folder out of Bookmarks Bar → confirm Bookmarks Bar still shows it.
  3. Drag `apps` / `top` / etc. → confirm they are not hidden in any parent.
  4. Reload the page → confirm moved-out state persists across reloads.
  5. Restart Chrome → confirm moved-out state persists (chrome.storage.local).

---

## 10. Files Touched

| File | Change |
|------|--------|
| `src/features/bookmarks/moved-out.ts` | **NEW** — store + filter |
| `src/lib/chrome/bookmarks.ts` | + `getBookmark(id)` wrapper |
| `src/features/drag-drop/layout-ops.ts` | call `markMovedOut` after `addRow` / `addColumn` |
| `src/features/bookmarks/folder.ts` | apply `filterChildren` to expanded children |

Estimated total: ~120 lines of new code, ~10 lines of edits.

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| User finds the hide behavior surprising | Clear visual: dragged folder still visible in the new column. Default roots are unaffected. Document in options page later. |
| Records accumulate indefinitely | v1: accept. Future options-page "reset layout" will clear `movedOut`. |
| Concurrent drag writes lose updates | v1: in-memory write-through cache. Acceptable. |
| `chrome.bookmarks.get` permission missing | `bookmarks` permission is already declared in `manifest.json` (see CLAUDE.md §5.1). |

---

## 12. Open Questions

None — three clarifications resolved with the user:

1. Special folders (apps/top/recent/closed/devices) → exempt as children, never hidden. ✓
2. Undo UI → not in v1. ✓
3. moved-out records are per-parent (not global). ✓
