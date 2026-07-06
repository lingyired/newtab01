// i18n (internationalization) types
// Provides the LocaleCode union (10 supported locales) and the
// MessageKey union (~210 string identifiers). Locale catalog files
// must satisfy `Record<MessageKey, string>` — TS surfaces missing
// translations as compile errors at build time.
//
// v0.2.117: lightweight vanilla TS i18n (no library). The catalog
// lives in TypeScript files (not JSON) so we get type-safe key
// exhaustiveness checks for free.

/** All locales the extension ships with. Order is the order
 *  shown in the settings panel's "Language" dropdown.
 *
 *  v0.2.123: expanded from 10 → 33 locales. The new entries cover
 *  the Chrome Web Store top-30 LTR languages (Arabic / Hebrew /
 *  Persian / Urdu / Pashto explicitly excluded — those need RTL
 *  support and are tracked separately) plus explicit Traditional
 *  Chinese variants for Hong Kong (zh-HK) and Taiwan (zh-TW).
 *  Simplified Chinese was also renamed `zh` → `zh-CN` so the
 *  two Traditional variants can coexist as siblings. A
 *  backward-compat alias in `resolveLocale` (lib/i18n/index.ts)
 *  still accepts the bare `zh` tag (rare generic-Chinese browsers,
 *  pre-rename users) and maps it to `zh-CN`. */
