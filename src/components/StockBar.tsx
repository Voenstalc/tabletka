import { StyleSheet, View } from 'react-native';
import type { Medication } from '@/types';
import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { colors, spacing } from '@/constants/theme';
import { daysLeftLabel } from '@/lib/schedule';
import { daysOfStockLeft, isLowStock, stockBarRatio, stockUnitsLabel } from '@/lib/stock';

type Props = {
  med: Medication;
  now: number;
  compact?: boolean;
};

export function StockBar({ med, now, compact = false }: Props) {
  const left = daysOfStockLeft(med, now);
  const low = isLowStock(med, now);
  const color = low ? colors.warning : colors.success;
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <AppText variant={compact ? 'small' : 'body'} weight="700" numberOfLines={1}>
          Осталось: {stockUnitsLabel(med)}
        </AppText>
        {low && <Badge label={med.stock <= 0 ? 'Закончились' : 'Мало'} tone="warning" small />}
      </View>
      <ProgressBar value={stockBarRatio(med, now)} color={color} height={compact ? 9 : 12} />
      <AppText variant="tiny" color={low ? colors.warning : colors.textMuted}>
        {daysLeftLabel(left)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
