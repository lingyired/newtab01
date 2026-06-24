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

export const VERSION = '1.0.12';
