// Single source of truth for the extension's user-facing version
// string. Kept in sync with `version` in `manifest.json` and
// `package.json` by hand on every release (no build step reads this
// file — `vite.config.ts` only patches `name` + `description` from
// the source manifest into the dist manifest). If the three ever
// drift, the worst that happens is the About tab shows a different
// number than chrome://extensions; the extension still works.
//
// v1.0.0: first Chrome Web Store release.
// v1.0.3: added "More from this author" section to the About tab
//          (1 new author extension + section title).
// v1.0.4: dark mode description gains a "Some themes may not have a
//          light mode" note appended below the existing description
//          (new MessageKey settings.field.darkModeNote; all 10
//          locales updated). Shown in both the Appearance tab and
//          the Custom themes tab "Theme" section.
// v1.0.5: Chrome Web Store submission prep. No functional changes.
//          - docs/permissions.md added (full permissions justification
//            for store review).
//          - README.md rewritten in English (default) + docs/README.zh.md
//            Chinese version added; HNTP refactor claim removed in favor
//            of an "Inspiration" note at the bottom of the README.
//          - docs/github-description.md added (copy for the GitHub repo's
//            About box: description, topics, release notes).
// v1.0.6: folder header icon switched from PNG to inline Lucide SVG.
//          The icon now uses stroke="currentColor" and inherits
//          --card-foreground / --newtab-text, so dark themes whose
//          light variant still has a dark surface (the v1.0.5 black
//          PNG was unreadable on them) are now visible. No behavior
//          change — same 16x16 size, same closed/open morph on
//          expand/collapse.
// v1.0.7: search results footer / empty-state text now refreshes on
//          locale switch (updateSearchStrings path).
// v1.0.8: search results footer bug fix — buildFooter() had a side
//          effect that overwrote the module-level footerEl reference
//          with a detached node, making replaceWith a self-no-op and
//          leaving the old footer in the DOM. Replaced with a pure
//          buildFooter() + container.querySelector-based lookup.
// v1.0.9: store submission prep — 14 extension preview screenshots
//          added under extension-previews/ and inserted into README.md
//          (English) and docs/README.zh.md (Chinese) at the matching
//          feature sections. No functional changes; no new MessageKey.
// v1.0.10: docs-only patch.
//          - docs/README.zh.md image paths corrected — the Chinese
//            README lives in docs/ so its `extension-previews/...`
//            references resolved to docs/extension-previews/... and
//            rendered as broken images. All 14 paths prefixed with
//            `../`.
//          - docs/github-description.md Topics section synced to the
//            8-topic trimmed set actually on the GitHub About box.
//          - No code changes; no behavior change.
// v1.0.11: store submission metadata fix.
//          - vite.config.ts PUBLIC_DESCRIPTION shortened from 138
//            chars (English) to 42 chars (Chinese) so the built
//            dist/manifest.json description field passes Chrome
//            Web Store's 132-char validation. The English copy
//            "Redesigned new tab page featuring your bookmarks..."
//            was 6 chars over budget.
//          - dist/manifest.json description is what chrome://
//            extensions and the Chrome Web Store display. The
//            source manifest's "DO NOT LOAD" description warning
//            is unchanged; the public value is injected by
//            fixupDistManifest() at the end of `pnpm build`.
// v1.0.12: store submission metadata — redesign manifest description.
//          - vite.config.ts PUBLIC_DESCRIPTION rewritten in English
//            (122 chars) so the listing copy is readable for the
//            Chrome Web Store reviewers and English-language store
//            users. v1.0.11's 42-char Chinese stop-gap ("是基于书签
//            的新标签页...") passed the 132-char validation but
//            showed up as garbled CJK on the store listing for
//            non-Chinese-locale visitors.
//          - New copy: "Bookmark-driven new tab. Open folders as
//            Chrome tab groups or in split view. 12 built-in
//            themes + unlimited custom themes."
//          - The 12 built-in tweakcn themes are the same list as
//            v1.0.5 (AstroVista, MX-Brutalist, Remedy's Control,
//            Magic 2, Astra, Mimi, Manga Vibe, win86, Random Theme
//            02, Rose, Kawi Green, Optimus). "Unlimited custom
//            themes" refers to the runtime tweakcn URL / CSS-paste
//            importer in the Custom Themes tab.
// v1.0.13: store submission metadata — drop "Chrome" brand for Edge.
//          - vite.config.ts PUBLIC_DESCRIPTION: "Chrome tab groups"
//            → "tab groups" (and a 7-char shorter total). New copy
//            (115 chars): "Bookmark-driven new tab. Open folders as
//            tab groups or in split view. 12 built-in themes +
//            unlimited custom themes."
//          - The same chrome.tabGroups API is exposed by both
//            Chromium and Edge under that name, so dropping the
//            "Chrome" qualifier keeps the copy accurate for the
//            Edge Add-ons store without changing behavior.

