import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { BigButton, LinkButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { formatBytes, progressPercent } from '@/updates/format';
import type { UpdateStatus } from '@/updates/types';
import { useUpdateStore } from '@/updates/store';

type Hero = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  background: string;
  color: string;
};

function heroFor(
  status: UpdateStatus,
  version: string,
  downloadedVersion: string | null
): Hero {
  switch (status) {
    case 'checking':
      return {
        title: 'Проверяем обновления…',
        description: 'Это займёт несколько секунд.',
        icon: 'sync-outline',
        background: colors.primarySoft,
        color: colors.primary,
      };
    case 'available':
      return {
        title: `Доступна версия ${version}`,
        description: 'Можно скачать и установить обновление.',
        icon: 'cloud-download-outline',
        background: colors.warningSoft,
        color: colors.warning,
      };
    case 'downloading':
      return {
        title: 'Скачиваем обновление',
        description: 'Не закрывайте приложение до окончания загрузки.',
        icon: 'cloud-download-outline',
        background: colors.primarySoft,
        color: colors.primary,
      };
    case 'ready':
      return {
        title: 'Обновление готово',
        description: downloadedVersion
          ? `Версия ${downloadedVersion} скачана и проверена.`
          : 'Файл обновления скачан и проверен.',
        icon: 'download-outline',
        background: colors.successSoft,
        color: colors.success,
      };
    case 'installing':
      return {
        title: 'Открываем установщик',
        description: 'Подтвердите установку в окне Android.',
        icon: 'phone-portrait-outline',
        background: colors.primarySoft,
        color: colors.primary,
      };
    case 'current':
      return {
        title: 'У вас последняя версия',
        description: 'Обновления не требуются.',
        icon: 'checkmark-circle-outline',
        background: colors.successSoft,
        color: colors.success,
      };
    case 'error':
      return {
        title: 'Не удалось проверить обновления',
        description: 'Проверьте интернет и попробуйте ещё раз.',
        icon: 'alert-circle-outline',
        background: colors.dangerSoft,
        color: colors.danger,
      };
    case 'unsupported':
      return {
        title: 'Обновления недоступны',
        description: 'Установка APK работает только в Android-сборке приложения.',
        icon: 'information-circle-outline',
        background: colors.cardMuted,
        color: colors.textSecondary,
      };
    default:
      return {
        title: 'Проверка обновлений',
        description: 'Нажмите кнопку, чтобы проверить новую версию.',
        icon: 'cloud-download-outline',
        background: colors.primarySoft,
        color: colors.primary,
      };
  }
}

export default function UpdatesScreen() {
  const start = useUpdateStore((state) => state.start);
  const status = useUpdateStore((state) => state.status);
  const checking = useUpdateStore((state) => state.checking);
  const manifest = useUpdateStore((state) => state.manifest);
  const progress = useUpdateStore((state) => state.progress);
  const error = useUpdateStore((state) => state.error);
  const downloadedVersion = useUpdateStore((state) => state.downloadedVersion);
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const check = useUpdateStore((state) => state.check);
  const downloadAndInstall = useUpdateStore((state) => state.downloadAndInstall);
  const installAgain = useUpdateStore((state) => state.installAgain);
  const openSettings = useUpdateStore((state) => state.openInstallSettings);
  const clearError = useUpdateStore((state) => state.clearError);

  useEffect(() => {
    void start();
  }, [start]);

  const percent = progressPercent(progress);
  const hero = heroFor(status, manifest?.version ?? downloadedVersion ?? currentVersion, downloadedVersion);
  const busy =
    checking ||
    status === 'checking' ||
    status === 'downloading' ||
    status === 'installing';

  const onPrimary = () => {
    if (status === 'available') return void downloadAndInstall();
    if (status === 'ready') return void installAgain();
    if (status === 'unsupported') return;
    clearError();
    return void check();
  };

  let primaryTitle = 'Проверить обновления';
  let primaryIcon: ComponentProps<typeof BigButton>['icon'] = 'refresh';
  if (status === 'available') {
    primaryTitle = 'Скачать и установить';
    primaryIcon = 'download-outline';
  } else if (status === 'ready') {
    primaryTitle = 'Установить';
    primaryIcon = 'download-outline';
  } else if (status === 'downloading') {
    primaryTitle = `Скачиваем ${percent}%`;
    primaryIcon = 'cloud-download-outline';
  } else if (status === 'installing') {
    primaryTitle = 'Открываем установщик…';
    primaryIcon = 'phone-portrait-outline';
  } else if (status === 'checking' || checking) {
    primaryTitle = 'Проверяем…';
    primaryIcon = 'sync-outline';
  } else if (status === 'error') {
    primaryTitle = 'Повторить';
    primaryIcon = 'refresh';
  }

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      header={<Header title="Обновление" subtitle="Версия приложения" back />}
    >
      <Card style={styles.card}>
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: hero.background }]}>
            <Ionicons name={hero.icon} size={30} color={hero.color} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="h2">{hero.title}</AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {hero.description}
            </AppText>
          </View>
        </View>

        <View style={styles.versionRow}>
          <Badge label={`установлено ${currentVersion}`} tone="muted" small />
          {manifest && status !== 'current' && (
            <Badge label={`доступно ${manifest.version}`} tone="primary" small />
          )}
          {manifest && <Badge label={formatBytes(manifest.size)} tone="muted" small />}
        </View>

        {status === 'downloading' && (
          <View style={styles.progress}>
            <ProgressBar value={progress} />
            <AppText variant="tiny" color={colors.textMuted} align="right">
              {percent}%{manifest ? ` · ${formatBytes(manifest.size)}` : ''}
            </AppText>
          </View>
        )}

        {manifest && manifest.notes.trim() !== '' && status !== 'current' && (
          <View style={styles.notes}>
            <AppText variant="small" weight="700">
              Что нового
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {manifest.notes.trim()}
            </AppText>
          </View>
        )}

        {error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <AppText variant="small" color={colors.danger} style={styles.errorText}>
              {error}
            </AppText>
          </View>
        )}
      </Card>

      {status !== 'unsupported' && (
        <View style={styles.actions}>
          <BigButton
            title={primaryTitle}
            icon={primaryIcon}
            loading={status === 'downloading' || status === 'installing' || status === 'checking' || checking}
            disabled={busy && status !== 'available' && status !== 'ready'}
            onPress={onPrimary}
          />
          {(status === 'available' || status === 'ready') && (
            <BigButton
              title="Проверить обновления"
              icon="refresh"
              variant="secondary"
              onPress={() => void check()}
              disabled={busy}
            />
          )}
        </View>
      )}

      {status !== 'unsupported' && (
        <Card muted style={styles.hint}>
          <AppText variant="small" color={colors.textSecondary}>
            Android откроет системный установщик и попросит подтвердить обновление.
            Данные приложения при этом сохраняются.
          </AppText>
          <LinkButton
            title="Разрешить установку из этого приложения"
            icon="shield-checkmark-outline"
            onPress={() => void openSettings()}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm, gap: spacing.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  versionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  progress: { gap: spacing.xs },
  notes: { gap: spacing.xs, marginTop: spacing.xs },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { flex: 1 },
  actions: { marginTop: spacing.lg, gap: spacing.md },
  hint: { marginTop: spacing.xl, gap: spacing.sm },
});
