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

export const VERSION = '1.0.9';
