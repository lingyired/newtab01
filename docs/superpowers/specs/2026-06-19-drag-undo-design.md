# Drag-Drop Undo — Design Spec

**Date:** 2026-06-19
**Status:** Implemented (v0.2.61)

---

## 1. Problem

newtab01's bookmark layout supports drag-drop for moving folders between columns and creating new columns (see CLAUDE.md §2.2). When a user accidentally drags a folder to the wrong column, there's no way to revert the operation — the folder has to be manually dragged back, and the original parent's moved-out tracking may have permanently hidden the folder from its parent's expanded view.

**User-visible pain:**
- Drag "Project A" out of "Work" folder into a new column by accident.
- Work folder's expanded view no longer shows Project A.
- To fully restore: drag Project A back into Work folder manually, then there's no easy way to undo the moved-out tracking.

**Goal:** Single-click undo of the most recent drag operation, with multi-step history (up to 10 steps), all in memory.

---

## 2. Goals

1. After every successful drag-drop, show an undo button in the topbar.
2. Click the button once → revert that single drag operation completely (column layout + moved-out visibility).
3. Support up to 10 sequential undos.
4. State lives only in memory; refreshing the newtab page discards history.
5. Keep the existing topbar center alignment (search box + undo button as a centered group; settings gear stays absolute).

## 3. Non-Goals

- No persistence across page refresh (per spec).
- No persistence across browser restart.
- No redo (Ctrl+Shift+Z) — out of scope for v1.
- No undo for non-drag column changes (columnWidth settings, etc.) — those aren't user "drag" actions and would feel out of place in the same history.
- No selective undo ("undo this folder only") — always restores the entire pre-drop state as a unit.

---

## 4. UX

### Placement

The undo button sits immediately to the right of the search box, inside the topbar's flex row. Because `#topbar` is `display: flex; justify-content: center`, the (search + undo) pair is centered as a group. The settings gear stays absolute in the top-right corner (unchanged).

```
┌────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────┐  ┌──────────────┐                ⚙      │
│  │ Search bookmarks...  │  │回退操作 [3]  │  ← text + count   │
│  └──────────────────────┘  └──────────────┘    pill, hidden     │
│                                              when history empty  │
└────────────────────────────────────────────────────────────────────┘
```

### Visibility

- **Empty history** → `display: none`. The topbar reads exactly as before.
- **≥ 1 snapshot** → button visible, label is `回退操作` + an inline pill showing the current stack depth (1, 2, …, 10).

### Interaction

- Hover → background + border tint to `--newtab-highlight`.
- Click → pop the newest snapshot, restore columns + movedOut, re-render. Button visibility + pill text update immediately (driven by `subscribe` listener).

### Tooltip

- 1 snapshot: `"回退操作"`
- N snapshots: `"回退操作（N 步）"`

### Label choice: text + count pill (v0.2.61 final)

The button design went through three iterations during v0.2.61, each documented in CHANGELOG:

| Iteration | Layout | Issue |
|-----------|--------|-------|
| 1. SVG icon + absolute badge | `↺ [N]` (badge empty at N=1) | Inconsistent — empty pill at 1, then suddenly a number at 2. User said "weird". |
| 2. Plain text label | `回退操作` (no count) | User wanted the count back. |
| 3. **Text + inline pill** (current) | `回退操作 [N]` (always shows a number) | Pill always shows a number, so 1 / 2 / 3 read consistently. |

Inline (not absolute) positioning keeps the pill's baseline aligned with the label's text, which reads cleaner than the v1 absolute positioning. Pill background is `--primary` so it picks up each theme's accent (Codex's blue, Brutalist's hard color, etc.) without a per-theme override.

---

## 5. Data Model

### 5.1 Snapshot

```ts
interface HistorySnapshot {
  columns: Columns;      // string[][] — pre-drop column layout
  movedOut: MovedOutMap; // Record<string, string[]> — pre-drop moved-out map
}
```

Both fields are deep-cloned on push (the `history` module owns the clone logic).

### 5.2 Stack

- Module-level `HistorySnapshot[]` in `src/features/drag-drop/history.ts`.
- Newest at the end (LIFO).
- `MAX_HISTORY = 10`. On overflow, `shift()` the oldest.

### 5.3 Lifetime

- **Created:** when the `history` module is first loaded (singleton array, lives for the page session).
- **Mutated:** on every successful drop (`pushSnapshot`) and every undo click (`popSnapshot`).
- **Destroyed:** when the newtab page is closed or refreshed. No chrome.storage writes.

### 5.4 Captured fields — why both?

**columns** captures the column positions (which folder lives in which column at which row). Without restoring this, undo wouldn't put the folder back where it came from.

**movedOut** captures the "hidden from parent" map (set by `recordMovedOutForIds` when a folder is dragged out of its parent). Without restoring this, undo would leave the folder hidden from its original parent's expanded view — a half-undone state that surprises users.

Restoring both = full revert.

---

## 6. Flow

### 6.1 Drop → push

```
User drags folder
   │
   ▼
dragstart (drag-state.ts)
   │
   ▼
drop event fires
   │
   ▼
drop-handler.ts:onDrop
   │  ┌─ capture { columns: clone, movedOut: clone }
   │  │
   ▼  │
captureAndDrop (async)
   │
   ▼
addRow / addColumn
   │  • mutates columns
   │  • calls recordMovedOutForIds → mutates movedOut
   │  • calls saveLayout → persists + re-renders
   │
   ▼
pushSnapshot(snapshot)        ← only on success
   │
   ▼
subscribe listeners fire → undo-button updates visibility
```

