import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DoseItem } from '@/types';
import { AppText } from '@/components/AppText';
import { Badge, type Tone } from '@/components/Badge';
import { BigButton, LinkButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { colors, spacing } from '@/constants/theme';
import { formatNumber, formatTime } from '@/lib/date';
import { statusLabel } from '@/lib/stats';

type Props = {
  item: DoseItem;
  now: number;
  snoozeMinutes?: number;
  onTake: () => void;
  onSkip: () => void;
  onSnooze?: () => void;
  onUndo?: () => void;
};

function toneFor(item: DoseItem): Tone {
  if (item.status === 'taken') return 'success';
  if (item.status === 'skipped') return 'warning';
  if (item.status === 'missed') return 'danger';
  return 'primary';
}

export function DoseCard({
  item,
  now,
  snoozeMinutes = 15,
  onTake,
  onSkip,
  onSnooze,
  onUndo,
}: Props) {
  const due = item.status === 'planned' || item.status === 'missed';
  return (
    <Card style={styles.card}>
      <View style={[styles.accent, { backgroundColor: item.status === 'missed' ? colors.danger : item.color }]} />
      <View style={styles.header}>
        <View style={styles.timeBlock}>
          <AppText variant="h1" weight="800">
            {formatTime(item.scheduledAt)}
          </AppText>
        </View>
        <View style={styles.titleBlock}>
          <AppText variant="h2" numberOfLines={2}>
            {item.medicationName}
          </AppText>
          <AppText variant="small" color={colors.textSecondary}>
            {formatNumber(item.dose)} {item.unit}
            {item.dosage ? ` · ${item.dosage}` : ''}
          </AppText>
        </View>
        <Badge
          label={
            item.status === 'planned'
              ? item.scheduledAt.getTime() <= now
                ? 'Пора принять'
                : 'Запланировано'
              : statusLabel(item.status)
          }
          tone={toneFor(item)}
        />
      </View>

      {item.status === 'taken' && item.event && (
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <AppText variant="small" color={colors.success} weight="700">
            Принято в {formatTime(new Date(item.event.takenAt))}
          </AppText>
        </View>
      )}

      {due ? (
        <View style={styles.actions}>
          <BigButton title="Принял" icon="checkmark" variant="success" size="md" onPress={onTake} />
          <View style={styles.row}>
            <BigButton
              title="Пропустил"
              icon="close"
              variant="secondary"
              size="md"
              onPress={onSkip}
              style={styles.flex}
            />
            {onSnooze && (
              <BigButton
                title="Отложить"
                icon="alarm-outline"
                variant="secondary"
                size="md"
                onPress={onSnooze}
                accessibilityHint={`Напомнить снова через ${snoozeMinutes} минут`}
                style={styles.flex}
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.row}>
            {onUndo && (
              <LinkButton title="Отменить отметку" icon="arrow-undo-outline" onPress={onUndo} />
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

export function DoseHistoryRow({ item }: { item: DoseItem }) {
  const tone = toneFor(item);
  return (
    <View style={styles.historyRow}>
      <AppText variant="small" weight="700" style={styles.historyTime}>
        {formatTime(item.scheduledAt)}
      </AppText>
      <View style={styles.historyText}>
        <AppText variant="small" weight="600" numberOfLines={1}>
          {item.medicationName}
        </AppText>
        <AppText variant="tiny" color={colors.textMuted}>
          {formatNumber(item.dose)} {item.unit}
        </AppText>
      </View>
      <Badge label={statusLabel(item.status)} tone={tone} small />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, paddingLeft: spacing.lg + 5, overflow: 'hidden' },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  timeBlock: { minWidth: 72 },
  titleBlock: { flex: 1, gap: 2 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTime: { width: 52 },
  historyText: { flex: 1, gap: 1 },
});
