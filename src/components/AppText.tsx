import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, font } from '@/constants/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'h1'
  | 'h2'
  | 'body'
  | 'small'
  | 'tiny'
  | 'label';

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  children?: ReactNode;
};

const sizes: Record<TextVariant, { fontSize: number; lineHeight: number; weight: TextStyle['fontWeight'] }> = {
  display: { fontSize: font.display, lineHeight: 46, weight: '800' },
  title: { fontSize: font.title, lineHeight: 36, weight: '800' },
  h1: { fontSize: font.h1, lineHeight: 31, weight: '700' },
  h2: { fontSize: font.h2, lineHeight: 27, weight: '700' },
  body: { fontSize: font.body, lineHeight: 25, weight: '400' },
  small: { fontSize: font.small, lineHeight: 22, weight: '400' },
  tiny: { fontSize: font.tiny, lineHeight: 19, weight: '500' },
  label: { fontSize: font.small, lineHeight: 22, weight: '700' },
};

export function AppText({
  variant = 'body',
  color = colors.text,
  weight,
  align,
  style,
  children,
  ...rest
}: Props) {
  const preset = sizes[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: preset.fontSize,
          lineHeight: preset.lineHeight,
          fontWeight: weight ?? preset.weight,
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