// v1.0.18: Chrome Web Store zh_CN / zh_HK / zh_TW _locales — fix the
//          listing-language dropdown so users with `zh-CN` / `zh-TW` /
//          `zh-HK` browser locales can pick Chinese. New _locales/<dir>
//          directories (45-char appDescription each, well within the
//          132-char Chrome limit). The original _locales/zh/ is kept
//          for backward compatibility. Runtime i18n (src/lib/i18n/)
//          unchanged — Chrome store listing and runtime use separate
//          pipelines (see v0.2.117 + v1.0.14 design note).
//          Note: this commit retroactively bumps VERSION to 1.0.18.
//          v1.0.18 was uploaded to the Chrome Web Store with VERSION
//          still at 1.0.16 (the same drift pattern as v1.0.14); the
//          bump lands here so the v1.0.18 git tag represents the
//          fully-correct source tree (all three version strings in
//          sync), even though the Chrome Store zip is unchanged.
// v1.0.17: pure-white / pure-black favicons on matching backgrounds
//          now visible. Adaptive `filter: drop-shadow()` halo via
//          `color-mix(in oklch, var(--foreground) 50%, transparent)`
//          replaces the old opaque background panel — light themes get
//          a dark halo (white icons readable), dark themes get a light
//          halo (black icons readable). Applied to #main a .icon,
//          .search-result-favicon, .picker-favicon. Folder SVG icons
//          exempt (currentColor already gives enough contrast).
// v1.0.16: fix(theming) — fontColor setting now applies to bookmark
//          link text + folder titles (previously only affected folder
//          action icons, undo button, options button, etc.). The link
//          color cascade was `var(--card-foreground, var(--newtab-text))`
//          since v0.2.83 — the theme's `--card-foreground` always won,
//          silently overriding the user's fontColor. Fix: introduce a
//          new CSS var `--newtab-link-color`, written by apply.ts when
//          fontColor is set, and placed at the TOP of the link / folder-
//          icon cascade. Default case (fontColor unset) preserves the
//          v0.2.83 behavior (cascade falls through to `--card-foreground`
//          then `--newtab-text`).
// v1.0.15: undo button polish — small "session-only" hint floats below
//          the undo button explaining that the history stack is
//          in-memory and clears on refresh. Button box-model kept
//          at the original size (padding 7px 14px + font-size 1.2rem
//          + line-height 1.4, ~33px tall); the hint is positioned
//          absolutely (top: calc(100% + 4px)) anchored to the
//          .undo-wrap div so it "floats" beneath the button without
//          affecting the topbar's flex layout. New MessageKey
//          undo.sessionHint added to all 10 catalogs.
//          Note: development went through 4 design iterations on
//          feat/undo-button-polish (button-grown-to-match-height →
//          padding-shrunk → hint-inline-inside-button → hint-floats-
//          below). All kept in git history; only this final design is
//          released as v1.0.15.
// v1.0.13: store submission metadata — drop "Chrome" brand for Edge.
// v1.0.14: Chrome Web Store listing translation support (default_locale
//          + 10 _locales/<code>/messages.json). Version constant
//          intentionally not bumped in this commit (caught later —
//          v1.0.15 above fixed the drift).
// v1.0.13: store submission metadata — drop "Chrome" brand for Edge.
// v1.0.19: popup Open Split button goes through t('popup.openSplit')
//          instead of hardcoded English; single-URL split view now
//          navigates to the URL (folder-actions-handler.ts → openSplit
//          + split-view.ts → renderSplitView defence in depth); folder
//          action icons honour Ctrl/Cmd + left click → background new
//          tab via resolveNewtabMode.
// v1.0.20: context menu 'Create new column' / 'Remove folder' now go
//          through t('contextMenu.createNewColumn') / t('contextMenu.removeFolder')
//          instead of hardcoded English; 'Include layout' checkbox
//          state in advanced tab persists to localStorage so it
//          survives tab switches; Settings.font / fontSize / fontWeight
//          renamed to globalFont / globalFontSize / globalFontWeight,
//          defaults empty / 0, 3-tier cascade (per-theme > global >
//          hardcoded fallback) implemented in resolveEffectiveSettings;
//          new MessageKey settings.section.fontCascadeHint added to all
//          10 catalogs with explanatory hint at the bottom of the
//          appearance tab.
// v1.0.21: actually-fixed bug from v1.0.20 — the second context-menu
//          `SearchReplace` for 'Remove folder' silently failed
//          (indentation mismatch: file had 8+10 spaces, pattern was
//          6+8). Re-applied manually. Also added 'Global' prefix to
//          the three new global font row labels — new MessageKeys
//          settings.field.globalFont / globalFontSize /
//          globalFontWeight in all 10 catalogs. Per-theme <details>
//          rows keep the bare settings.field.font / fontSize /
//          fontWeight labels; descriptions stay shared.
// v1.0.22: bumped default values for globalFont / globalFontSize /
//          globalFontWeight from '' / 0 / 0 to 'Sans-serif' / 16 / 400
//          (matching the hardcoded fallbacks in resolveEffectiveSettings)
//          so the global inputs show a real value by default. The `||`
//          cascade still treats '' / 0 as "no override" so clearing
//          the input keeps meaning. One-time migration in initSettings
//          fills empty / 0 values for v1.0.20/21 upgraders. Per-theme
//          <details> inputs automatically follow (they cascade to the
//          global value when no override is set).
// v1.0.23: simplification — remove the per-theme font override tier
//          that v1.0.20-22 added. Users who want per-theme font
//          customization write it in the per-theme customCss textarea.
//          Renames globalFont / globalFontSize / globalFontWeight
//          back to font / fontSize / fontWeight (only 1 tier now — the
//          "global" prefix is misleading without a per-theme tier to
//          distinguish from). PER_THEME_KEYS shrinks from 11 to 8
//          fields. resolveEffectiveSettings cascade for font is now
//          2-tier (global + hardcoded) instead of 3-tier (per-theme
//          + global + hardcoded). settings.field.globalFont* and
//          settings.section.fontCascadeHint MessageKeys removed (10
//          catalogs reverted). Storage migration: copy globalFont*
//          → font* on upgrade from v1.0.20-22.
// v1.0.24: bug — the 3 global font rows (字体 / 字号 / 字重) in
//          the appearance tab main flow had a ↩ revert button that
//          didn't disappear after the user clicked it. Root cause:
//          the global revert handler in createRow sets the input
//          value + persists to storage but never calls
//          refreshRevertVisibility(), so the button visibility
//          stayed as the user had last set it (i.e., visible).
//          Programmatic value assignment doesn't fire change /
//          input events, so the per-input refreshRevertVisibility
//          listeners attached to the input don't run. Color inputs
//          were unaffected because refreshInputsFromSettings
//          re-evaluates their revert buttons on storage.onChanged;
//          per-theme <details> rows were unaffected because the
//          per-theme branch explicitly sets
//          `revertBtn.style.display = 'none'`. Fix: add
//          refreshRevertVisibility() to both the color and
//          non-color branches of the global revert handler.
// v1.1.0: minor release consolidating v1.0.25 → v1.0.31.
//          - Special-folder "Remove folder" right-click now toggles
//            the matching show* setting instead of trying to move
//            the folder (v1.0.25). SHOW_KEY_MAP in special-folders.ts.
//          - "Remove folder" takes effect immediately — explicit
//            renderColumns() after updateSetting since
//            chrome.storage.onChanged doesn't fire on the same tab
//            (v1.0.26).
//          - New `showBar` / `showOther` settings to hide the
//            built-in bookmark bar / other bookmarks roots
//            (v1.0.26).
//          - Apps link gets its own right-click menu with a "Remove"
//            option (v1.0.27).
//          - Empty-state UI when all special folders + root folders
//            are hidden — centered hint + "Show bookmark bar" button
//            (v1.0.28). Trigger widened to cover empty folders inside
//            non-empty columns (v1.0.29) by reading li.dataset.type.
//          - "Remove folder" for special folders is no longer hidden
//            by lockColumns (v1.0.30).
//          - Toast (lib/toast.ts) shown at top-center when
//            lockColumns rejects a new-column drop (v1.0.31).
//          - 7 new i18n keys (10 catalogs updated).
// v1.1.1: regular-folder "Remove from column" is now shown even
//          when lockColumns is on. Rationale: removing a folder
//          from a column is the inverse of dragging it in, and the
//          user has not expressed a desire to lock the
//          folder→parent relationship. createNewColumn (which adds
//          a new column) is still gated by lockColumns. See
//          context-menu.ts:179-255.
// v1.1.2: skip the regular removeRow item for folders that are
//          also in SHOW_KEY_MAP (bookmark bar / other bookmarks).
//          Those folders get a "Remove" item from the special-folder
//          branch (toggles a show* setting) — without this guard
//          the user would see two items with the same label but
//          different effects (removeRow = take folder out of column,
//          show*=0 = hide the entire column). The show* action is
//          the canonical one for these folders.
// v1.1.7: silence "Unchecked runtime.lastError: Can't find bookmark
//          for id." console warning that fires on edge://newtab/ /
//          chrome://newtab/ devtools after the user deletes a folder
//          that had been dragged out into a column. Root cause: the
//          `getBookmark(id)` and `getBookmarkSubTree(id)` wrappers in
//          lib/chrome/bookmarks.ts called chrome.bookmarks.get /
//          getSubTree but never read `chrome.runtime.lastError` in
//          the callback. When Chrome's bookmarks layer can't find
//          the id it sets lastError AND calls the callback with an
//          empty/undefined payload; the previous code just resolved
//          the promise and let lastError dangle, which Chrome then
//          surfaces as the "Unchecked" warning. The data was
//          already being handled correctly downstream —
//          `recordMovedOutForIds` and `restoreMovedOutForRemovedId`
//          wrap `getBookmark` in try/catch, and `resolveNode` in
//          column.ts:221 returns null when `getBookmarkSubTree`
//          returns undefined so renderColumn falls through to the
//          v1.1.4 empty-column placeholder. The fix is purely in
//          the wrappers: read `chrome.runtime.lastError` before
//          resolving, and resolve to `undefined` so the semantics
//          of "id not found" stay identical. No new MessageKey, no
//          UI change.
// v1.1.6: skip the undo snapshot when a drop leaves the layout
//          unchanged. The user could drag a folder back to its
//          original position — most commonly, dragging a folder
//          within its own multi-folder column to the slot it
//          already occupied (addRow removes A from the source
//          and re-inserts at the same position, so the columns
//          array comes out structurally identical). Pushing
//          that as an undo step was misleading: the undo badge
//          ticked up but pressing undo did nothing. New
//          `isSnapshotEqual(snapshot, columns, movedOut)` helper
//          in history.ts compares both `columns` (length / per-
//          column length / ids in order) and `movedOut` (keys /
//          per-key id arrays in order). Wired into both push
//          points in drop-handler.ts (the empty-column branch
//          and the main addRow / addColumn branch) via a small
//          `isLayoutUnchanged()` helper. Order matters in both
//          fields — addRow / removeRow rely on the user-perceived
//          order being preserved through the snapshot.
// v1.1.5: disable HTML5 drag on bookmark link elements. <a href>
//          elements have `draggable=true` in the browser's default UA
//          stylesheet, which means grabbing a link fires a native
//          link drag. The drag's `dragstart` bubbles up to the parent
//          column div, whose `enableDragColumn` handler calls
//          `setDragIds` with EVERY folder id in the column
//          (drag-column.ts:26-28). The user is now dragging the whole
//          column, not the link. On release the drop handler runs,
//          finds nothing actually changed (the user dropped on the
//          same column), and pushes a snapshot onto the undo stack —
//          the user sees "undo shows a step but nothing reverts".
//          Fix: set `a.draggable = false` in renderLink
//          (link.ts:52) so neither the native link drag nor the
//          bubble-to-column side effect can fire. The Apps special
//          folder is the one link that should still be draggable, and
//          it already re-enables draggable=true via
//          `enableDragFolder` (link.ts:168-170) which also calls
//          `event.stopPropagation()` in its dragstart handler — Apps
//          behaves like a folder, not a regular link.
// v1.1.4: two empty-state bug fixes.
//          - Import: a settings JSON whose `layout` block was
//            exported from a different Chrome (or earlier in this
//            Chrome's lifetime) may contain ids that no longer
//            point to a folder — the user deleted the folder, the
//            user repurposed the id as a regular link, or the
//            user re-organised bookmarks so the id is now a
//            descendant. Previously the import accepted all
//            non-empty string ids and tried to render them; the
//            resulting column contained a node that didn't render
//            and the column was effectively empty. Now we
//            batch-validate every imported id against
//            chrome.bookmarks.get (one round-trip) and drop any
//            that resolve to a link or no longer exist. The
//            dropped count is surfaced via window.alert so the
//            user knows the layout was trimmed (new MessageKey
//            settings.advanced.importLayoutDropped, all 10
//            catalogs). Special folder ids (apps / top / recent /
//            closed / devices / 1 / 2) are still always
//            accepted — they are runtime stubs, not chrome
//            bookmark ids. New getBookmarks(ids[]) wrapper in
//            lib/chrome/bookmarks.ts (mirrors getBookmark).
//          - Empty column: when the only folder in a column is
//            deleted from Chrome bookmarks, the column div
//            renders nothing and (more importantly) the
//            column-level context menu is never attached, so
//            the user can't right-click → remove the column or
//            drag a new folder in. Previously board.ts's
//            `col.length === 0 → false` filter hid the column
//            entirely in the rare case the layout itself was
//            empty. Fix: keep the column div in the DOM (the
//            drop handler reads the column index off .column
//            siblings, so this is required for drops to work),
//            render a "Drop a folder here" placeholder
//            (pointer-events: none so right-click still reaches
//            the column), and attach the column-level context
//            menu via a new renderEmptyColumnPlaceholder()
//            helper in column.ts. The placeholder is reached
//            from all three empty branches of renderColumn
//            (rawIds empty / single-id showRoot-false resolves
//            to null / multi-folder all resolve to null) so
//            any combination of deleted-folder + hidden-special
//            falls into the same UX. CSS: new
//            .column--empty + .column-empty-placeholder rules
//            in newtab.css — dashed border for the slot, muted
//            color for the placeholder text. New MessageKey
//            column.empty, all 10 catalogs.
// v1.1.15: fix import-layout false positive. `getBookmarks(ids)`
//          in src/lib/chrome/bookmarks.ts was calling the native
//          `chrome.bookmarks.get(ids, callback)` batch API. That
//          API has a fatal behaviour: when ANY one of the
//          requested ids doesn't exist (or is a leaf, etc.), the
//          entire call fails — `results = undefined`,
//          `chrome.runtime.lastError = "Can't find bookmark for
//          id."`. The wrapper's lastError branch mapped every
//          position to undefined, so a layout JSON with 4 valid
//          ids + 1 deleted id (e.g. 1753 in the test case) had
//          ALL 5 ids reported as "已跳过 5 个项目" — even the 4
//          that were perfectly valid. Fix: rewrite `getBookmarks`
//          to `Promise.all(ids.map(id => getBookmark(id)))` —
//          each id now succeeds or fails independently. The
//          single-id `getBookmark` wrapper already reads
//          `chrome.runtime.lastError` and resolves to `undefined`
//          for the "id not found" case (v1.1.7), so per-id
//          behaviour is unchanged. Order is preserved because
//          `Promise.all` resolves in the input-array order.
// v1.1.14: drop the v1.1.12 flag emoji from the language
//          dropdown — keep only the 2-letter ISO code prefix
//          introduced in v1.1.13. Rationale: (1) flag emoji
//          rendering is platform-dependent and some
//          (Chrome/macOS) combinations render 🇭🇰 / 🇹🇼
//          ambiguously, leaving the user unable to tell the
//          three Chinese variants apart visually; (2) the
//          distinction between the three Chinese variants is
//          politically sensitive in some regions, and shipping
//          a flag emoji opens the project up to that whole
//          debate. A 2-letter ISO code is unambiguous, renders
//          identically everywhere, and stays out of it. Code
//          change summary: removed the `LOCALE_FLAGS` map and
//          its re-export from src/lib/i18n/types.ts and
//          src/lib/i18n/index.ts; removed the `flag` import +
//          usage from createLanguageSelect in
//          src/newtab/settings-panel.ts. The 'auto' option
//          stays code-less. Final layout per option is now
//          `HK  中文（香港） (Chinese (Hong Kong))`.
// v1.1.12: language dropdown now prefixes each option with the
//          locale's region flag (e.g. `🇺🇸 English`,
//          `🇨🇳 中文 (Chinese, Simplified)`, `🇭🇰 中文
//          (Chinese, Hong Kong)`, `🇹🇼 中文 (Chinese,
//          Traditional)`). The flags live in a new
//          `LOCALE_FLAGS: Record<LocaleCode, string>` map at
//          src/lib/i18n/types.ts — keyed by `LocaleCode` so
//          TypeScript catches any missing flag at the moment a
//          38th locale is added. Each flag is a pair of Unicode
//          Regional Indicator Symbols (e.g. 🇺🇸 = U+1F1FA +
//          U+1F1F8) — zero-asset, no SVG, no bundle weight.
//          Origin-country convention for regionless locales
//          (en → 🇺🇸, pt → 🇵🇹, ar → 🇸🇦); ca (Catalan) falls
//          back to 🇪🇸 since there's no Catalonia country code;
//          ps (Pashto) → 🇦🇫.
// v1.1.13: language dropdown also prefixes each option with the
//          ISO 3166-1 alpha-2 country code (`HK` / `TW` / `CN` /
//          ...) right after the flag emoji. The flag emoji is a
//          pair of Unicode Regional Indicator Symbols, which not
//          every platform renders reliably — some Chrome emoji
//          fonts render 🇭🇰 / 🇹🇼 ambiguously or skip them
//          entirely. The 2-letter code is a textual fallback that
//          always displays, so the user can tell zh-HK / zh-TW /
//          zh-CN apart even on platforms where the flags look
//          wrong. New LOCALE_REGION_CODES map in
//          src/lib/i18n/types.ts (Record<LocaleCode, string>,
//          same lockstep-with-LOCALE_FLAGS constraint). create-
//          LanguageSelect in settings-panel.ts now joins up to 4
//          parts per option: flag + code + selfName + englishName,
//          each separated by a double space. The `'auto'` option
//          stays code-less (it means "follow the browser", not a
//          specific region).
// v1.2.2: fresh-install onboarding redesign. Three changes
//          surface only when the user has no stored layout (= new
//          install or explicit reset). Returning users with a
//          stored layout skip every new code path entirely.
//          - 3-column default layout (was 2). col 0 is now an
//            empty placeholder slot instead of being auto-filled
//            with the built-in bookmark bar + other bookmarks.
//            col 1 holds the bookmark bar (id='1'), col 2 holds
//            the other-bookmarks root (id='2') + 5 special
//            folders. New path: `verifyColumns()` default branch
//            in src/features/drag-drop/layout-ops.ts. Settings-
//            gated: `showBar=0` / `showOther=0` / `showXxx=0`
//            still drop the corresponding folder from its column.
//          - The bookmark bar (id='1') is default-expanded on
//            fresh install. Uses the existing
//            `markFoldersExpandedOnce(['1'])` one-shot override
//            (consumed on the first render) + a persistent
//            `setLocal('open.col.1', true)` write so subsequent
//            page refreshes keep it expanded until the user
//            manually collapses it. Mirrors the import flow in
//            src/newtab/settings-panel.ts:2634-2638. Other
//            folders (id='2', specials) are NOT auto-expanded.
//          - Empty column placeholder now shows a 2-line hint.
//            Main row (the existing 'column.empty' MessageKey)
//            stays as the primary call to action; new
//            'column.emptyHint' MessageKey renders a dimmer
//            second line with "Drag folders here from the
//            bookmark bar. One column can hold many." in 37
//            locales. New `.column--empty .column-empty-hint`
//            rule in styles/newtab.css — 0.9em / 35% text
//            opacity / `pointer-events: none` (so right-click
//            still reaches the column's context menu).
//          No Settings schema change, no new permission, no new
//          chrome.* API call. Bundle delta: ~0.5KB new i18n +
//          ~20 lines CSS/JS (negligible).
// v1.2.7: hotfix — `swapColumns` now actually keeps all three
//          columns on a "Move column left". The v1.2.6 helper
//          routed the move through `swapColumns(a, b)` but the
//          helper still called `saveLayout()` afterwards, which
//          fires `verifyColumns()`. `verifyColumns` has its own
//          empty-column cleanup that, just like the original
//          `addColumn` cleanup, deletes any non-col-0 empty
//          column. So the swap produced `[['1'], [], ['2',
//          ...]]` (3 cols ✓), then `verifyColumns` saw col 1 =
//          `[]` and removed it, ending at `[['1'], ['2', ...]]`
//          (2 cols ✗) — the original "空列消失" bug, just
//          relocated. v1.2.7 bypasses `saveLayout` /
//          `verifyColumns` in `swapColumns`: in-place swap +
//          manual `coords` rebuild (the only verifyColumns
//          step a swap needs) + `setLocal` + `renderColumns`
//          directly. The missing-root check inside
//          verifyColumns is intentionally skipped because a
//          swap never changes the set of root ids present.
// v1.2.8: hotfix — persisted empty columns survive a page
//          refresh. v1.2.7 fixed the in-memory swap, but on
//          the next `loadLayout()` the stored layout (e.g.
//          `[['1'], [], ['2', ...]]` from a "Move left" on the
//          bookmark bar) still went through `verifyColumns()`,
//          whose empty-column sweep deleted the vacated col 1
//          → 2 cols on every refresh. Fix: split `verifyColumns`
//          in two. The full version (still used by `saveLayout`
//          and the drag-drop mutation path) keeps the empty-
//          column cleanup because a drop that empties a column
//          is a stale artefact that should be swept. The new
//          lightweight `verifyLayoutPreservingEmpties` (used
//          by `loadLayout` only) keeps the fresh-install
//          branch + missing-root check + coords rebuild, but
//          skips the empty-column sweep — so user-driven
//          empties (e.g. the swap's vacated col) round-trip
//          through storage unchanged. The drag-drop path is
//          unaffected: `addColumn` / `addRow` / `removeRow`
//          keep their in-function cleanup loops, and only legitimate drag-emitted
//          empties get swept there (the v1.2.3-v1.2.6 `x !== 0` exemption and
//          `addColumn` empty-ids early-return are unchanged).
// v1.2.9: hotfix — "Move column right" on the v1.2.2 col 0 empty
//          placeholder now actually does something. v1.2.6 routed
//          "Move column left" through `swapColumns` (a true swap)
//          so the empty col could move past the bookmark bar
//          without being eaten by `verifyColumns` — but "Move
//          column right" still used `addColumn(ids, index + 1)`,
//          and v1.2.6's `addColumn` empty-ids early return turned
//          that into a no-op for the empty col. Net: the
//          bookmark bar "Move left" worked (swap ↔ col 0), but
//          the col 0 "Move right" was silent — the user could
//          see "Move right" on the menu, click it, and nothing
//          changed. Fix: route "Move column right" through
//          `swapColumns(index, index + 1)` too, symmetric with
//          the v1.2.6 left-move fix. For non-empty cols both
//          approaches give the same end state (verified by
//          tracing the 3- and 4-col default layouts through
//          both paths), so this is a no-op for the working case
//          and an actual fix for the empty col case.
export const VERSION = '1.2.9';
