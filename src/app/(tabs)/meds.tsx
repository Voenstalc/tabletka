import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { addDays } from 'date-fns';
import { AppText } from '@/components/AppText';
import { BigButton, IconButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { MedicationCard } from '@/components/MedicationCard';
import { ProfileChip } from '@/components/ProfileChip';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { formatShortDate, formatTime, isSameDay } from '@/lib/date';
import { expandMedication } from '@/lib/schedule';
import { useAppStore } from '@/store/appStore';

export default function MedsScreen() {
  const meds = useAppStore((state) => state.meds);
  const now = useAppStore((state) => state.now);
  const profiles = useAppStore((state) => state.profiles);
  const activeProfile = useAppStore((state) => state.activeProfile);
  const seedDemo = useAppStore((state) => state.seedDemo);

  const nextDoses = useMemo(() => {
    const map = new Map<string, string>();
    for (const med of meds) {
      const next = expandMedication(med, new Date(now), addDays(new Date(now), 14))[0];
      if (!next) continue;
      const label = isSameDay(next, new Date(now))
        ? `сегодня в ${formatTime(next)}`
        : `${formatShortDate(next)}, ${formatTime(next)}`;
      map.set(med.id, label);
    }
    return map;
  }, [meds, now]);

  return (
    <Screen
      header={
        <Header
          title="Лекарства"
          subtitle={`${meds.length} в списке`}
          right={
            <View style={styles.headerActions}>
              <ProfileChip
                profile={activeProfile}
                count={profiles.length}
                onPress={() => router.push('/profiles')}
              />
              <IconButton
                icon="add"
                label="Добавить лекарство"
                onPress={() => router.push('/med/new')}
              />
            </View>
          }
        />
      }
    >
      {meds.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Список пока пуст"
          description="Добавьте лекарство, чтобы настроить напоминания и следить за остатком."
          actionTitle="Добавить лекарство"
          onAction={() => router.push('/med/new')}
          secondaryTitle={__DEV__ ? 'Заполнить примером' : undefined}
          onSecondary={__DEV__ ? () => void seedDemo() : undefined}
        />
      ) : (
        <>
          <Card style={styles.tip}>
            <AppText variant="small" color={colors.textSecondary}>
              Нажмите на лекарство, чтобы изменить расписание, пополнить запас или посмотреть историю.
            </AppText>
          </Card>
          <View style={styles.list}>
            {meds.map((med) => (
              <MedicationCard
                key={med.id}
                med={med}
                now={now}
                nextDose={nextDoses.get(med.id)}
                onPress={() => router.push({ pathname: '/med/[id]', params: { id: med.id } })}
              />
            ))}
          </View>
          <BigButton
            title="Добавить лекарство"
            icon="add"
            variant="secondary"
            onPress={() => router.push('/med/new')}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tip: { paddingVertical: spacing.md, marginBottom: spacing.md },
  list: { marginTop: spacing.xs },
});
