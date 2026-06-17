// AI prompt generator — builds a structured prompt that users can paste into any
// AI assistant (ChatGPT, Claude, Gemini, etc.) to generate custom CSS for the
// newtab01 new-tab page. The prompt includes the DOM structure, available CSS
// variables, and a few example snippets so the assistant has enough context to
// produce working styles without guessing the markup.
//
// Usage: copy the returned string to the clipboard, paste it into an AI chat,
// replace the "USER REQUEST" line with what you want to customize, and paste
// the assistant's CSS output back into the Custom CSS textarea on the
// Advanced tab.

/**
 * Build a prompt string the user can send to an AI assistant to generate
 * custom CSS for newtab01. The output is a static, multi-line template; the
 * caller is expected to inject their own request by editing the placeholder
 * line before sending it to an AI.
 */
export function buildAIPrompt(): string {
  return `You are helping customize the visual appearance of newtab01, a Chrome extension new-tab page. The new-tab page shows the user's bookmarks organized into columns, with a top search bar, folder/folder-action icons, and drag-and-drop reordering.

# DOM structure (top-down)

` + '```' + `
#root
└── #topbar
│   ├── .search-wrap
│   │   ├── .search-input              ← bookmark search input
│   │   └── #search-results            ← results dropdown (hidden until focused)
│   │       ├── .search-results-list
│   │       │   └── .search-result-item
│   │       └── .search-results-footer
│   └── #options_button                ← settings cog (top-right)
├── #search-overlay                    ← dimmed backdrop below topbar
└── #main                              ← bookmark board container
    ├── .column                        ← one column of folders
    │   └── ul
    │       └── li[data-node-id][data-depth]
    │           ├── a.folder           ← folder header (with .open when expanded)
    │           │   ├── .folder-icon   ← left icon
    │           │   ├── .link-text     ← folder title
    │           │   └── .folder-actions ← 3 hover-only icon buttons
    │           │       └── .folder-action-btn (×3)
    │           └── div[data-wrap]     ← collapsible child container
    │               └── ul
    │                   └── li
    │                       └── a       ← bookmark link (li > a with .icon + .link-text)
    ├── .column
    └── .column
` + '```' + `

Special folder classes added to the ` + '`' + `a` + '`' + ` element based on data source: ` + '`' + `.top` + '`' + `, ` + '`' + `.recent` + '`' + `, ` + '`' + `.closed` + '`' + `, ` + '`' + `.devices` + '`' + `, ` + '`' + `.apps` + '`' + `, ` + '`' + `.window` + '`' + `, ` + '`' + `.error` + '`' + `, ` + '`' + `.empty` + '`' + `. Bookmark links use the same ` + '`' + `a` + '`' + ` selector as folder headers.

# Available CSS variables (semantic — prefer these over hard-coded colors)

Newtab-specific:
- ` + '`' + `--newtab-bg` + '`' + `                  page background
- ` + '`' + `--newtab-surface` + '`' + `             link / folder card background
- ` + '`' + `--newtab-text` + '`' + `                default link text color
- ` + '`' + `--newtab-highlight` + '`' + `           hover background color
- ` + '`' + `--newtab-highlight-text` + '`' + `      hover text color
- ` + '`' + `--newtab-drop-indicator` + '`' + `      drag-and-drop indicator color
- ` + '`' + `--newtab-shadow-blur` + '`' + `         hover glow blur radius
- ` + '`' + `--newtab-highlight-round` + '`' + `     card border-radius
- ` + '`' + `--newtab-fade-ms` + '`' + `             fade transition duration
- ` + '`' + `--newtab-slide-ms` + '`' + `            slide transition duration

Base semantic:
- ` + '`' + `--background` + '`' + `, ` + '`' + `--foreground` + '`' + `
- ` + '`' + `--primary` + '`' + `, ` + '`' + `--primary-foreground` + '`' + `
- ` + '`' + `--muted` + '`' + `, ` + '`' + `--muted-foreground` + '`' + `
- ` + '`' + `--border` + '`' + `, ` + '`' + `--ring` + '`' + `

# User request

[REPLACE THIS LINE with what you want to customize — e.g. "Make the folder cards have a soft pastel background, rounded corners, and a subtle hover lift effect" or "Hide the folder action buttons entirely" or "Add a left-side accent bar to each folder that highlights on hover"]

# Instructions

- Return only valid CSS. Do not include HTML or JavaScript.
- The output will be pasted into the Custom CSS textarea in the options page.
- Use the CSS variables above whenever a color or spacing value is needed; do not hard-code hex codes.
- Keep selectors flat (1–2 levels deep) — the DOM is shallow, so #main .folder, .search-input, #topbar are typical targets.
- Transitions should use ` + '`' + `var(--newtab-fade-ms)` + '`' + ` for opacity/color changes and ` + '`' + `var(--newtab-slide-ms)` + '`' + ` for height/transform animations.
- If you generate a small illustration, keep the selectors idempotent (so the user can paste the CSS multiple times without breaking anything).

# Example snippets (for reference only — adapt to the user request above)

Soft card with hover lift:
` + '```css' + `
#main a {
  background-color: var(--newtab-surface);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: transform var(--newtab-fade-ms) ease-out,
              box-shadow var(--newtab-fade-ms) ease-out,
              background-color var(--newtab-fade-ms) ease-out;
}
#main a:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--newtab-highlight);
  background-color: var(--newtab-highlight);
}
` + '```' + `

Subtle search input focus ring:
` + '```css' + `
.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--ring);
}
` + '```' + `

# Closing reminder

The CSS will be injected via a <style id="user-css"> element after theme CSS, so your styles can override theme defaults. Use higher-specificity selectors only when the cascade alone is not enough.`;
}
