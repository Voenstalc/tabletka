import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/AppText';
import { Badge, SectionTitle } from '@/components/Badge';
import { BigButton, IconButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { Chip, Row } from '@/components/Chip';
import { DoseCard, DoseHistoryRow } from '@/components/DoseCard';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { ModalSheet } from '@/components/ModalSheet';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { colors, radius, spacing } from '@/constants/theme';
import { formatNumber, formatShortDate, formatTime } from '@/lib/date';
import { daysLeftLabel, expandMedication, scheduleSummary } from '@/lib/schedule';
import { buildDayItems, buildDoseItems } from '@/lib/stats';
import { daysOfStockLeft, formLabel, isLowStock, stockBarRatio } from '@/lib/stock';
import { useAppStore } from '@/store/appStore';

export default function MedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meds = useAppStore((state) => state.meds);
  const events = useAppStore((state) => state.events);
  const now = useAppStore((state) => state.now);
  const settings = useAppStore((state) => state.settings);
  const takeDose = useAppStore((state) => state.takeDose);
  const skipDose = useAppStore((state) => state.skipDose);
  const snoozeDose = useAppStore((state) => state.snoozeDose);
  const undoDose = useAppStore((state) => state.undoDose);
  const replenish = useAppStore((state) => state.replenish);
  const setStock = useAppStore((state) => state.setStock);
  const deleteMedication = useAppStore((state) => state.deleteMedication);

  const med = meds.find((item) => item.id === id);
  const [stockModal, setStockModal] = useState<'replenish' | 'set' | null>(null);
  const [amount, setAmount] = useState(10);

  const todayItems = useMemo(
    () => (med ? buildDayItems([med], events, new Date(now), now) : []),
    [events, med, now]
  );

  const recent = useMemo(() => {
    if (!med) return [];
    const from = startOfDay(addDays(new Date(now), -7));
    return buildDoseItems([med], events, from, new Date(now), now)
      .filter((item) => item.status !== 'planned')
      .slice(-10)
      .reverse();
  }, [events, med, now]);

  if (!med) {
    return (
      <Screen
        edges={['top', 'bottom', 'left', 'right']}
        header={<Header title="Лекарство" back />}
      >
        <EmptyState
          icon="alert-circle-outline"
          title="Лекарство не найдено"
          description="Возможно, оно было удалено."
          actionTitle="К списку лекарств"
          onAction={() => router.replace('/meds')}
        />
      </Screen>
    );
  }

  const left = daysOfStockLeft(med, now);
  const low = isLowStock(med, now);
  const nextDose = expandMedication(med, new Date(now), addDays(new Date(now), 14))[0];

  const openReplenish = () => {
    setAmount(10);
    setStockModal('replenish');
  };
  const openSetStock = () => {
    setAmount(Math.max(0, med.stock));
    setStockModal('set');
  };

  const confirmStock = async () => {
    try {
      if (stockModal === 'replenish') await replenish(med.id, amount);
      else await setStock(med.id, amount);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      setStockModal(null);
    } catch (error) {
      Alert.alert(
        'Не удалось изменить остаток',
        error instanceof Error ? error.message : 'Попробуйте ещё раз.'
      );
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Удалить лекарство?',
      `«${med.name}» и вся история его приёмов будут удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteMedication(med.id);
              router.replace('/meds');
            })();
          },
        },
      ]
    );
  };

  const handleTake = async (scheduledAt: string) => {
    await takeDose(med.id, scheduledAt);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );
  };
  const handleSkip = async (scheduledAt: string) => {
    await skipDose(med.id, scheduledAt);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined
    );
  };
  const handleSnooze = async (scheduledAt: string) => {
    await snoozeDose(med.id, scheduledAt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      header={
        <Header
          title={med.name}
          subtitle={[med.dosage, formLabel(med.form)].filter(Boolean).join(' · ')}
          back
          right={
            <IconButton
              icon="create-outline"
              label="Изменить лекарство"
              onPress={() =>
                router.push({ pathname: '/med/[id]/edit', params: { id: med.id } })
              }
            />
          }
        />
      }
    >
      <Card style={styles.stockCard}>
        <View style={styles.stockHeader}>
          <View style={[styles.avatar, { backgroundColor: med.color }]}>
            <AppText variant="h1" color={colors.white} weight="800">
              {med.name.trim().charAt(0).toUpperCase() || '?'}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="tiny" weight="700" color={colors.textMuted}>
              ОСТАТОК
            </AppText>
            <View style={styles.stockValue}>
              <AppText variant="display" weight="800">
                {formatNumber(med.stock)}
              </AppText>
              <AppText variant="h2" color={colors.textSecondary}>
                {med.unit}
              </AppText>
            </View>
          </View>
          {low && <Badge label={med.stock <= 0 ? 'Закончились' : 'Мало'} tone="warning" />}
        </View>
        <ProgressBar
          value={stockBarRatio(med, now)}
          color={low ? colors.warning : colors.success}
          height={13}
        />
        <AppText variant="small" color={low ? colors.warning : colors.textSecondary}>
          {daysLeftLabel(left)} при текущем расписании
        </AppText>
        <View style={styles.stockActions}>
          <BigButton
            title="Пополнить"
            icon="add-circle-outline"
            size="md"
            onPress={openReplenish}
            style={styles.flex}
          />
          <BigButton
            title="Изменить остаток"
            icon="create-outline"
            variant="secondary"
            size="md"
            onPress={openSetStock}
            style={styles.flex}
          />
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="small" weight="700">
              Расписание
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {scheduleSummary(med)}
            </AppText>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Ionicons name="alarm-outline" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="small" weight="700">
              Ближайший приём
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {nextDose
                ? `${formatShortDate(nextDose)}, ${formatTime(nextDose)}`
                : 'Больше не запланирован'}
            </AppText>
          </View>
        </View>
        {!!med.notes && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              <View style={styles.flex}>
                <AppText variant="small" weight="700">
                  Заметка
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  {med.notes}
                </AppText>
              </View>
            </View>
          </>
        )}
      </Card>

      {todayItems.length > 0 && (
        <>
          <SectionTitle title="Сегодня" />
          {todayItems.map((item) => (
            <DoseCard
              key={item.key}
              item={item}
              now={now}
              snoozeMinutes={settings.snoozeMinutes}
              onTake={() => void handleTake(item.scheduledAt.toISOString())}
              onSkip={() => void handleSkip(item.scheduledAt.toISOString())}
              onSnooze={
                item.scheduledAt.getTime() <= now
                  ? () => void handleSnooze(item.scheduledAt.toISOString())
                  : undefined
              }
              onUndo={() => void undoDose(med.id, item.scheduledAt.toISOString())}
            />
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle title="Последние 7 дней" />
          <Card style={styles.historyCard}>
            {recent.map((item) => (
              <DoseHistoryRow key={item.key} item={item} />
            ))}
          </Card>
        </>
      )}

      <BigButton
        title="Удалить лекарство"
        icon="trash-outline"
        variant="danger"
        onPress={onDelete}
        style={styles.deleteButton}
      />

      <ModalSheet
        visible={stockModal !== null}
        onClose={() => setStockModal(null)}
        title={stockModal === 'replenish' ? 'Пополнить запас' : 'Изменить остаток'}
        scroll={false}
      >
        <AppText variant="small" color={colors.textSecondary} style={styles.modalHint}>
          {stockModal === 'replenish'
            ? `Сколько ${med.unit} добавить к текущим ${formatNumber(med.stock)}?`
            : 'Укажите фактическое количество, которое осталось.'}
        </AppText>
        <Stepper
          label={stockModal === 'replenish' ? 'Добавить' : 'Осталось'}
          value={amount}
          onChange={setAmount}
          min={0}
          max={999}
          suffix={med.unit}
        />
        {stockModal === 'replenish' && (
          <Row>
            {[10, 20, 30, 60].map((value) => (
              <Chip
                key={value}
                label={`${value} ${med.unit}`}
                selected={amount === value}
                onPress={() => setAmount(value)}
              />
            ))}
          </Row>
        )}
        <BigButton
          title={stockModal === 'replenish' ? 'Добавить' : 'Сохранить'}
          icon="checkmark"
          onPress={() => void confirmStock()}
          disabled={stockModal === 'replenish' && amount <= 0}
          style={styles.modalAction}
        />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stockCard: { gap: spacing.md, paddingVertical: spacing.xl },
  stockHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockValue: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  stockActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  infoCard: { marginTop: spacing.md, paddingVertical: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 38 },
  historyCard: { paddingVertical: 0 },
  deleteButton: { marginTop: spacing.xxl },
  modalHint: { marginBottom: spacing.md },
  modalAction: { marginTop: spacing.xl },
});
