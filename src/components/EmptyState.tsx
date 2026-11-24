import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { colors, spacing } from '@/constants/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  secondaryTitle?: string;
  onSecondary?: () => void;
};

export function EmptyState({
  icon,
  title,
  description,
  actionTitle,
  onAction,
  secondaryTitle,
  onSecondary,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={44} color={colors.primary} />
      </View>
      <AppText variant="h1" align="center" style={styles.title}>
        {title}
      </AppText>
      {!!description && (
        <AppText variant="body" color={colors.textSecondary} align="center" style={styles.text}>
          {description}
        </AppText>
      )}
      {!!actionTitle && !!onAction && (
        <BigButton title={actionTitle} onPress={onAction} icon="add" style={styles.action} />
      )}
      {!!secondaryTitle && !!onSecondary && (
        <BigButton
          title={secondaryTitle}
          onPress={onSecondary}
          variant="secondary"
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: spacing.xxxl },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { marginBottom: spacing.sm },
  text: { maxWidth: 420 },
  action: { alignSelf: 'stretch', marginTop: spacing.xl },
});
