import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Radius } from '../../constants/design';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : Colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              textVariantStyles[variant],
              textSizeStyles[size],
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontFamily: Fonts.bodySemiBold,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  secondary: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
  },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: 14, paddingVertical: 8 },
  md: { paddingHorizontal: 20, paddingVertical: 12 },
  lg: { paddingHorizontal: 24, paddingVertical: 15 },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: '#FFFFFF' },
  secondary: { color: Colors.textPrimary },
  outline: { color: Colors.textPrimary },
  ghost: { color: Colors.primary },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: 14 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
});
