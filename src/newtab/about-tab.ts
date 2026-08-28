// v1.0.0: "About" tab content — credits, inspiration, theme source,
// repo link. Pure read-only markup: the tab has no settings, so it
// never needs to participate in storage.onChanged refresh or
// per-theme override logic. The tab is rebuilt when the user
// switches to it (in-place refresh on language change re-runs the
// same `renderAboutTab` to pick up new strings — see
// `refreshSettingsPanelLocale` in settings-panel.ts).
//
// Design follows the project's "no Card by default" UI principle
// (CLAUDE.md §4): four sections separated by hairlines, each is a
// small group of styled text. No thick borders, no decorative
// gradients, no card mosaics.

import { t, getLocale } from '../lib/i18n';
import { VERSION } from '../lib/version';
import noLazyloadIcon from '../../lingyired/nolazyload.png';
import fund01Icon from '../../lingyired/fund01.png';

/** Hard-coded external URLs. These never go through `t()` because
 *  URLs are not localizable text — translating a URL would break
 *  the link. The visible link text (e.g. "tweakcn", "github.com/
 *  lingyired/newtab01") IS localized via the catalog. */
const AUTHOR_GITHUB_URL = 'https://github.com/lingyired';
const REPO_URL = 'https://github.com/lingyired/newtab01';
const TWEAKCN_COMMUNITY_URL = 'https://tweakcn.com/community';
const HOMEPAGE_URL = 'https://lingai.net/newtab01/';

/** A row in the "More from this author" list. `iconUrl` is a
 *  bundled PNG from the repo's `lingyired/` dir, keyed by the
 *  extension's slug (fund01 / nolazyload — match on filename).
 *  The visible name + optional one-line description go through
 *  `t()`. `zhCNOnly` rows are hidden unless the active locale is
 *  Simplified Chinese — fund01's site and copy are Chinese-only,
 *  so we don't surface a dead link to users in other languages.
 *  To add another extension: drop a `{ url, iconUrl, nameKey }`
 *  row here and add the matching MessageKey to types.ts + all 37
 *  catalogs (tsc will catch missing entries). */
type OtherExtension = {
  url: string;
  iconUrl: string;
  nameKey: 'about.extension.noLazyload' | 'about.extension.fund01';
  descKey?: 'about.extension.fund01Desc';
  zhCNOnly?: boolean;
};

const OTHER_EXTENSIONS: ReadonlyArray<OtherExtension> = [
  {
    url: 'https://chromewebstore.google.com/detail/no-lazyload-disable-image/gdaoomgmekonglmdeaoengblkjeopall',
    iconUrl: noLazyloadIcon,
    nameKey: 'about.extension.noLazyload',
  },
  {
    url: 'https://lingai.net/fund01/',
    iconUrl: fund01Icon,
    nameKey: 'about.extension.fund01',
    descKey: 'about.extension.fund01Desc',
    zhCNOnly: true,
  },
];

/** Author handle shown next to "by". Kept as a const so the
 *  github.com/lingyired text in the catalog stays a description
 *  (not a stringly-typed copy of the handle). */
const AUTHOR_HANDLE = 'lingyired';

/** Tooling string shown in "Built with X + Y". The two names
 *  (MiniMax M3 / TRAE Work) are proper nouns — not localizable. */
const BUILT_WITH_TOOLS = 'MiniMax M3 + TRAE Work';

/** Build an external link with the project's existing sp-link
 *  styling. MV3 blocks <a target="_blank"> from chrome-extension://
 *  pages to https URLs (see link.ts:48), so we use the same
 *  `window.open(url, '_blank', 'noopener,noreferrer')` pattern that
 *  the custom-themes tweakcn link uses. */
function makeExternalLink(href: string, label: string, className = 'sp-link'): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.className = className;
  // Invariant: a plain-<label> link always sets text; the icon-row
  // link passes '' because its children (<img> + <span>) carry the
  // content instead.
  if (label) a.textContent = label;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  });
  return a;
}

/** Build a separator dot (·) between the three pieces of the
 *  version line. Middle dot is a typographic separator that reads
 *  well in every locale. */
function makeSep(): Text {
  return document.createTextNode(' · ');
}