export const SUPPORTED_LOCALES = [
  // Originally supported (10)
  'en',
  'zh-CN',
  'es',
  'ar',
  'hi',
  'fr',
  'pt',
  'de',
  'ja',
  'ru',
  // Traditional Chinese variants (2)
  'zh-HK',
  'zh-TW',
  // Tier 1 — high ROI (7)
  'ko',
  'it',
  'nl',
  'pl',
  'tr',
  'vi',
  'id',
  // Tier 2 — mid ROI (8)
  'sv',
  'da',
  'fi',
  'cs',
  'el',
  'hu',
  'ro',
  'th',
  // Tier 3 — long-tail (6) (NB chosen over generic `no` per BCP 47)
  'nb',
  'uk',
  'bg',
  'hr',
  'sk',
  'ca',
  // RTL additions (4) — v0.2.123 round 2.
  // Arabic (`ar`) is already in the LTR block above and is the
  //  first RTL locale the extension shipped with (v0.2.119). The
  //  four new RTL entries — Hebrew, Persian, Urdu, Pashto — are
  //  the remaining Chrome Web Store top-30 RTL languages. Their
  //  UI rendering is only partially polished (`<html dir="rtl">`
  //  is set automatically via the `RTL_LOCALES` set below, and
  //  search-result URLs / search input direction are handled in
  //  styles/globals.css), but full bidirectional layout work
  //  (column reversal, button icons, etc.) is tracked separately.
  'he',
  'fa',
  'ur',
  'ps',
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/** Locales whose script is right-to-left. Sets `dir="rtl"` on
 *  <html> at runtime. The CSS file (globals.css) has matching
 *  rules to keep search-result URLs LTR and link text rendering
 *  correctly within an RTL document. */
export const RTL_LOCALES = new Set<LocaleCode>(['ar', 'he', 'fa', 'ur', 'ps']);

/** The `Settings.language` field is a union: `'auto'` (follow
 *  the browser) OR an explicit LocaleCode. `'auto'` is the
 *  default; resolution happens in `resolveLocale`. */
export type LanguagePref = 'auto' | LocaleCode;

/** v1.1.14: ISO 3166-1 alpha-2 country code for each locale, used
 *  as the primary visual region hint in the language `<option>`
 *  text. The previous v1.1.12/v1.1.13 design also prepended a
 *  Unicode Regional Indicator flag emoji (e.g. `🇭🇰` / `🇹🇼` /
 *  `🇨🇳`); that was dropped in v1.1.14 because flag emoji
 *  rendering is platform-dependent and the visual distinction
 *  between the three Chinese variants is a political landmine
 *  in some regions. A 2-letter ISO code is unambiguous, always
 *  renders, and stays out of that whole debate.
 *
 *  Selection rules:
 *  - Locale has a region subtag (`zh-CN` / `zh-HK` / `zh-TW`) → that
 *    region's code. The whole point of splitting `zh` into 3
 *    variants is so the user can pick by region, so the code is
 *    the primary visual cue.
 *  - Locale has no region subtag → the "origin country" code by
 *    convention: `en` → `US` (matches Chrome's own UI), `pt` →
 *    `PT` (Portugal, the language's origin — not `BR` Brazil),
 *    `ar` → `SA` (Saudi Arabia, the Modern Standard Arabic
 *    reference region).
 *  - `ca` (Catalan) → `ES` fallback (no country code exists for
 *    the Catalonia region; Chrome uses the same fallback).
 *  - `ps` (Pashto) → `AF` (Afghanistan, where Pashto is a
 *    national language).
 *
 *  The code is prepended to the `<option>` text content. Since
 *  the browser lays out `<option>` text according to the document
 *  `direction`, the code lands on the visual start side
 *  automatically (left in LTR, right in RTL) — no CSS mirroring
 *  needed. */
export const LOCALE_REGION_CODES: Record<LocaleCode, string> = {
  en: 'US',
  'zh-CN': 'CN',
  es: 'ES',
  ar: 'SA',
  hi: 'IN',
  fr: 'FR',
  pt: 'PT',
  de: 'DE',
  ja: 'JP',
  ru: 'RU',
  'zh-HK': 'HK',
  'zh-TW': 'TW',
  ko: 'KR',
  it: 'IT',
  nl: 'NL',
  pl: 'PL',
  tr: 'TR',
  vi: 'VN',
  id: 'ID',
  sv: 'SE',
  da: 'DK',
  fi: 'FI',
  cs: 'CZ',
  el: 'GR',
  hu: 'HU',
  ro: 'RO',
  th: 'TH',
  nb: 'NO',
  uk: 'UA',
  bg: 'BG',
  hr: 'HR',
  sk: 'SK',
  ca: 'ES',
  he: 'IL',
  fa: 'IR',
  ur: 'PK',
  ps: 'AF',
};

/** All message keys. Each locale's `messages` map must have one
 *  string for every key. Adding a new key here forces every
 *  catalog file to be updated (TS will fail the build). */
export type MessageKey =
  // Settings panel — global
  | 'settings.title'
  | 'settings.close'
  | 'settings.tab.layout'
  | 'settings.tab.appearance'
  | 'settings.tab.customThemes'
  | 'settings.tab.features'
  | 'settings.tab.advanced'
  | 'settings.tab.about'
  | 'settings.revert.toDefault'
  | 'settings.revert.clearPerTheme'
  | 'settings.section.themeOverridesSummary'
  | 'settings.section.themeOverridesSummaryDark'
  | 'settings.section.themeOverridesSummaryLight'
  // Settings panel — language row
  | 'settings.field.language'
  | 'settings.field.languageDesc'
  | 'settings.language.auto'
  // Settings panel — layout tab
  | 'settings.field.spacing'
  | 'settings.field.spacingDesc'
  | 'settings.field.columnWidth'
  | 'settings.field.columnWidthDesc'
  | 'settings.field.align'
  | 'settings.field.alignDesc'
  | 'settings.align.left'
  | 'settings.align.center'
  | 'settings.align.right'
  | 'settings.field.lockColumns'
  | 'settings.field.lockColumnsDesc'
  | 'settings.field.showRoot'
  | 'settings.field.showRootDesc'
  | 'settings.field.autoScale'
  | 'settings.field.autoScaleDesc'
  | 'settings.field.lock'
  | 'settings.field.lockDesc'
  // Settings panel — appearance tab
  | 'settings.field.theme'
  | 'settings.field.themeDesc'
  | 'settings.field.activeSuffix'
  | 'themePicker.previewAriaLabel'
  | 'settings.field.darkMode'
  | 'settings.field.darkModeDesc'
  | 'settings.field.darkModeNote'
  | 'settings.darkMode.light'
  | 'settings.darkMode.system'
  | 'settings.darkMode.dark'
  | 'settings.field.width'
  | 'settings.field.widthDesc'
  | 'settings.field.hPos'
  | 'settings.field.hPosDesc'
  | 'settings.field.font'
  | 'settings.field.fontDesc'
  | 'settings.field.fontSize'
  | 'settings.field.fontSizeDesc'
  | 'settings.field.fontWeight'
  | 'settings.field.fontWeightDesc'
  | 'settings.field.fontColor'
  | 'settings.field.fontColorDesc'
  | 'settings.field.backgroundColor'
  | 'settings.field.backgroundColorDesc'
  | 'settings.field.linkBgColor'
  | 'settings.field.linkBgColorDesc'
  | 'settings.field.highlightColor'
  | 'settings.field.highlightColorDesc'
  | 'settings.field.highlightFontColor'
  | 'settings.field.highlightFontColorDesc'
  | 'settings.field.shadowColor'
  | 'settings.field.shadowColorDesc'
  | 'settings.field.shadowBlur'
  | 'settings.field.shadowBlurDesc'
  | 'settings.field.highlightRound'
  | 'settings.field.highlightRoundDesc'
  | 'settings.highlightRound.themedefault'
  // Settings panel — custom themes tab
  | 'settings.customThemes.heading'
  | 'settings.customThemes.importHeading'
  | 'settings.customThemes.urlLabel'
  | 'settings.customThemes.urlDesc'
  | 'settings.customThemes.cssLabel'
  | 'settings.customThemes.cssDesc'
  | 'settings.customThemes.apply'
  | 'settings.customThemes.installedHeading'
  | 'settings.customThemes.empty'
  | 'settings.customThemes.remove'
  | 'settings.customThemes.removeConfirm'
  | 'settings.customThemes.error.empty'
  | 'settings.customThemes.error.invalidJson'
  | 'settings.customThemes.error.fetch'
  | 'settings.customThemes.error.invalidUrl'
  | 'settings.customThemes.error.fetchFailed'
  | 'settings.customThemes.error.noValidVars'
  | 'settings.customThemes.error.install'
  | 'settings.customThemes.linkToAdvanced'
  | 'settings.customThemes.exportNote'
  | 'settings.customThemes.exportNoteUrlOnly'
  | 'settings.customThemes.successInstalled'
  | 'settings.customThemes.successUpdated'
  | 'settings.customThemes.browseHint'
  | 'settings.customThemes.browseLink'
  // Settings panel — features tab
  | 'settings.field.showTop'
  | 'settings.field.showTopDesc'
  | 'settings.field.numberTop'
  | 'settings.field.numberTopDesc'
  | 'settings.field.showRecent'
  | 'settings.field.showRecentDesc'
  | 'settings.field.numberRecent'
  | 'settings.field.numberRecentDesc'
  | 'settings.field.showClosed'
  | 'settings.field.showClosedDesc'
  | 'settings.field.numberClosed'
  | 'settings.field.numberClosedDesc'
  | 'settings.field.showDevices'
  | 'settings.field.showDevicesDesc'
  | 'settings.field.showApps'
  | 'settings.field.showAppsDesc'
  // v1.0.25: visibility toggles for the two built-in Chrome root
  //  folders (bookmark bar + other bookmarks). Hidden by the
  //  corresponding `show*` Settings field (see
  //  features/bookmarks/special-folders.ts → SHOW_KEY_MAP).
  | 'settings.field.showBar'
  | 'settings.field.showBarDesc'
  | 'settings.field.showOther'
  | 'settings.field.showOtherDesc'
  | 'settings.field.rememberOpen'
  | 'settings.field.rememberOpenDesc'
  | 'settings.field.autoClose'
  | 'settings.field.autoCloseDesc'
  | 'settings.field.folderActionConfirmThreshold'
  | 'settings.field.folderActionConfirmThresholdDesc'
  | 'settings.field.newtab'
  | 'settings.field.newtabDesc'
  | 'settings.newtab.current'
  | 'settings.newtab.foreground'
  | 'settings.newtab.background'
  // Settings panel — advanced tab
  | 'settings.field.debug'
  | 'settings.field.debugDesc'
  | 'settings.field.customCss'
  | 'settings.field.customCssDesc'
  | 'settings.advanced.exportSettings'
  | 'settings.advanced.exportSettingsDesc'
  | 'settings.advanced.includeLayout'
  | 'settings.advanced.includeLayoutDesc'
  | 'settings.advanced.importSettings'
  | 'settings.advanced.importSettingsDesc'
  | 'settings.advanced.importButton'
  | 'settings.advanced.importError'
  | 'settings.advanced.importSuccess'
  | 'settings.advanced.undo'
  | 'settings.advanced.undoHint'
  // v1.1.4: shown after a layout import if any of the imported
  //  column ids no longer point to a folder in the current
  //  Chrome environment (deleted or repurposed as a link). The
  //  import itself still succeeds — we just want the user to
  //  know the layout was trimmed. `{count}` is the number of
  //  dropped ids.
  | 'settings.advanced.importLayoutDropped'
  // Special folder titles
  | 'specialFolder.top'
  | 'specialFolder.apps'
  | 'specialFolder.recent'
  | 'specialFolder.closed'
  | 'specialFolder.devices'
  // Topbar
  | 'topbar.search.placeholder'
  | 'topbar.search.ariaLabel'
  | 'topbar.searchResults.ariaLabel'
  | 'topbar.settings.ariaLabel'
  // Appearance toggle (亮 / 跟随系统 / 暗)
  | 'appearanceToggle.light'
  | 'appearanceToggle.system'
  | 'appearanceToggle.dark'
  | 'appearanceToggle.groupAriaLabel'
  // Undo button
  | 'undo.label'
  | 'undo.title'
  | 'undo.titleWithCount'
  | 'undo.sessionHint'
  // Search results
  | 'searchResults.empty'
  | 'searchResults.footer.navigate'
  | 'searchResults.footer.open'
  | 'searchResults.footer.close'
  | 'searchResults.footer.websearch'
  // Folder actions
  | 'folderAction.openAll'
  | 'folderAction.openAsGroup'
  | 'folderAction.openInSplit'
  | 'folderAction.confirmOpenAll'
  | 'folderAction.confirmOpenAsGroup'
  | 'folderAction.currentFolder'
  // Folder-level
  | 'folder.empty'
  // v1.1.4: empty column placeholder. Shown when a column's
  //  only folder was deleted from Chrome bookmarks. The slot
  //  stays in the DOM so the user can right-click to remove
  //  the column or drag another folder in. The placeholder
  //  text uses `pointer-events: none` so it doesn't intercept
  //  right-click on the column itself.
  | 'column.empty'
  // Context menu
  | 'contextMenu.openAllInFolder'
  | 'contextMenu.openAsGroup'
  | 'contextMenu.openInSplit'
  | 'contextMenu.clearBrowsingData'
  | 'contextMenu.history'
  | 'contextMenu.editBookmarks'
  | 'contextMenu.createNewColumn'
  | 'contextMenu.removeFolder'
  | 'contextMenu.moveColumnLeft'
  | 'contextMenu.moveColumnRight'
  | 'contextMenu.removeColumn'
  // v1.0.31: surface why a drag was rejected (lockColumns blocks
  //  column creation). Wording names the cause + the escape hatch
  //  so the user doesn't have to guess.
  | 'toast.lockedColumnsCannotAddNew'
  // v1.0.28: empty-state shown when every column is hidden by
  //  show* toggles. `board.empty` is the prompt text, `board.emptyAction`
  //  is the button label that re-enables the bookmark bar.
  | 'board.empty'
  | 'board.emptyAction'
  // Split picker
  | 'splitPicker.title'
  | 'splitPicker.counter'
  | 'splitPicker.cancel'
  | 'splitPicker.openFirstN'
  | 'splitPicker.openSelected'
  // Popup
  | 'popup.tab.openTabs'
  | 'popup.tab.bookmarks'
  | 'popup.layout.title'
  | 'popup.openSplit'
  | 'popup.bookmarkPicker.empty'
  | 'popup.bookmarkPicker.error'
  | 'popup.openTabsPicker.empty'
  | 'popup.openTabsPicker.error'
  | 'popup.layout.2h'
  | 'popup.layout.2v'
  | 'popup.layout.3H'
  | 'popup.layout.4grid'
  // Background SW
  | 'actionMenu.openSettings'
  | 'tabGroup.newGroup'
  // Newtab
  | 'newtab.loading'
  | 'newtab.error.loadFailed'
  | 'newtab.split.invalidUrl'
  // About tab (v1.0.0) — credits, inspiration, theme source, repo link
  | 'about.versionPrefix'
  | 'about.authorByline'
  | 'about.builtWith'
  | 'about.inspiredBy'
  | 'about.feature.theming'
  | 'about.feature.splitView'
  | 'about.feature.tabGroups'
  | 'about.feature.bookmarkSearch'
  | 'about.themesIntro'
  | 'about.themesLink'
  | 'about.repoIntro'
  | 'about.repoLink'
  | 'about.moreExtensionsTitle'
  | 'about.extension.noLazyload';

export type LocaleMessages = Record<MessageKey, string>;

/** A complete locale bundle: messages + display metadata. */
export interface LocaleBundle {
  code: LocaleCode;
  /** Display name in the locale's own language (e.g. "中文" for
   *  zh, "Deutsch" for de). Shown as the primary label in the
   *  language dropdown. */
  selfName: string;
  /** Display name in English. Shown as a secondary label so
   *  multilingual users can identify the language. */
  englishName: string;
  messages: LocaleMessages;
}
