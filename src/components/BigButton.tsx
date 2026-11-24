import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { colors, cardShadow, hitSlop, radius } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'warning';

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const palette: Record<
  ButtonVariant,
  { background: string; border: string; text: string; icon: string }
> = {
  primary: {
    background: colors.primary,
    border: colors.primary,
    text: colors.white,
    icon: colors.white,
  },
  success: {
    background: colors.success,
    border: colors.success,
    text: colors.white,
    icon: colors.white,
  },
  danger: {
    background: colors.dangerSoft,
    border: colors.dangerSoft,
    text: colors.danger,
    icon: colors.danger,
  },
  warning: {
    background: colors.warningSoft,
    border: colors.warningSoft,
    text: colors.warning,
    icon: colors.warning,
  },
  secondary: {
    background: colors.white,
    border: colors.border,
    text: colors.text,
    icon: colors.primary,
  },
  ghost: {
    background: 'transparent',
    border: 'transparent',
    text: colors.primary,
    icon: colors.primary,
  },
};

export function BigButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  size = 'lg',
  style,
  accessibilityHint,
}: Props) {
  const tone = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' ? styles.large : styles.medium,
        {
          backgroundColor: tone.background,
          borderColor: tone.border,
        },
        variant !== 'ghost' && variant !== 'secondary' && styles.filled,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'lg' ? 24 : 21} color={tone.icon} />}
          <AppText
            variant={size === 'lg' ? 'body' : 'small'}
            weight="700"
            color={tone.text}
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  background?: string;
  size?: number;
};

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.primary,
  background = colors.primarySoft,
  size = 48,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}

export function LinkButton({
  title,
  onPress,
  icon,
  color = colors.primary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={hitSlop}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon && <Ionicons name={icon} size={20} color={color} />}
      <AppText variant="small" weight="700" color={color}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  large: { minHeight: 60 },
  medium: { minHeight: 52 },
  filled: cardShadow,
  title: { flexShrink: 1 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.45 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
  },
});
