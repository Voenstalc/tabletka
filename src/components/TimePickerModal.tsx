import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { ModalSheet } from '@/components/ModalSheet';
import { colors, hitSlop, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  initialTime: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
};

function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return {
    hours: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8,
    minutes: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function TimeColumn({
  label,
  value,
  onChange,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
  step?: number;
}) {
  return (
    <View style={styles.column}>
      <AppText variant="tiny" color={colors.textMuted} weight="700">
        {label}
      </AppText>
      <Pressable
        onPress={() => onChange((value + step) % (max + 1))}
        accessibilityRole="button"
        accessibilityLabel={`Увеличить: ${label}`}
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-up" size={30} color={colors.primary} />
      </Pressable>
      <View style={styles.digits}>
        <AppText variant="display" weight="800">
          {String(value).padStart(2, '0')}
        </AppText>
      </View>
      <Pressable
        onPress={() => onChange((value - step + max + 1) % (max + 1))}
        accessibilityRole="button"
        accessibilityLabel={`Уменьшить: ${label}`}
        hitSlop={hitSlop}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-down" size={30} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function TimePickerContent({
  initialTime,
  onClose,
  onConfirm,
}: Omit<Props, 'visible'>) {
  const initial = parseTime(initialTime);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);

  return (
    <ModalSheet visible onClose={onClose} title="Время приёма" scroll={false}>
      <View style={styles.picker}>
        <TimeColumn label="Часы" value={hours} onChange={setHours} max={23} />
        <AppText variant="display" weight="800" color={colors.textMuted} style={styles.colon}>
          :
        </AppText>
        <TimeColumn label="Минуты" value={minutes} onChange={setMinutes} max={59} step={5} />
      </View>
      <AppText variant="small" color={colors.textSecondary} align="center" style={styles.hint}>
        Минуты меняются по 5, часы — по 1
      </AppText>
      <BigButton
        title="Готово"
        icon="checkmark"
        onPress={() => {
          onConfirm(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
          onClose();
        }}
        style={styles.action}
      />
    </ModalSheet>
  );
}

export function TimePickerModal({ visible, initialTime, onClose, onConfirm }: Props) {
  if (!visible) return null;
  return (
    <TimePickerContent
      initialTime={initialTime}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

const styles = StyleSheet.create({
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  column: { alignItems: 'center', gap: spacing.xs },
  arrow: {
    width: 64,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  digits: {
    width: 104,
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colon: { marginTop: spacing.lg },
  hint: { marginTop: spacing.sm },
  action: { marginTop: spacing.xl },
});
