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
 *  shown in the settings panel's "Language" dropdown. */
export const SUPPORTED_LOCALES = [
  'en',
  'zh',
  'es',
  'ar',
  'hi',
  'fr',
  'pt',
  'de',
  'ja',
  'ru',
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

/** Locales whose script is right-to-left. Sets `dir="rtl"` on
 *  <html> at runtime. The CSS file (globals.css) has matching
 *  rules to keep search-result URLs LTR and link text rendering
 *  correctly within an RTL document. */
export const RTL_LOCALES = new Set<LocaleCode>(['ar']);

/** The `Settings.language` field is a union: `'auto'` (follow
 *  the browser) OR an explicit LocaleCode. `'auto'` is the
 *  default; resolution happens in `resolveLocale`. */
export type LanguagePref = 'auto' | LocaleCode;

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
