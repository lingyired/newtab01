// Default settings for newtab01

export interface AppSettings {
  // Layout
  spacing: number;
  vMargin: number;
  columnWidth: string;
  align: 'left' | 'center' | 'right';
  lockColumns: boolean;
  showTopLevel: boolean;
  autoScale: boolean;

  // Appearance
  theme: string;
  font: string;
  textColor: string;
  backgroundColor: string;
  backgroundImage: string;
  highlightColor: string;
  highlightTextColor: string;
  shadowBlur: number;
  highlightRound: number;
  fadeMs: number;
  slideMs: number;

  // Features
  hideOptions: boolean;
  numberTop: number;
  numberRecent: number;
  showOtherDevices: boolean;
  showSearchBar: boolean;
  openInNewTab: 'same' | 'foreground' | 'background';

  // Advanced
  customCSS: string;
}

export const defaultSettings: AppSettings = {
  spacing: 10,
  vMargin: 5,
  columnWidth: 'auto',
  align: 'left',
  lockColumns: false,
  showTopLevel: false,
  autoScale: true,

  theme: 'default',
  font: '',
  textColor: '#1a1a1a',
  backgroundColor: '#ffffff',
  backgroundImage: '',
  highlightColor: '#e4f4ff',
  highlightTextColor: '#000',
  shadowBlur: 7,
  highlightRound: 0.2,
  fadeMs: 200,
  slideMs: 200,

  hideOptions: false,
  numberTop: 10,
  numberRecent: 10,
  showOtherDevices: true,
  showSearchBar: true,
  openInNewTab: 'same',

  customCSS: '',
};

export const themeList = ['default', 'slate', 'rose', 'dark'];
