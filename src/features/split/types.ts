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
  open(urls: string[], layout: SplitLayout, title?: string): Promise<SplitHandle>;
  close(handle: SplitHandle): Promise<void>;
}
