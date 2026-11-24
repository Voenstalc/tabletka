import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/constants/theme';

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const tones: Record<Tone, { background: string; text: string; border: string }> = {
  primary: { background: colors.primarySoft, text: colors.primaryDark, border: '#C9D8FB' },
  success: { background: colors.successSoft, text: colors.success, border: '#C4ECD3' },
  warning: { background: colors.warningSoft, text: colors.warning, border: '#F3DFAF' },
  danger: { background: colors.dangerSoft, text: colors.danger, border: '#F7CFC9' },
  muted: { background: colors.cardMuted, text: colors.textSecondary, border: colors.border },
};

type Props = {
  label: string;
  tone?: Tone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  small?: boolean;
};

export function Badge({ label, tone = 'muted', icon, small = false }: Props) {
  const palette = tones[tone];
  return (
    <View
      style={[
        styles.badge,
        small && styles.small,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 14 : 16} color={palette.text} />}
      <AppText variant="tiny" weight="700" color={palette.text}>
        {label}
      </AppText>
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h2" style={styles.sectionText}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  small: { paddingHorizontal: 9, paddingVertical: 3 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionText: { flexShrink: 1 },
});