/** Render the "v1.0.0 · by lingyired · Built with X + Y" header
 *  block at the top of the About tab. The author name and the
 *  "Built with..." text are localized via `t()`; the handle
 *  "lingyired" and the tools name are proper nouns. */
function buildVersionLine(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'sp-about-version';

  // "v{version}" — the only place the version number is
  // interpolated; the prefix is localized but the number itself
  // is language-neutral.
  p.appendChild(
    document.createTextNode(t('about.versionPrefix', { version: VERSION })),
  );
  p.appendChild(makeSep());

  // "by {author}" — {author} is a link to the GitHub profile.
  // Split the byline so we can wrap the author name in an <a>.
  const byline = t('about.authorByline', { author: AUTHOR_HANDLE });
  // The catalog is expected to keep {author} inline ("by {author}");
  // we render the static text + a real anchor for the handle.
  // Implementation note: the catalog format is "by {author}" (no
  // markup), so we split the byline on the author handle and wrap
  // that segment in <a>. If the active locale's translation
  // doesn't include the handle verbatim (highly unlikely but
  // possible after manual editing), we fall back to rendering the
  // whole byline as plain text.
  const handleIdx = byline.indexOf(AUTHOR_HANDLE);
  if (handleIdx >= 0) {
    p.appendChild(document.createTextNode(byline.slice(0, handleIdx)));
    p.appendChild(makeExternalLink(AUTHOR_GITHUB_URL, AUTHOR_HANDLE));
    p.appendChild(document.createTextNode(byline.slice(handleIdx + AUTHOR_HANDLE.length)));
  } else {
    p.appendChild(document.createTextNode(byline));
  }
  p.appendChild(makeSep());

  // "Built with {tools}" — the tools name is a proper noun, kept
  // outside the catalog.
  p.appendChild(
    document.createTextNode(t('about.builtWith', { tools: BUILT_WITH_TOOLS })),
  );
  return p;
}

/** Render the "Inspired by HNTP, extends it with: theming / split
 *  view / tab groups / bookmark search" paragraph + feature list. */
function buildInspiredSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'sp-about-section';

  const intro = document.createElement('p');
  intro.className = 'sp-about-lede';
  intro.textContent = t('about.inspiredBy');
  wrap.appendChild(intro);

  const list = document.createElement('ul');
  list.className = 'sp-about-features';
  // 4 features — order matters (matches the user-facing list and
  // the 5-new-capabilities story in CLAUDE.md §2). Each item is
  // a separate t() call so future re-orderings stay cheap.
  for (const key of [
    'about.feature.theming',
    'about.feature.splitView',
    'about.feature.tabGroups',
    'about.feature.bookmarkSearch',
  ] as const) {
    const li = document.createElement('li');
    li.textContent = t(key);
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

/** Render the "Theming is powered by tweakcn" paragraph with an
 *  inline link to tweakcn.com/community. */
function buildThemesSection(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'sp-about-paragraph';
  // The catalog format is "Theming is powered by {link}." —
  // split around the {link} token and wrap that segment in <a>.
  const labelKey = t('about.themesLink');
  const template = t('about.themesIntro', { link: labelKey });
  const idx = template.indexOf(labelKey);
  if (idx >= 0) {
    p.appendChild(document.createTextNode(template.slice(0, idx)));
    p.appendChild(makeExternalLink(TWEAKCN_COMMUNITY_URL, labelKey));
    p.appendChild(document.createTextNode(template.slice(idx + labelKey.length)));
  } else {
    // Defensive fallback — if a locale's translation omits the
    // token, append the link at the end so the user still has a
    // way to reach the gallery.
    p.appendChild(document.createTextNode(template));
    p.appendChild(makeExternalLink(TWEAKCN_COMMUNITY_URL, labelKey));
  }
  return p;
}

/** Render the "Open source on GitHub: github.com/lingyired/newtab01"
 *  paragraph with an inline link to the repo. */
function buildRepoSection(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'sp-about-paragraph';
  // Same split-and-wrap pattern as buildThemesSection, against
  // the `about.repoLink` token.
  const labelKey = t('about.repoLink');
  const template = t('about.repoIntro', { link: labelKey });
  const idx = template.indexOf(labelKey);
  if (idx >= 0) {
    p.appendChild(document.createTextNode(template.slice(0, idx)));
    p.appendChild(makeExternalLink(REPO_URL, labelKey));
    p.appendChild(document.createTextNode(template.slice(idx + labelKey.length)));
  } else {
    p.appendChild(document.createTextNode(template));
    p.appendChild(makeExternalLink(REPO_URL, labelKey));
  }
  return p;
}

/** Render the "Homepage: lingai.net/newtab01" paragraph with an
 *  inline link to the project's product page. Mirrors
 *  buildRepoSection against the `about.homepageLink` token. */
function buildHomepageSection(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'sp-about-paragraph';
  const labelKey = t('about.homepageLink');
  const template = t('about.homepageIntro', { link: labelKey });
  const idx = template.indexOf(labelKey);
  if (idx >= 0) {
    p.appendChild(document.createTextNode(template.slice(0, idx)));
    p.appendChild(makeExternalLink(HOMEPAGE_URL, labelKey));
    p.appendChild(document.createTextNode(template.slice(idx + labelKey.length)));
  } else {
    p.appendChild(document.createTextNode(template));
    p.appendChild(makeExternalLink(HOMEPAGE_URL, labelKey));
  }
  return p;
}

/** Render the "More from this author" section: a list of links
 *  to the author's other extensions. The list source-of-truth is
 *  the `OTHER_EXTENSIONS` constant above — adding a new entry
 *  there automatically picks up here. Each row is a full-width
 *  clickable link showing the extension's icon + name (and, when
 *  present, a one-line description). Rows marked `zhCNOnly` are
 *  skipped unless the active locale is Simplified Chinese; we read
 *  `getLocale()` at render time so switching the language in place
 *  (via `refreshSettingsPanelLocale`) both hides fund01 and reveals
 *  it correctly. */
function buildMoreExtensionsSection(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'sp-about-section';

  const title = document.createElement('p');
  title.className = 'sp-about-lede';
  title.textContent = t('about.moreExtensionsTitle');
  wrap.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'sp-about-extensions';

  const locale = getLocale();
  for (const ext of OTHER_EXTENSIONS) {
    if (ext.zhCNOnly && locale !== 'zh-CN') continue;

    const li = document.createElement('li');
    li.className = 'sp-about-ext-item';

    const a = makeExternalLink(ext.url, '', 'sp-about-ext-link');

    const img = document.createElement('img');
    img.className = 'sp-about-ext-icon';
    img.src = ext.iconUrl;
    img.alt = '';

    const body = document.createElement('span');
    body.className = 'sp-about-ext-body';

    const name = document.createElement('span');
    name.className = 'sp-about-ext-name';
    name.textContent = t(ext.nameKey);
    body.appendChild(name);

    if (ext.descKey) {
      const desc = document.createElement('span');
      desc.className = 'sp-about-ext-desc';
      desc.textContent = t(ext.descKey);
      body.appendChild(desc);
    }

    a.appendChild(img);
    a.appendChild(body);
    li.appendChild(a);
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

/** Render the full About tab. Returns a `<div class="sp-tab-content">`
 *  matching the convention of every other tab in settings-panel.ts. */
export function renderAboutTab(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'sp-tab-content sp-about';

  // Section 1 — version + credits. The "header" of the page: the
  // single line that says "what is this, who made it, what version
  // is running". Sits at the top with no section divider above it.
  container.appendChild(buildVersionLine());

  // Hairline divider — visual section break without a card. Matches
  // the "default no Card; use section / divider" principle.
  container.appendChild(buildDivider());

  // Section 2 — inspiration + features.
  container.appendChild(buildInspiredSection());

  container.appendChild(buildDivider());

  // Section 3 — themes source.
  container.appendChild(buildThemesSection());

  container.appendChild(buildDivider());

  // Section 4 — project homepage (product page).
  container.appendChild(buildHomepageSection());

  container.appendChild(buildDivider());

  // Section 5 — open source repo.
  container.appendChild(buildRepoSection());

  container.appendChild(buildDivider());

  // Section 6 — other extensions by the same author. Sits at the
  // bottom because it's the "after you're done reading about this
  // project" footer of the page.
  container.appendChild(buildMoreExtensionsSection());

  return container;
}

/** Thin horizontal rule used between sections. A single 1px line
 *  in `--border` color, full content width. */
function buildDivider(): HTMLElement {
  return document.createElement('hr');
}
