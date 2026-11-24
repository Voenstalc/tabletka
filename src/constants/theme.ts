import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#F4F6FB',
  card: '#FFFFFF',
  cardMuted: '#EEF2FA',
  primary: '#2358D8',
  primaryDark: '#1A44AD',
  primarySoft: '#E3EBFD',
  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  border: '#DDE3EE',
  success: '#1F8A4C',
  successSoft: '#E2F5EA',
  warning: '#B26A00',
  warningSoft: '#FFF3D6',
  danger: '#C0392B',
  dangerSoft: '#FDE8E5',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(17, 24, 39, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  display: 40,
  title: 30,
  h1: 25,
  h2: 21,
  body: 18,
  small: 16,
  tiny: 14,
} as const;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
});

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export const commonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex1: { flex: 1 },
});
