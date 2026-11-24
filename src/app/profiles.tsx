import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Profile } from '@/types';
import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { BigButton, IconButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { ModalSheet } from '@/components/ModalSheet';
import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/constants/theme';
import { useAppStore } from '@/store/appStore';

export default function ProfilesScreen() {
  const profiles = useAppStore((state) => state.profiles);
  const activeProfile = useAppStore((state) => state.activeProfile);
  const switchProfile = useAppStore((state) => state.switchProfile);
  const addProfile = useAppStore((state) => state.addProfile);
  const renameProfile = useAppStore((state) => state.renameProfile);
  const removeProfile = useAppStore((state) => state.removeProfile);

  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [name, setName] = useState('');

  const openNew = () => {
    setName('');
    setEditing('new');
  };
  const openEdit = (profile: Profile) => {
    setName(profile.name);
    setEditing(profile);
  };

  const save = async () => {
    const value = name.trim();
    if (!value) {
      Alert.alert('Введите имя', 'Имя профиля не может быть пустым.');
      return;
    }
    try {
      if (editing === 'new') await addProfile(value);
      else if (editing) await renameProfile(editing.id, value);
      setEditing(null);
    } catch (error) {
      Alert.alert(
        'Не удалось сохранить',
        error instanceof Error ? error.message : 'Попробуйте ещё раз.'
      );
    }
  };

  const confirmDelete = (profile: Profile) => {
    Alert.alert(
      `Удалить профиль «${profile.name}»?`,
      'Все лекарства и история приёмов этого профиля будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await removeProfile(profile.id);
              } catch (error) {
                Alert.alert(
                  'Не удалось удалить',
                  error instanceof Error ? error.message : 'Попробуйте ещё раз.'
                );
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      header={
        <Header
          title="Профили"
          subtitle="Несколько человек на одном телефоне"
          back
          right={<IconButton icon="add" label="Добавить профиль" onPress={openNew} />}
        />
      }
    >
      <View style={styles.list}>
        {profiles.map((profile) => {
          const active = profile.id === activeProfile?.id;
          return (
            <Card key={profile.id} style={styles.card}>
              <Pressable
                onPress={() => void switchProfile(profile.id)}
                accessibilityRole="button"
                accessibilityLabel={`Сделать профиль ${profile.name} активным`}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}
              >
                <View style={[styles.avatar, { backgroundColor: profile.color }]}>
                  <AppText variant="h2" color={colors.white} weight="800">
                    {profile.name.charAt(0).toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.texts}>
                  <View style={styles.nameRow}>
                    <AppText variant="h2" numberOfLines={1}>
                      {profile.name}
                    </AppText>
                    {active && <Badge label="активный" tone="primary" small />}
                  </View>
                  <AppText variant="tiny" color={colors.textMuted}>
                    {active ? 'Сейчас открыт этот профиль' : 'Нажмите, чтобы переключиться'}
                  </AppText>
                </View>
                {active && <Ionicons name="checkmark-circle" size={26} color={colors.primary} />}
              </Pressable>
              <View style={styles.actions}>
                <IconButton
                  icon="create-outline"
                  label={`Переименовать профиль ${profile.name}`}
                  onPress={() => openEdit(profile)}
                  background={colors.cardMuted}
                  color={colors.textSecondary}
                  size={44}
                />
                {profiles.length > 1 && (
                  <IconButton
                    icon="trash-outline"
                    label={`Удалить профиль ${profile.name}`}
                    onPress={() => confirmDelete(profile)}
                    background={colors.dangerSoft}
                    color={colors.danger}
                    size={44}
                  />
                )}
              </View>
            </Card>
          );
        })}
      </View>

      <BigButton
        title="Добавить профиль"
        icon="person-add-outline"
        variant="secondary"
        onPress={openNew}
        style={styles.add}
      />

      <AppText variant="tiny" color={colors.textMuted} style={styles.hint}>
        У каждого профиля свои лекарства, расписание, остатки и история приёмов.
        Уведомления приходят только для активного профиля.
      </AppText>

      <ModalSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Новый профиль' : 'Имя профиля'}
        scroll={false}
      >
        <Field
          label="Имя"
          value={name}
          onChangeText={setName}
          placeholder="Например, Мама"
          autoFocus
          maxLength={40}
        />
        <BigButton title="Сохранить" icon="checkmark" onPress={() => void save()} />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { padding: 0, overflow: 'hidden' },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: { backgroundColor: colors.cardMuted },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  add: { marginTop: spacing.xl },
  hint: { marginTop: spacing.xl, lineHeight: 20 },
});
