import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Medication, MedicationForm, Schedule, ScheduleType } from '@/types';
import { AppText } from '@/components/AppText';
import { BigButton } from '@/components/BigButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Chip, OptionGrid, Row } from '@/components/Chip';
import { DateField, DateQuickPicks } from '@/components/DateField';
import { Field } from '@/components/Field';
import { FormSection } from '@/components/FormSection';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { TimeListField } from '@/components/TimeListField';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import {
  DEFAULT_LOW_STOCK_DAYS,
  INTERVAL_OPTIONS,
  MED_COLORS,
  MED_FORMS,
} from '@/constants/schedule';
import {
  colors,
  radius,
  spacing,
} from '@/constants/theme';
import {
  addDaysToKey,
  dateKey,
  formatDateKeyRu,
  formatShortDateWithYear,
  parseDateKey,
} from '@/lib/date';
import {
  everyNHoursPreview,
  isScheduleValid,
  normalizeTime,
  sortTimes,
} from '@/lib/schedule';
import { unitForForm } from '@/lib/stock';
import { requestNotificationPermission } from '@/notifications/setup';
import { useAppStore } from '@/store/appStore';

type Props = {
  existing?: Medication;
};

const SCHEDULE_OPTIONS: {
  value: ScheduleType;
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  {
    value: 'daily_times',
    title: 'Каждый день',
    description: 'Одно или несколько времён',
    icon: 'sunny-outline',
  },
  {
    value: 'weekdays',
    title: 'По дням недели',
    description: 'Например, по будням',
    icon: 'calendar-outline',
  },
  {
    value: 'every_n_hours',
    title: 'Каждые N часов',
    description: 'Антибиотики и курсы',
    icon: 'time-outline',
  },
  {
    value: 'course',
    title: 'Курс',
    description: 'С датой начала и конца',
    icon: 'medkit-outline',
  },
];

