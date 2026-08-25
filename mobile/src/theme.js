import { Platform } from 'react-native';

const and = Platform.OS === 'android';

export const lightColors = {
  primary:     '#6366f1',
  primaryDark: '#4f46e5',
  primaryDeep: '#3528a8',
  primarySoft: '#e8e6ff',

  bg:          '#f5f7fb',
  surface:     '#ffffff',
  surfaceSoft: '#f5f3ff',
  cardBg:      'rgba(255,255,255,0.92)',

  text:        '#101828',
  text2:       '#475467',
  textMuted:   '#667085',

  border:      '#e4e7ec',

  success:     '#00c853',
  successText: '#16a34a',
  successBg:   '#dcfce7',

  danger:      '#ff3040',
  dangerText:  '#dc2626',
  dangerBg:    '#fee2e2',

  warning:     '#ff7a00',
  warningText: '#d97706',
  warningBg:   '#fff8ec',

  blue:        '#3b82f6',
  blueBg:      '#dbeafe',

  inputBg:     '#f5f7fb',
  disabledBg:  '#f2f4f7',
  chipBg:      '#ede9fe',
  metricBg:    '#f8faff',
};

export const darkColors = {
  primary:     '#818cf8',
  primaryDark: '#6366f1',
  primaryDeep: '#4f46e5',
  primarySoft: '#2d2a4a',

  bg:          '#0f1117',
  surface:     '#1c1e2a',
  surfaceSoft: '#1a1730',
  cardBg:      'rgba(30,32,46,0.95)',

  text:        '#f1f5f9',
  text2:       '#94a3b8',
  textMuted:   '#64748b',

  border:      '#2d3148',

  success:     '#22c55e',
  successText: '#4ade80',
  successBg:   '#14532d',

  danger:      '#f87171',
  dangerText:  '#ef4444',
  dangerBg:    '#450a0a',

  warning:     '#fbbf24',
  warningText: '#f59e0b',
  warningBg:   '#422006',

  blue:        '#60a5fa',
  blueBg:      '#1e3a5f',

  inputBg:     '#1c1e2a',
  disabledBg:  '#252838',
  chipBg:      '#2d2a4a',
  metricBg:    '#1e2035',
};

// Static fallback for files that haven't been updated yet
export const colors = lightColors;

export const spacing = {
  xs:  and ?  3 :  4,
  sm:  and ?  7 :  8,
  md:  and ? 14 : 16,
  lg:  and ? 20 : 24,
  xl:  and ? 27 : 32,
  xxl: and ? 40 : 48,
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
};

export const font = {
  xs:   and ? 10 : 11,
  sm:   and ? 12 : 13,
  base: and ? 14 : 15,
  md:   and ? 15 : 16,
  lg:   and ? 16 : 18,
  xl:   and ? 20 : 22,
  xxl:  and ? 24 : 28,
};
