export type ThemeName = 'light' | 'dark' | 'space' | 'summer';
export const THEME_ORDER: ThemeName[] = ['light', 'dark', 'space', 'summer'];

interface BadgeTone {
  bg: string;
  fg: string;
}

/** Single set of colour tokens used by every component. */
export interface Colors {
  bg: string; // screen background
  card: string; // cards / sheets
  card2: string; // nested surfaces
  input: string; // inputs, chips, inactive buttons
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string; // primary buttons, active tabs
  onAccent: string; // text/icons on accent
  accentSoft: string; // soft tinted buttons
  accentSoftText: string;
  accentDisabled: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  info: string;
  warn: string; // calories amber
  track: string; // progress bar track
  tabBar: string;
  tabBorder: string;
  progress: { kcal: string; protein: string; fat: string; carbs: string };
  badge: { neutral: BadgeTone; accent: BadgeTone; warm: BadgeTone; danger: BadgeTone };
  statusBar: 'light' | 'dark';
}

export interface Theme {
  name: ThemeName;
  colors: Colors;
}

const light: Colors = {
  bg: '#F4F6F5',
  card: '#FFFFFF',
  card2: '#F8FAF9',
  input: '#EDF1EF',
  border: '#E1E6E4',
  text: '#16201B',
  textSecondary: '#55625B',
  textMuted: '#8A968F',
  accent: '#2E7D32',
  onAccent: '#FFFFFF',
  accentSoft: '#E3F1E5',
  accentSoftText: '#1F5B2B',
  accentDisabled: '#A9C9AE',
  danger: '#D32F2F',
  dangerSoft: '#FBE9E7',
  dangerText: '#C62828',
  info: '#1565C0',
  warn: '#E69500',
  track: '#E3E8E5',
  tabBar: '#FFFFFF',
  tabBorder: '#E1E6E4',
  progress: { kcal: '#F5A000', protein: '#1E88E5', fat: '#E53935', carbs: '#43A047' },
  badge: {
    neutral: { bg: '#EAEEEC', fg: '#5F6B65' },
    accent: { bg: '#E0F0E3', fg: '#2F7A3E' },
    warm: { bg: '#FBF0DA', fg: '#B07A12' },
    danger: { bg: '#FBE6E3', fg: '#B84A44' },
  },
  statusBar: 'dark',
};

const dark: Colors = {
  bg: '#121212',
  card: '#1E1E1E',
  card2: '#181818',
  input: '#2A2A2A',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#888888',
  accent: '#2E7D32',
  onAccent: '#FFFFFF',
  accentSoft: '#24462A',
  accentSoftText: '#FFFFFF',
  accentDisabled: '#3D5A3E',
  danger: '#FF5252',
  dangerSoft: '#412626',
  dangerText: '#FF8A80',
  info: '#1565C0',
  warn: '#FFB300',
  track: 'rgba(255,255,255,0.25)',
  tabBar: '#181818',
  tabBorder: '#262626',
  progress: { kcal: '#FFB300', protein: '#42A5F5', fat: '#EF5350', carbs: '#66BB6A' },
  badge: {
    neutral: { bg: '#2A2D30', fg: '#AEB6BD' },
    accent: { bg: '#213A2A', fg: '#8FCF9F' },
    warm: { bg: '#3A3224', fg: '#D6B878' },
    danger: { bg: '#3A2626', fg: '#D9A0A0' },
  },
  statusBar: 'light',
};

const space: Colors = {
  bg: '#0B1021',
  card: '#141B34',
  card2: '#10162B',
  input: '#1C2545',
  border: '#263056',
  text: '#EEF1FF',
  textSecondary: '#A8B1D9',
  textMuted: '#7A84B0',
  accent: '#7C4DFF',
  onAccent: '#FFFFFF',
  accentSoft: '#2A2260',
  accentSoftText: '#DCD2FF',
  accentDisabled: '#3C3473',
  danger: '#FF5C8A',
  dangerSoft: '#3A1E3A',
  dangerText: '#FF8FB1',
  info: '#00B8D4',
  warn: '#22D3EE',
  track: 'rgba(168,177,217,0.2)',
  tabBar: '#0E1430',
  tabBorder: '#1E2748',
  progress: { kcal: '#22D3EE', protein: '#8F6BFF', fat: '#FF5C8A', carbs: '#4ADE80' },
  badge: {
    neutral: { bg: '#1C2545', fg: '#A8B1D9' },
    accent: { bg: '#2A2260', fg: '#B9A4FF' },
    warm: { bg: '#103642', fg: '#5FDCEE' },
    danger: { bg: '#3A1E3A', fg: '#FF8FB1' },
  },
  statusBar: 'light',
};

const summer: Colors = {
  bg: '#FDF8F2',
  card: '#FFFFFF',
  card2: '#FFFAF3',
  input: '#F6EEE3',
  border: '#EADFCF',
  text: '#3B2F26',
  textSecondary: '#7A6A5C',
  textMuted: '#A8998A',
  accent: '#FF7A59',
  onAccent: '#FFFFFF',
  accentSoft: '#FFE6DC',
  accentSoftText: '#B8452A',
  accentDisabled: '#F4B8A8',
  danger: '#E5484D',
  dangerSoft: '#FDE3E1',
  dangerText: '#C23B3F',
  info: '#2FB8A0',
  warn: '#FFB020',
  track: '#F1E6D8',
  tabBar: '#FFFFFF',
  tabBorder: '#EADFCF',
  progress: { kcal: '#FFB020', protein: '#2FB8A0', fat: '#FF7A59', carbs: '#8BC34A' },
  badge: {
    neutral: { bg: '#F3EADF', fg: '#85766A' },
    accent: { bg: '#FFE9E0', fg: '#D9603F' },
    warm: { bg: '#FFF1D6', fg: '#C98A12' },
    danger: { bg: '#FDE5E3', fg: '#C95A5E' },
  },
  statusBar: 'dark',
};

export const THEMES: Record<ThemeName, Theme> = {
  light: { name: 'light', colors: light },
  dark: { name: 'dark', colors: dark },
  space: { name: 'space', colors: space },
  summer: { name: 'summer', colors: summer },
};

export const DEFAULT_THEME: ThemeName = 'light';

export const isThemeName = (v: unknown): v is ThemeName => typeof v === 'string' && v in THEMES;
