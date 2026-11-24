import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BigButton, IconButton } from '@/components/BigButton';
import { TimePickerModal } from '@/components/TimePickerModal';
import { colors, radius, spacing } from '@/constants/theme';
import { normalizeTime, sortTimes } from '@/lib/schedule';

type Props = {
  times: string[];
  onChange: (times: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
};

function addHours(time: string, hours: number): string {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  const total = (h * 60 + m + hours * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function TimeListField({ times, onChange, max = 8, label, hint }: Props) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  const openNew = () => {
    if (times.length >= max) return;
    setEditing('new');
  };

  const initialTime =
    editing === 'new' || editing === null
      ? times.length > 0
        ? addHours(times[times.length - 1], 2)
        : '08:00'
      : times[editing] ?? '08:00';

  const confirm = (time: string) => {
    const normalized = normalizeTime(time);
    const next = [...times];
    if (editing === 'new') next.push(normalized);
    else if (typeof editing === 'number') next[editing] = normalized;
    onChange(sortTimes(Array.from(new Set(next))));
    setEditing(null);
  };

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label ?? 'Время приёма'}</AppText>
      <AppText variant="tiny" color={colors.textMuted}>
        {hint ?? 'Можно добавить несколько приёмов в день'}
      </AppText>
      <View style={styles.list}>
        {times.map((time, index) => (
          <View key={`${time}-${index}`} style={styles.row}>
            <Pressable
              onPress={() => setEditing(index)}
              accessibilityRole="button"
              accessibilityLabel={`Изменить время ${time}`}
              style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}
            >
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <AppText variant="h2" weight="700">
                {time}
              </AppText>
            </Pressable>
            {times.length > 1 && (
              <IconButton
                icon="trash-outline"
                label={`Удалить время ${time}`}
                onPress={() => onChange(times.filter((_, i) => i !== index))}
                color={colors.danger}
                background={colors.dangerSoft}
                size={46}
              />
            )}
          </View>
        ))}
      </View>
      {times.length < max && (
        <BigButton
          title="Добавить время"
          icon="add"
          variant="secondary"
          size="md"
          onPress={openNew}
          style={styles.add}
        />
      )}
      <TimePickerModal
        visible={editing !== null}
        initialTime={initialTime}
        onClose={() => setEditing(null)}
        onConfirm={confirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg, gap: 4 },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeButton: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.7 },
  add: { marginTop: spacing.sm },
});
