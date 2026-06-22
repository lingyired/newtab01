export type SplitMode = '2h' | '2v' | '3H' | '4grid';

export interface SplitLayout {
  mode: SplitMode;
}

export interface SplitHandle {
  id: string;
  kind: 'iframe-page' | 'native-window';
  urls: string[];
  layout: SplitLayout;
}

export interface SplitEngine {
  readonly id: 'iframe' | 'native';
  readonly displayName: string;
  /**
   * `active` mirrors `chrome.tabs.create({ active })`: when true the
   * new split-view tab is brought to the foreground (matching the
   * "new foreground tab" link setting), when false it opens in the
   * background. Defaults to `true` for backward compat with the
   * popup and any older call sites that predate the folder-action
   * newtab-aware behaviour.
   */
  open(urls: string[], layout: SplitLayout, title?: string, active?: boolean): Promise<SplitHandle>;
  close(handle: SplitHandle): Promise<void>;
}
