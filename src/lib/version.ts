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
export const VERSION = '1.1.1';
