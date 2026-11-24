import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Field({ label, hint, error, required, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">
        {label}
        {required ? <AppText color={colors.danger}> *</AppText> : null}
      </AppText>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, rest.multiline && styles.multiline, error && styles.inputError, style]}
      />
      {!!hint && !error && (
        <AppText variant="tiny" color={colors.textMuted}>
          {hint}
        </AppText>
      )}
      {!!error && (
        <AppText variant="tiny" color={colors.danger}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg, gap: 6 },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 19,
    color: colors.text,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
});
