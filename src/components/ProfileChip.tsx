import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Profile } from '@/types';
import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  profile: Profile | null;
  count: number;
  onPress: () => void;
};

export function ProfileChip({ profile, count, onPress }: Props) {
  if (!profile) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Профиль ${profile.name}. Открыть профили`}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: profile.color }]}>
        <AppText variant="tiny" color={colors.white} weight="800">
          {profile.name.charAt(0).toUpperCase()}
        </AppText>
      </View>
      <AppText variant="tiny" weight="700" numberOfLines={1} style={styles.name}>
        {profile.name}
      </AppText>
      {count > 1 && <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 160,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flexShrink: 1, marginLeft: spacing.xs },
  pressed: { opacity: 0.7 },
});
