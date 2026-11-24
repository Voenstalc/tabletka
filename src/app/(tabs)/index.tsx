import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { addDays } from 'date-fns';
import { AppText } from '@/components/AppText';
import { Badge, SectionTitle } from '@/components/Badge';
import { BigButton, LinkButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { DoseCard } from '@/components/DoseCard';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { ProfileChip } from '@/components/ProfileChip';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { formatLongDate, formatTime, greeting } from '@/lib/date';
import { expandAll } from '@/lib/schedule';
import { buildDayItems, groupDoses } from '@/lib/stats';
import { isLowStock } from '@/lib/stock';
import { useAppStore } from '@/store/appStore';

export default function TodayScreen() {
  const meds = useAppStore((state) => state.meds);
  const events = useAppStore((state) => state.events);
  const now = useAppStore((state) => state.now);
  const settings = useAppStore((state) => state.settings);
  const profiles = useAppStore((state) => state.profiles);
  const activeProfile = useAppStore((state) => state.activeProfile);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const takeDose = useAppStore((state) => state.takeDose);
  const skipDose = useAppStore((state) => state.skipDose);
  const snoozeDose = useAppStore((state) => state.snoozeDose);
  const undoDose = useAppStore((state) => state.undoDose);
  const seedDemo = useAppStore((state) => state.seedDemo);

  const [showAllDone, setShowAllDone] = useState(false);

  const today = useMemo(() => new Date(now), [now]);
  const items = useMemo(() => buildDayItems(meds, events, today, now), [meds, events, today, now]);
  const groups = useMemo(() => groupDoses(items, now), [items, now]);
  const lowMeds = useMemo(() => meds.filter((med) => isLowStock(med, now)), [meds, now]);
  const nextDose = useMemo(() => {
    const dates = expandAll(meds, new Date(now), addDays(new Date(now), 7));
    return dates[0] ?? null;
  }, [meds, now]);

  const total = items.length;
  const taken = items.filter((item) => item.status === 'taken').length;
  const skipped = items.filter((item) => item.status === 'skipped').length;
  const handled = taken + skipped;
  const progress = total > 0 ? taken / total : 0;
  const done = groups.done;
  const visibleDone = showAllDone ? done : done.slice(0, 3);

  const handleTake = async (medicationId: string, scheduledAt: string) => {
    await takeDose(medicationId, scheduledAt);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  const handleSkip = async (medicationId: string, scheduledAt: string) => {
    await skipDose(medicationId, scheduledAt);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  };
  const handleSnooze = async (medicationId: string, scheduledAt: string) => {
    await snoozeDose(medicationId, scheduledAt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };
  const handleUndo = async (medicationId: string, scheduledAt: string) => {
    await undoDose(medicationId, scheduledAt);
    await Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <Screen
      header={
        <Header
          title={greeting(today)}
          subtitle={formatLongDate(today)}
          right={
            <ProfileChip
              profile={activeProfile}
              count={profiles.length}
              onPress={() => router.push('/profiles')}
            />
          }
        />
      }
    >
      {meds.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Начнём с первого лекарства"
          description="Добавьте препарат, укажите время приёма и остаток. Приложение напомнит и посчитает, на сколько дней хватит запаса."
          actionTitle="Добавить лекарство"
          onAction={() => router.push('/med/new')}
          secondaryTitle={__DEV__ ? 'Заполнить примером' : undefined}
          onSecondary={__DEV__ ? () => void seedDemo() : undefined}
        />
      ) : (
        <>
          {lowMeds.length > 0 && (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/med/[id]', params: { id: lowMeds[0].id } })
              }
              accessibilityRole="button"
              accessibilityLabel="Открыть лекарство с низким остатком"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card style={styles.warningCard}>
                <Ionicons name="warning" size={28} color={colors.warning} />
                <View style={styles.warningTexts}>
                  <AppText variant="small" weight="700" color={colors.warning}>
                    Пора пополнить запас
                  </AppText>
                  <AppText variant="tiny" color={colors.textSecondary} numberOfLines={2}>
                    {lowMeds.map((med) => med.name).join(', ')}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.warning} />
              </Card>
            </Pressable>
          )}

          {(!notificationPermission || !settings.notificationsEnabled) && (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card style={styles.permissionCard}>
                <Ionicons name="notifications-off-outline" size={26} color={colors.danger} />
                <View style={styles.warningTexts}>
                  <AppText variant="small" weight="700" color={colors.danger}>
                    {notificationPermission ? 'Напоминания выключены' : 'Уведомления выключены'}
                  </AppText>
                  <AppText variant="tiny" color={colors.textSecondary}>
                    Без них приложение не сможет напомнить о приёме.
                  </AppText>
                </View>
                <Badge label="Включить" tone="danger" small />
              </Card>
            </Pressable>
          )}

          {total > 0 ? (
            <Card style={styles.progressCard}>
              <View style={styles.progressText}>
                <AppText variant="tiny" weight="700" color={colors.textMuted}>
                  СЕГОДНЯ
                </AppText>
                <AppText variant="h1">
                  {taken} из {total} принято
                </AppText>
                <ProgressBar value={progress} color={progress >= 1 ? colors.success : colors.primary} />
                <AppText variant="small" color={colors.textSecondary}>
                  {skipped > 0 ? `${skipped} пропущено · ` : ''}
                  {total - handled > 0 ? `осталось ${total - handled}` : 'все приёмы отмечены'}
                </AppText>
              </View>
              <View style={[styles.percentCircle, progress >= 1 && styles.percentCircleDone]}>
                <AppText variant="h2" color={progress >= 1 ? colors.success : colors.primary}>
                  {Math.round(progress * 100)}%
                </AppText>
              </View>
            </Card>
          ) : (
            <Card style={styles.noDoses}>
              <Ionicons name="calendar-outline" size={28} color={colors.primary} />
              <View style={styles.warningTexts}>
                <AppText variant="small" weight="700">
                  Сегодня приёмов нет
                </AppText>
                <AppText variant="tiny" color={colors.textSecondary}>
                  {nextDose
                    ? `Ближайший приём: ${formatLongDate(nextDose).toLowerCase()} в ${formatTime(nextDose)}`
                    : 'В расписании пока не назначены приёмы.'}
                </AppText>
              </View>
            </Card>
          )}

          {groups.due.length > 0 && (
            <>
              <SectionTitle title="Пора принять" right={<Badge label={`${groups.due.length}`} tone="primary" />} />
              {groups.due.map((item) => (
                <DoseCard
                  key={item.key}
                  item={item}
                  now={now}
                  snoozeMinutes={settings.snoozeMinutes}
                  onTake={() => void handleTake(item.medicationId, item.scheduledAt.toISOString())}
                  onSkip={() => void handleSkip(item.medicationId, item.scheduledAt.toISOString())}
                  onSnooze={() => void handleSnooze(item.medicationId, item.scheduledAt.toISOString())}
                />
              ))}
            </>
          )}

          {groups.missed.length > 0 && (
            <>
              <SectionTitle
                title="Просрочено"
                right={<Badge label={`${groups.missed.length}`} tone="danger" />}
              />
              {groups.missed.map((item) => (
                <DoseCard
                  key={item.key}
                  item={item}
                  now={now}
                  snoozeMinutes={settings.snoozeMinutes}
                  onTake={() => void handleTake(item.medicationId, item.scheduledAt.toISOString())}
                  onSkip={() => void handleSkip(item.medicationId, item.scheduledAt.toISOString())}
                  onSnooze={() => void handleSnooze(item.medicationId, item.scheduledAt.toISOString())}
                />
              ))}
            </>
          )}

          {groups.upcoming.length > 0 && (
            <>
              <SectionTitle title="Далее сегодня" />
              {groups.upcoming.map((item) => (
                <DoseCard
                  key={item.key}
                  item={item}
                  now={now}
                  snoozeMinutes={settings.snoozeMinutes}
                  onTake={() => void handleTake(item.medicationId, item.scheduledAt.toISOString())}
                  onSkip={() => void handleSkip(item.medicationId, item.scheduledAt.toISOString())}
                />
              ))}
            </>
          )}

          {done.length > 0 && (
            <>
              <SectionTitle title="Отмечено" right={<Badge label={`${done.length}`} tone="success" />} />
              {visibleDone.map((item) => (
                <DoseCard
                  key={item.key}
                  item={item}
                  now={now}
                  onTake={() => void handleTake(item.medicationId, item.scheduledAt.toISOString())}
                  onSkip={() => void handleSkip(item.medicationId, item.scheduledAt.toISOString())}
                  onUndo={() => void handleUndo(item.medicationId, item.scheduledAt.toISOString())}
                />
              ))}
              {done.length > 3 && (
                <LinkButton
                  title={showAllDone ? 'Свернуть' : `Показать все (${done.length})`}
                  icon={showAllDone ? 'chevron-up' : 'chevron-down'}
                  onPress={() => setShowAllDone((value) => !value)}
                />
              )}
            </>
          )}

          <BigButton
            title="Добавить лекарство"
            icon="add"
            variant="secondary"
            onPress={() => router.push('/med/new')}
            style={styles.addButton}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderColor: '#F0D9A8',
    marginBottom: spacing.md,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderColor: '#F3CFC9',
    marginBottom: spacing.md,
  },
  warningTexts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  progressText: { flex: 1, gap: spacing.sm },
  percentCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentCircleDone: { backgroundColor: colors.successSoft },
  noDoses: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  addButton: { marginTop: spacing.xxl },
});
