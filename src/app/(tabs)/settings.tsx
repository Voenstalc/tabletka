import { useEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BigButton, LinkButton } from '@/components/BigButton';
import { Badge, SectionTitle } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Chip, Row } from '@/components/Chip';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/constants/theme';
import { REPEAT_OPTIONS, SNOOZE_OPTIONS } from '@/constants/schedule';
import {
  hasExactAlarmPermission,
  requestExactAlarmPermission,
  requestNotificationPermission,
} from '@/notifications/setup';
import { scheduleTestNotification } from '@/notifications/scheduler';
import { pickBackupFile, shareBackup } from '@/services/backup';
import { useAppStore } from '@/store/appStore';
import { useUpdateStore } from '@/updates/store';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
}

function Group({ children }: { children: ReactNode }) {
  return <Card style={styles.group}>{children}</Card>;
}

function Item({
  icon,
  title,
  description,
  right,
  onPress,
  danger = false,
  last = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.item, !last && styles.itemBorder]}>
      <View
        style={[
          styles.itemIcon,
          { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft },
        ]}
      >
        <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.itemTexts}>
        <AppText variant="small" weight="700" color={danger ? colors.danger : colors.text}>
          {title}
        </AppText>
        {!!description && (
          <AppText variant="tiny" color={colors.textMuted}>
            {description}
          </AppText>
        )}
      </View>
      {right}
      {onPress && !right && (
        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      )}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const settings = useAppStore((state) => state.settings);
  const activeProfile = useAppStore((state) => state.activeProfile);
  const profiles = useAppStore((state) => state.profiles);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const refreshPermission = useAppStore((state) => state.refreshPermission);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const importBackup = useAppStore((state) => state.importBackup);
  const resetAllData = useAppStore((state) => state.resetAllData);
  const seedDemo = useAppStore((state) => state.seedDemo);

  const updateStatus = useUpdateStore((state) => state.status);
  const updateVersion = useUpdateStore((state) => state.manifest?.version ?? '');
  const updateProgress = useUpdateStore((state) => state.progress);
  const updateDownloaded = useUpdateStore((state) => state.downloadedVersion);

  const updateDescription = (() => {
    switch (updateStatus) {
      case 'checking':
        return 'Проверяем обновления…';
      case 'available':
        return updateVersion ? `Доступна версия ${updateVersion}` : 'Доступно обновление';
      case 'ready':
        return updateDownloaded
          ? `Версия ${updateDownloaded} готова к установке`
          : 'Обновление готово к установке';
      case 'downloading':
        return `Скачивание ${Math.round(updateProgress * 100)}%`;
      case 'installing':
        return 'Открываем установщик…';
      case 'current':
        return 'Установлена последняя версия';
      case 'error':
        return 'Не удалось проверить обновления';
      case 'unsupported':
        return 'Только для Android-сборки';
      default:
        return 'Проверить вручную';
    }
  })();
  const updateAvailable = updateStatus === 'available' || updateStatus === 'ready';

  const [exactAlarm, setExactAlarm] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const update = () => {
      void hasExactAlarmPermission()
        .then((value) => {
          if (mounted) setExactAlarm(value);
        })
        .catch(() => {
          if (mounted) setExactAlarm(true);
        });
    };
    update();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission(settings);
    await refreshPermission();
    if (!granted) {
      Alert.alert(
        'Нужно разрешение',
        'Разрешите уведомления в настройках телефона — иначе напоминания не смогут появиться.',
        [
          { text: 'Позже', style: 'cancel' },
          { text: 'Открыть настройки', onPress: () => void Linking.openSettings() },
        ]
      );
    }
    return granted;
  };

  const toggleNotifications = async (value: boolean) => {
    if (!value) {
      await updateSettings({ notificationsEnabled: false });
      return;
    }
    const granted = await ensurePermission();
    await updateSettings({ notificationsEnabled: granted });
  };

  const onTest = async () => {
    const granted = await ensurePermission();
    if (!granted) return;
    await updateSettings({ notificationsEnabled: true });
    try {
      await scheduleTestNotification(settings);
      Alert.alert('Проверка запущена', 'Тестовое уведомление придёт примерно через 5 секунд.');
    } catch (error) {
      Alert.alert('Не удалось', errorText(error));
    }
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      await shareBackup(backup);
    } catch (error) {
      Alert.alert('Не удалось сохранить копию', errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    try {
      const data = await pickBackupFile();
      if (!data) return;
      Alert.alert(
        'Заменить данные?',
        'Текущие лекарства, расписание и история будут заменены данными из файла. Это действие нельзя отменить.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Загрузить',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusy(true);
                try {
                  await importBackup(data);
                  Alert.alert('Готово', 'Резервная копия загружена.');
                } catch (error) {
                  Alert.alert('Не удалось загрузить копию', errorText(error));
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Не удалось прочитать файл', errorText(error));
    }
  };

  const onReset = () => {
    Alert.alert(
      'Удалить все данные?',
      'Лекарства, профили и вся история приёмов будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await resetAllData();
                Alert.alert('Готово', 'Все данные удалены.');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const onRequestExactAlarm = async () => {
    const granted = await requestExactAlarmPermission();
    setExactAlarm(granted);
    if (granted) {
      await updateSettings({});
    } else {
      Alert.alert(
        'Точные напоминания',
        'Разрешите «Будильники и напоминания» в настройках Android, чтобы уведомления приходили минута в минуту.'
      );
    }
  };

  return (
    <Screen header={<Header title="Настройки" subtitle="Профиль, напоминания и данные" />}>
      <SectionTitle title="Профиль" />
      <Group>
        <Item
          icon="person-circle-outline"
          title={activeProfile?.name ?? 'Профиль'}
          description={`Профилей на телефоне: ${profiles.length}`}
          right={<Badge label="активный" tone="primary" small />}
          onPress={() => router.push('/profiles')}
        />
      </Group>

      <SectionTitle title="Напоминания" />
      <Group>
        <Item
          icon="notifications-outline"
          title="Уведомления о приёме"
          description="Напоминания даже при закрытом приложении"
          right={
            <Switch
              value={settings.notificationsEnabled && notificationPermission}
              onValueChange={(value) => void toggleNotifications(value)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          }
        />
        <Item
          icon={notificationPermission ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          title="Разрешение на уведомления"
          description={
            notificationPermission
              ? 'Разрешение выдано'
              : 'Не выдано — напоминания не появятся'
          }
          right={
            notificationPermission ? (
              <Badge label="есть" tone="success" small />
            ) : (
              <LinkButton title="Разрешить" onPress={() => void ensurePermission()} />
            )
          }
        />
        <Item
          icon="volume-high-outline"
          title="Звук"
          right={
            <Switch
              value={settings.soundEnabled}
              onValueChange={(value) => void updateSettings({ soundEnabled: value })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          }
        />
        <Item
          icon="phone-portrait-outline"
          title="Вибрация"
          last
          right={
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={(value) => void updateSettings({ vibrationEnabled: value })}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.white}
            />
          }
        />
      </Group>

      <Card style={styles.optionsCard}>
        <AppText variant="small" weight="700">
          Отложить напоминание на
        </AppText>
        <Row>
          {SNOOZE_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} мин`}
              selected={settings.snoozeMinutes === minutes}
              onPress={() => void updateSettings({ snoozeMinutes: minutes })}
            />
          ))}
        </Row>
      </Card>

      <Card style={styles.optionsCard}>
        <View style={styles.optionHeader}>
          <View style={styles.flex}>
            <AppText variant="small" weight="700">
              Повторное напоминание
            </AppText>
            <AppText variant="tiny" color={colors.textMuted}>
              Если приём не отмечен, напомним ещё раз
            </AppText>
          </View>
          <Switch
            value={settings.repeatReminder}
            onValueChange={(value) => void updateSettings({ repeatReminder: value })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        {settings.repeatReminder && (
          <Row>
            {REPEAT_OPTIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={`через ${minutes} мин`}
                selected={settings.repeatMinutes === minutes}
                onPress={() => void updateSettings({ repeatMinutes: minutes })}
              />
            ))}
          </Row>
        )}
      </Card>

      {Platform.OS === 'android' && (
        <Card style={styles.optionsCard}>
          <View style={styles.optionHeader}>
            <View style={styles.flex}>
              <AppText variant="small" weight="700">
                Точные напоминания
              </AppText>
              <AppText variant="tiny" color={colors.textMuted}>
                {exactAlarm === null
                  ? 'Проверяем разрешение…'
                  : exactAlarm
                    ? 'Разрешены — уведомления приходят минута в минуту'
                    : 'Не разрешены — уведомление может задержаться'}
              </AppText>
            </View>
            {exactAlarm === false && (
              <LinkButton title="Разрешить" onPress={() => void onRequestExactAlarm()} />
            )}
            {exactAlarm && <Badge label="есть" tone="success" small />}
          </View>
        </Card>
      )}

      <BigButton
        title="Проверить уведомление"
        icon="notifications-outline"
        variant="secondary"
        onPress={() => void onTest()}
        style={styles.testButton}
      />

      <SectionTitle title="Данные" />
      <Group>
        <Item
          icon="download-outline"
          title="Сохранить резервную копию"
          description="Файл JSON с лекарствами и историей"
          onPress={() => void onExport()}
        />
        <Item
          icon="cloud-upload-outline"
          title="Загрузить из копии"
          description="Заменит текущие данные"
          onPress={() => void onImport()}
        />
        {__DEV__ && (
          <Item
            icon="flask-outline"
            title="Заполнить примером"
            description="Три демонстрационных лекарства"
            onPress={() => void seedDemo()}
          />
        )}
        <Item
          icon="trash-outline"
          title="Удалить все данные"
          description="Профили, лекарства и история"
          danger
          last
          onPress={onReset}
        />
      </Group>

      <SectionTitle title="О приложении" />
      <Group>
        <Item
          icon="information-circle-outline"
          title={`Таблетка ${Constants.expoConfig?.version ?? '0.1.0'}`}
          description="Все данные хранятся только на этом телефоне. Приложение не отправляет их в интернет."
        />
        <Item
          icon="cloud-download-outline"
          title="Обновление приложения"
          description={updateDescription}
          right={
            updateAvailable ? (
              <Badge label="доступно" tone="warning" small />
            ) : undefined
          }
          onPress={() => router.push('/updates')}
          last
        />
      </Group>

      <AppText variant="tiny" color={colors.textMuted} align="center" style={styles.footer}>
        Приложение помогает не забывать о приёме, но не заменяет назначения врача.
        {'\n'}Не изменяйте дозировку без консультации со специалистом.
      </AppText>

      {busy && (
        <AppText variant="tiny" color={colors.primary} align="center" style={styles.busy}>
          Пожалуйста, подождите…
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { padding: 0, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTexts: { flex: 1, gap: 1 },
  pressed: { backgroundColor: colors.cardMuted },
  optionsCard: { marginTop: spacing.md, gap: spacing.md },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  testButton: { marginTop: spacing.md },
  footer: { marginTop: spacing.xxl, lineHeight: 20 },
  busy: { marginTop: spacing.md },
});
