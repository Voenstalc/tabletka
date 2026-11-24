import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Badge, SectionTitle } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Chip';
import { colors, radius, spacing } from '@/constants/theme';
import { formatShortDate, formatWeekdayShort, isSameDay } from '@/lib/date';
import { buildPeriodStats, periodRange } from '@/lib/stats';
import { useAppStore } from '@/store/appStore';

function overallTone(value: number | null) {
  if (value === null) return 'muted' as const;
  if (value >= 80) return 'success' as const;
  if (value >= 50) return 'warning' as const;
  return 'danger' as const;
}

export default function HistoryScreen() {
  const meds = useAppStore((state) => state.meds);
  const events = useAppStore((state) => state.events);
  const now = useAppStore((state) => state.now);
  const [days, setDays] = useState<7 | 30>(7);

  const stats = useMemo(() => {
    const range = periodRange(days, now);
    return buildPeriodStats(meds, events, range.from, range.to, now);
  }, [days, events, meds, now]);

  const orderedDays = useMemo(() => [...stats.days].reverse(), [stats.days]);
  const today = new Date(now);

  if (meds.length === 0) {
    return (
      <Screen header={<Header title="История" />}>
        <EmptyState
          icon="stats-chart-outline"
          title="Статистика появится позже"
          description="Добавьте лекарства и отмечайте приёмы — здесь будет видно, насколько точно соблюдается расписание."
        />
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="История" subtitle="Приёмы и соблюдение расписания" />}>
      <Segmented
        options={[
          { value: 7 as const, label: '7 дней' },
          { value: 30 as const, label: '30 дней' },
        ]}
        value={days}
        onChange={(value) => setDays(value)}
      />

      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryTexts}>
            <AppText variant="tiny" weight="700" color={colors.textMuted}>
              СОБЛЮДЕНИЕ РАСПИСАНИЯ
            </AppText>
            <AppText variant="display" weight="800">
              {stats.adherence === null ? '—' : `${stats.adherence}%`}
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {stats.due === 0
                ? stats.planned > 0
                  ? 'Приёмы ещё впереди'
                  : 'Пока нет завершённых приёмов'
                : `Учтено ${stats.due} приёмов за ${days} дней`}
            </AppText>
          </View>
          <Badge
            label={
              stats.adherence === null
                ? 'нет данных'
                : stats.adherence >= 80
                  ? 'хорошо'
                  : stats.adherence >= 50
                    ? 'есть пропуски'
                    : 'много пропусков'
            }
            tone={overallTone(stats.adherence)}
          />
        </View>
        <ProgressBar
          value={(stats.adherence ?? 0) / 100}
          color={
            stats.adherence === null
              ? colors.textMuted
              : stats.adherence >= 80
                ? colors.success
                : stats.adherence >= 50
                  ? colors.warning
                  : colors.danger
          }
          height={14}
        />
        <View style={styles.counts}>
          <View style={styles.count}>
            <AppText variant="h1" color={colors.success}>
              {stats.taken}
            </AppText>
            <AppText variant="tiny" color={colors.textMuted}>
              принято
            </AppText>
          </View>
          <View style={styles.count}>
            <AppText variant="h1" color={colors.warning}>
              {stats.skipped}
            </AppText>
            <AppText variant="tiny" color={colors.textMuted}>
              пропущено вручную
            </AppText>
          </View>
          <View style={styles.count}>
            <AppText variant="h1" color={colors.danger}>
              {stats.missed}
            </AppText>
            <AppText variant="tiny" color={colors.textMuted}>
              не отмечено
            </AppText>
          </View>
        </View>
      </Card>

      {stats.byMed.length > 1 && (
        <>
          <SectionTitle title="По лекарствам" />
          <Card style={styles.medList}>
            {stats.byMed.map((med) => (
              <View key={med.medicationId} style={styles.medRow}>
                <View style={[styles.dot, { backgroundColor: med.color }]} />
                <View style={styles.medTexts}>
                  <View style={styles.medTop}>
                    <AppText variant="small" weight="700" numberOfLines={1} style={styles.flex}>
                      {med.name}
                    </AppText>
                    <AppText variant="small" weight="700" color={colors.textSecondary}>
                      {med.adherence === null ? '—' : `${med.adherence}%`}
                    </AppText>
                  </View>
                  <ProgressBar
                    value={(med.adherence ?? 0) / 100}
                    color={
                      med.adherence === null
                        ? colors.textMuted
                        : med.adherence >= 80
                          ? colors.success
                          : med.adherence >= 50
                            ? colors.warning
                            : colors.danger
                    }
                    height={9}
                  />
                  <AppText variant="tiny" color={colors.textMuted}>
                    {med.taken} из {med.due} приёмов
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title="По дням" />
      <View style={styles.days}>
        {orderedDays.map((day) => {
          const isToday = isSameDay(day.date, today);
          const tone = overallTone(day.adherence);
          return (
            <Card key={day.dateKey} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.flex}>
                  <AppText variant="small" weight="700">
                    {isToday ? 'Сегодня' : `${formatWeekdayShort(day.date)}, ${formatShortDate(day.date)}`}
                  </AppText>
                  <AppText variant="tiny" color={colors.textMuted}>
                    {day.due === 0
                      ? day.planned > 0
                        ? 'приёмы ещё впереди'
                        : 'нет приёмов'
                      : `${day.taken} принято · ${day.skipped} пропущено · ${day.missed} не отмечено`}
                  </AppText>
                </View>
                <Badge
                  label={day.adherence === null ? '—' : `${day.adherence}%`}
                  tone={tone}
                  small
                />
              </View>
              {day.due > 0 && (
                <ProgressBar
                  value={(day.adherence ?? 0) / 100}
                  color={
                    tone === 'success'
                      ? colors.success
                      : tone === 'warning'
                        ? colors.warning
                        : colors.danger
                  }
                  height={8}
                />
              )}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: spacing.lg, gap: spacing.lg, paddingVertical: spacing.xl },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  summaryTexts: { flex: 1, gap: 2 },
  counts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  count: { flex: 1, alignItems: 'center', gap: 2 },
  medList: { gap: spacing.lg },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  medTexts: { flex: 1, gap: 5 },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  days: { gap: spacing.sm },
  dayCard: { paddingVertical: spacing.md, gap: spacing.sm, borderRadius: radius.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