### 6.2 Click undo → pop

```
User clicks #undo_button
   │
   ▼
undo-button.ts:onUndoClick
   │
   ▼
popSnapshot() → HistorySnapshot | null
   │
   ├─ null → log + return (race condition: stack emptied between subscribe fires)
   │
   ▼
setColumns(snapshot.columns)        ← layout-ops module ref swap
setMovedOutCache(snapshot.movedOut) ← moved-out module ref swap
setLocal('movedOut', snapshot.movedOut)  ← persist
saveLayout()
   │  • verifyColumns → rebuild coords, drop empty cols
   │  • setLocal('layout', columns) → persist
   │  • renderColumns → re-render board
   │
   ▼
subscribe listeners fire → undo-button updates visibility
```

### 6.3 Failure / edge cases

| Scenario | Behavior |
|----------|----------|
| Drop fails (no target) | No snapshot pushed (snapshot is created inside `captureAndDrop`, which is only called after the target / x / y validation passes). |
| Drop succeeds but movedOut stays unchanged | Snapshot is pushed anyway — undo is a no-op for movedOut but still restores columns. |
| Undo while drop is in-flight | Drop's `pushSnapshot` resolves after undo's `popSnapshot`; stack stays consistent (LIFO order preserved). |
| User opens settings panel, changes a setting, then drags | Setting changes don't touch columns / movedOut; only the drag pushes a snapshot. |
| Page refresh | Module-level stack array is garbage-collected; fresh load starts with empty history. |

---

## 7. Implementation

### 7.1 New files

- `src/features/drag-drop/history.ts` — snapshot stack + `subscribe` listener pattern.
- `src/newtab/undo-button.ts` — button rendering, click handler, visibility subscription.
- `docs/superpowers/specs/2026-06-19-drag-undo-design.md` — this file.

### 7.2 Modified files

- `src/features/drag-drop/layout-ops.ts` — added `setColumns(next)` setter.
- `src/features/bookmarks/moved-out.ts` — added `setMovedOutCache(next)` setter.
- `src/features/drag-drop/drop-handler.ts` — `onDrop` refactored: validates first, then `void captureAndDrop(...)` (async, awaits addRow/addColumn, then pushes).
- `src/newtab/topbar.ts` — calls `renderUndoButton(topbar, showSearch)` after the search wrap.
- `styles/newtab.css` — `#undo_button` + `.undo-count` rules.
- `manifest.json` / `package.json` — version `0.2.60 → 0.2.61`.
- `CHANGELOG.md` — `## [0.2.61]` entry.

### 7.3 Constraints respected

- **CLAUDE.md §3** Vanilla JS, no React, no zustand, no dnd-kit — `history.ts` and `undo-button.ts` are plain TS modules.
- **CLAUDE.md §7** JS bundle budget (≤ 80 KB gzipped) — v0.2.61 newtab bundle is **24.29 KB gzipped** (≈ +0.8 KB vs v0.2.60).
- **CLAUDE.md §9.2** semantic CSS variables — `#undo_button` uses `--newtab-text` / `--newtab-highlight` / `--border` / `--primary` / `--primary-foreground`; no hardcoded colors.
- **CLAUDE.md §9.5** favicon — N/A.
- **CLAUDE.md §9.6** drag-drop — native HTML5 events, no library added.
- **project_rules.md §2** Simplicity First — `subscribe` listener pattern reused from drop-handler's general spirit; no event bus, no observer framework.

---

## 8. Risks / Open Questions

| Risk | Mitigation |
|------|------------|
| Undo while a drop's `recordMovedOutForIds` is still in flight | Both `pushSnapshot` and `popSnapshot` are synchronous array ops. Worst case: snapshot pushed after undo, leaving a stale entry pointing to the now-undone state. **Not a correctness issue** because the snapshot captures pre-drop state, so undoing it again would re-do the same revert. Acceptable. |
| User undoes, then sees a folder in a column they don't recognize (e.g. they forgot they previously dragged it) | This is a UX-level risk inherent to any undo system. Out of scope for v1. |
| Snapshot size if `columns` has many folders | Each snapshot is `O(folder count)` strings + the moved-out map. 10 snapshots × N folders is bounded by MAX_HISTORY × chrome bookmark tree depth — negligible (KB order). |
| Should we add a keyboard shortcut (Ctrl+Z)? | Out of scope per spec. Easy follow-up: register `keydown` on `document` and call undo-button's onUndoClick handler. |

---

## 9. Future work (not in v0.2.61)

1. **Persistence via `chrome.storage.session`** — if user feedback shows "I refreshed and lost my undo" is a real pain, swap the in-memory array for a session-storage backed one. Same API surface, just adds `await chrome.storage.session.set(...)` on push.
2. **Redo (Ctrl+Shift+Z)** — mirror stack. Same snapshot type, separate array.
3. **Settings-panel integration** — currently no UI hint that undo is in memory only. Could add a small "↺ Undo (in memory only)" hint in the topbar tooltip, or a row in the settings panel.
4. **Group undo for column-wide operations** — currently a single drop pushes one snapshot even if it moves 5 folders (a column drag). Some users might expect "undo one folder at a time" — but spec says "回退该次操作" (one drop = one undo), so this matches.