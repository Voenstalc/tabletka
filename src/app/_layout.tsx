import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { colors, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/appStore';
import { useUpdateStore } from '@/updates/store';
import {
  rescheduleAllNotifications,
  shouldRescheduleNotifications,
} from '@/notifications/scheduler';
import {
  ACTION_SKIP,
  ACTION_SNOOZE,
  ACTION_TAKE,
  configureNotificationHandler,
} from '@/notifications/setup';
import '@/notifications/background';

configureNotificationHandler(() => useAppStore.getState().settings);

export default function RootLayout() {
  const ready = useAppStore((state) => state.ready);
  const initializing = useAppStore((state) => state.initializing);
  const error = useAppStore((state) => state.error);
  const init = useAppStore((state) => state.init);
  const tick = useAppStore((state) => state.tick);
  const refresh = useAppStore((state) => state.refresh);
  const refreshPermission = useAppStore((state) => state.refreshPermission);
  const takeDose = useAppStore((state) => state.takeDose);
  const skipDose = useAppStore((state) => state.skipDose);
  const snoozeDose = useAppStore((state) => state.snoozeDose);
  const startUpdates = useUpdateStore((state) => state.start);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!ready) return;
    void startUpdates();
  }, [ready, startUpdates]);

  useEffect(() => {
    const timer = setInterval(() => tick(), 30000);
    return () => clearInterval(timer);
  }, [tick]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      tick();
      void refresh();
      void refreshPermission();
      void useUpdateStore.getState().check({ silent: true });
      void (async () => {
        if (!shouldRescheduleNotifications()) return;
        const { meds, settings } = useAppStore.getState();
        if (settings.notificationsEnabled) {
          await rescheduleAllNotifications(meds, settings).catch(() => undefined);
        }
      })();
    });
    return () => subscription.remove();
  }, [refresh, refreshPermission, tick]);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;

    const handle = async (response: Notifications.NotificationResponse) => {
      if (disposed) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type;
      const medicationId = typeof data?.medicationId === 'string' ? data.medicationId : '';
      const scheduledAt = typeof data?.scheduledAt === 'string' ? data.scheduledAt : '';

      try {
        if (type === 'dose' && medicationId && scheduledAt) {
          if (response.actionIdentifier === ACTION_TAKE) {
            await takeDose(medicationId, scheduledAt);
          } else if (response.actionIdentifier === ACTION_SKIP) {
            await skipDose(medicationId, scheduledAt);
          } else if (response.actionIdentifier === ACTION_SNOOZE) {
            await snoozeDose(medicationId, scheduledAt);
          } else {
            router.push({
              pathname: '/med/[id]',
              params: { id: medicationId },
            });
          }
        } else if (type === 'low-stock' && medicationId) {
          router.push({ pathname: '/med/[id]', params: { id: medicationId } });
        }
      } finally {
        Notifications.clearLastNotificationResponse();
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handle);
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) void handle(lastResponse);

    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [ready, skipDose, snoozeDose, takeDose]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      ) : (
        <View style={styles.loading}>
          <View style={styles.logo}>
            <Ionicons name="medkit" size={48} color={colors.white} />
          </View>
          <AppText variant="title">Таблетка</AppText>
          {error ? (
            <>
              <AppText
                variant="body"
                color={colors.textSecondary}
                align="center"
                style={styles.errorText}
              >
                {error}
              </AppText>
              <BigButton
                title="Попробовать снова"
                onPress={() => void init()}
                style={styles.retry}
              />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
              <AppText variant="small" color={colors.textMuted}>
                {initializing ? 'Загружаем ваши лекарства…' : 'Открываем приложение…'}
              </AppText>
            </>
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  spinner: { marginTop: spacing.lg },
  errorText: { maxWidth: 420 },
  retry: { alignSelf: 'stretch', marginTop: spacing.lg },
});