export function MedicationFormScreen({ existing }: Props) {
  const saveMedication = useAppStore((state) => state.saveMedication);
  const notificationPermission = useAppStore((state) => state.notificationPermission);
  const refreshPermission = useAppStore((state) => state.refreshPermission);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [name, setName] = useState(existing?.name ?? '');
  const [dosage, setDosage] = useState(existing?.dosage ?? '');
  const [form, setForm] = useState<MedicationForm>(existing?.form ?? 'tablet');
  const [dose, setDose] = useState(existing?.dose ?? 1);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [stock, setStock] = useState(Math.max(0, existing?.stock ?? 0));
  const [lowStockDays, setLowStockDays] = useState(
    existing?.lowStockDays ?? DEFAULT_LOW_STOCK_DAYS
  );
  const [color, setColor] = useState(existing?.color ?? MED_COLORS[0]);

  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    existing?.schedule.type ?? 'daily_times'
  );
  const [times, setTimes] = useState<string[]>(existing?.schedule.times ?? ['08:00']);
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.schedule.weekdays ?? [1, 2, 3, 4, 5, 6, 7]
  );
  const [intervalHours, setIntervalHours] = useState(existing?.schedule.intervalHours ?? 8);
  const [startDate, setStartDate] = useState(
    existing?.schedule.startDate || dateKey(new Date())
  );
  const [endDate, setEndDate] = useState(
    existing?.schedule.endDate || dateKey(addDays(new Date(), 6))
  );
  const [saving, setSaving] = useState(false);

  const unit = unitForForm(form);

  const changeScheduleType = (type: ScheduleType) => {
    setScheduleType(type);
    if (type === 'course' && endDate < startDate) setEndDate(startDate);
    if (type === 'every_n_hours' && times.length > 1) setTimes([times[0]]);
  };

  const changeStartDate = (value: string) => {
    setStartDate(value);
    if (scheduleType === 'course' && endDate < value) setEndDate(value);
  };

  const pickCourseLength = (days: number) => {
    if (days === 0) {
      setEndDate(startDate);
      return;
    }
    setEndDate(addDaysToKey(startDate, days - 1));
  };

  const courseLength =
    differenceInCalendarDays(parseDateKey(endDate), parseDateKey(startDate)) + 1;

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Не хватает названия', 'Укажите название лекарства.');
      return;
    }
    if (dose <= 0) {
      Alert.alert('Проверьте дозу', 'Доза за один приём должна быть больше нуля.');
      return;
    }
    const normalizedTimes =
      scheduleType === 'every_n_hours'
        ? [normalizeTime(times[0] ?? '08:00')]
        : sortTimes(Array.from(new Set(times.map(normalizeTime))));

    if (scheduleType !== 'every_n_hours' && normalizedTimes.length === 0) {
      Alert.alert('Добавьте время', 'Укажите хотя бы одно время приёма.');
      return;
    }
    if (scheduleType === 'weekdays' && weekdays.length === 0) {
      Alert.alert('Выберите дни', 'Отметьте хотя бы один день недели.');
      return;
    }
    const schedule: Schedule = {
      type: scheduleType,
      times: normalizedTimes,
      weekdays,
      intervalHours,
      startDate,
      endDate: scheduleType === 'course' ? endDate : null,
    };
    if (!isScheduleValid(schedule)) {
      Alert.alert('Проверьте расписание', 'В расписании есть незаполненные поля.');
      return;
    }
    if (scheduleType === 'course' && endDate < startDate) {
      Alert.alert('Проверьте даты', 'Дата окончания курса не может быть раньше начала.');
      return;
    }

    setSaving(true);
    try {
      const id = await saveMedication(
        {
          name,
          dosage,
          form,
          unit,
          dose,
          notes,
          color,
          schedule,
          stock,
          lowStockDays,
        },
        existing?.id
      );

      if (!notificationPermission) {
        const granted = await requestNotificationPermission(settings);
        await refreshPermission();
        if (granted) {
          await updateSettings({ notificationsEnabled: true });
        } else {
          Alert.alert(
            'Уведомления выключены',
            'Лекарство сохранено, но напоминания не появятся без разрешения. Его можно выдать в настройках телефона.'
          );
        }
      }

      if (existing) router.back();
      else router.replace({ pathname: '/med/[id]', params: { id } });
    } catch (error) {
      Alert.alert(
        'Не удалось сохранить',
        error instanceof Error ? error.message : 'Попробуйте ещё раз.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      header={
        <Header
          title={existing ? 'Изменить лекарство' : 'Новое лекарство'}
          subtitle={existing ? existing.name : 'Заполните данные и расписание'}
          back
        />
      }
    >
      <FormSection title="Лекарство">
        <Field
          label="Название"
          required
          value={name}
          onChangeText={setName}
          placeholder="Например, Витамин D3"
          autoCapitalize="sentences"
          maxLength={80}
        />
        <Field
          label="Дозировка"
          value={dosage}
          onChangeText={setDosage}
          placeholder="Например, 500 мг"
          maxLength={40}
        />
        <AppText variant="label" style={styles.groupLabel}>
          Форма выпуска
        </AppText>
        <OptionGrid
          options={MED_FORMS.map((item) => ({
            value: item.value,
            title: item.label,
          }))}
          value={form}
          onChange={(value) => setForm(value)}
        />
        <View style={styles.stepperBox}>
          <Stepper
            label="Доза за один приём"
            value={dose}
            onChange={setDose}
            min={0.5}
            max={50}
            step={0.5}
            suffix={unit}
            hint="Сколько единиц принять за раз"
          />
        </View>
      </FormSection>

      <FormSection title="Расписание" description="Когда напоминать о приёме">
        <OptionGrid
          options={SCHEDULE_OPTIONS}
          value={scheduleType}
          onChange={changeScheduleType}
        />
        <View style={styles.scheduleBody}>
          {scheduleType === 'daily_times' && <TimeListField times={times} onChange={setTimes} />}

          {scheduleType === 'weekdays' && (
            <>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
              <TimeListField times={times} onChange={setTimes} />
            </>
          )}

          {scheduleType === 'every_n_hours' && (
            <>
              <TimeListField
                times={times.slice(0, 1)}
                onChange={(next) =>
                  setTimes([next[0] ?? '08:00'])
                }
                max={1}
                label="Время первого приёма"
                hint="Дальше приложение будет отсчитывать интервал"
              />
              <Stepper
                label="Интервал между приёмами"
                value={intervalHours}
                onChange={setIntervalHours}
                min={1}
                max={24}
                suffix="ч"
              />
              <Row>
                {INTERVAL_OPTIONS.map((value) => (
                  <Chip
                    key={value}
                    label={`${value} ч`}
                    selected={intervalHours === value}
                    onPress={() => setIntervalHours(value)}
                  />
                ))}
              </Row>
              <Card muted style={styles.preview}>
                <AppText variant="tiny" weight="700" color={colors.textSecondary}>
                  ПРИМЕРНОЕ РАСПИСАНИЕ НА СУТКИ
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  {everyNHoursPreview(times[0] ?? '08:00', intervalHours).join(', ')}
                </AppText>
              </Card>
              <DateField
                label="Дата начала"
                value={startDate}
                onChange={changeStartDate}
              />
            </>
          )}

          {scheduleType === 'course' && (
            <>
              <DateField
                label="Дата начала курса"
                value={startDate}
                onChange={changeStartDate}
                max={endDate}
              />
              <DateField
                label="Дата окончания"
                value={endDate}
                onChange={setEndDate}
                min={startDate}
              />
              <DateQuickPicks count={[7, 10, 14, 30]} onPick={pickCourseLength} />
              <AppText variant="tiny" color={colors.textMuted} style={styles.courseHint}>
                Длительность: {courseLength} дн. · {formatDateKeyRu(startDate, true)} —{' '}
                {formatDateKeyRu(endDate, true)}
              </AppText>
              <TimeListField times={times} onChange={setTimes} />
            </>
          )}
        </View>
      </FormSection>

      <FormSection title="Остаток" description="Приложение будет списывать по одной дозе при отметке «Принял»">
        <Stepper
          label="Сколько осталось"
          value={stock}
          onChange={setStock}
          min={0}
          max={999}
          suffix={unit}
          hint="Текущее количество в упаковке"
        />
        <Stepper
          label="Предупреждать заранее"
          value={lowStockDays}
          onChange={setLowStockDays}
          min={1}
          max={30}
          suffix="дн."
          hint="Если запаса хватит меньше чем на столько дней"
        />
        {!notificationPermission && (
          <Card muted style={styles.notifyHint}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <AppText variant="tiny" color={colors.textSecondary} style={styles.flex}>
              После сохранения приложение попросит разрешение на уведомления.
            </AppText>
          </Card>
        )}
      </FormSection>

      <FormSection title="Цвет" description="Чтобы лекарство было легко узнать в списке">
        <View style={styles.colors}>
          {MED_COLORS.map((value) => {
            const selected = value === color;
            return (
              <Pressable
                key={value}
                onPress={() => setColor(value)}
                accessibilityRole="button"
                accessibilityLabel={`Выбрать цвет ${value}`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.colorButton,
                  selected && styles.colorSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.colorCircle, { backgroundColor: value }]}>
                  {selected && <Ionicons name="checkmark" size={24} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </FormSection>

      <FormSection title="Заметка" description="Например, «принимать после еды»">
        <Field
          label="Заметка"
          value={notes}
          onChangeText={setNotes}
          placeholder="Необязательно"
          multiline
          maxLength={300}
        />
      </FormSection>

      <BigButton
        title={existing ? 'Сохранить изменения' : 'Сохранить лекарство'}
        icon="checkmark"
        onPress={() => void save()}
        loading={saving}
        style={styles.save}
      />
      {existing && (
        <Badge
          label={`Создано ${formatShortDateWithYear(new Date(existing.createdAt))}`}
          tone="muted"
          small
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupLabel: { marginBottom: spacing.xs },
  stepperBox: { marginTop: spacing.sm },
  scheduleBody: { marginTop: spacing.lg },
  preview: { marginBottom: spacing.lg, padding: spacing.md, gap: 4 },
  courseHint: { marginBottom: spacing.lg },
  notifyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  flex: { flex: 1 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorButton: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: { borderColor: colors.text },
  colorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  save: { marginTop: spacing.xxl },
});
