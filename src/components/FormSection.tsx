import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { colors, spacing } from '@/constants/theme';

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="h2">{title}</AppText>
      {!!description && (
        <AppText variant="tiny" color={colors.textMuted} style={styles.description}>
          {description}
        </AppText>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  description: { marginTop: 2 },
  body: { marginTop: spacing.md },
});
