import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Chip, Row } from '@/components/Chip';
import { spacing } from '@/constants/theme';
import { WEEKDAYS } from '@/constants/schedule';

type Props = {
  value: number[];
  onChange: (days: number[]) => void;
};

export function WeekdayPicker({ value, onChange }: Props) {
  const toggle = (day: number) => {
    if (value.includes(day)) onChange(value.filter((item) => item !== day));
    else onChange([...value, day].sort((a, b) => a - b));
  };

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">Дни недели</AppText>
      <Row>
        {WEEKDAYS.map((day) => (
          <Chip
            key={day.value}
            label={day.short}
            selected={value.includes(day.value)}
            onPress={() => toggle(day.value)}
            style={styles.day}
          />
        ))}
      </Row>
      <Row>
        <Chip
          label="Будни"
          selected={value.length === 5 && value.every((day) => day <= 5)}
          onPress={() => onChange([1, 2, 3, 4, 5])}
        />
        <Chip
          label="Каждый день"
          selected={value.length === 7}
          onPress={() => onChange([1, 2, 3, 4, 5, 6, 7])}
        />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg, gap: spacing.sm },
  day: { minWidth: 54, justifyContent: 'center' },
});
