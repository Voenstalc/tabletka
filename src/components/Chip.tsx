import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  style?: ViewStyle;
  disabled?: boolean;
};

export function Chip({ label, selected, onPress, icon, style, disabled }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={18} color={selected ? colors.primaryDark : colors.textSecondary} />
      )}
      <AppText
        variant="small"
        weight={selected ? '700' : '500'}
        color={selected ? colors.primaryDark : colors.textSecondary}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

type Option<T extends string> = {
  value: T;
  title: string;
  description?: string;
  icon?: IconName;
};

type OptionGridProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: 1 | 2;
};

export function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: OptionGridProps<T>) {
  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              columns === 2 ? styles.optionHalf : styles.optionFull,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
          >
            {option.icon && (
              <Ionicons
                name={option.icon}
                size={24}
                color={selected ? colors.primary : colors.textSecondary}
              />
            )}
            <View style={styles.optionTexts}>
              <AppText variant="small" weight="700" color={selected ? colors.primaryDark : colors.text}>
                {option.title}
              </AppText>
              {!!option.description && (
                <AppText variant="tiny" color={colors.textMuted}>
                  {option.description}
                </AppText>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              variant="small"
              weight="700"
              color={selected ? colors.white : colors.textSecondary}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: 8,
    minHeight: 88,
    justifyContent: 'center',
  },
  optionHalf: { flexBasis: '47%', flexGrow: 1 },
  optionFull: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTexts: { gap: 2 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.cardMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
  segmentSelected: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
