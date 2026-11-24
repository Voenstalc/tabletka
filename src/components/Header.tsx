import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { colors, hitSlop, spacing } from '@/constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  onBack?: () => void;
};

export function Header({ title, subtitle, back = false, right, onBack }: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {back && (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            hitSlop={hitSlop}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </Pressable>
        )}
        <View style={styles.texts}>
          <AppText variant="title" numberOfLines={2}>
            {title}
          </AppText>
          {!!subtitle && (
            <AppText variant="small" color={colors.textSecondary} style={styles.subtitle}>
              {subtitle}
            </AppText>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: spacing.sm,
    marginLeft: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  subtitle: { marginTop: 2 },
  pressed: { opacity: 0.55 },
});
