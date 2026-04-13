import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Weight } from '../../constants/typography';
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

export function Button({ title, onPress, variant = 'primary', size = 'md', loading = false, disabled = false, style, textStyle, icon }: ButtonProps) {
  const off = disabled || loading;
  return (
    <TouchableOpacity onPress={onPress} disabled={off} style={[s.base, v[variant], sz[size], off && s.off, style]} activeOpacity={0.75}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFF' : Colors.primary} size="small" />
      ) : (
        <>{icon}<Text style={[s.text, tv[variant], ts[size], textStyle]}>{title}</Text></>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  off: { opacity: 0.4 },
  text: { fontWeight: Weight.semibold },
});
const v = StyleSheet.create({
  primary: { backgroundColor: Colors.primary, borderRadius: Radius.md },
  secondary: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.md },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  ghost: { backgroundColor: 'transparent', borderRadius: Radius.md },
});
const sz = StyleSheet.create({
  sm: { paddingHorizontal: 12, paddingVertical: 7 },
  md: { paddingHorizontal: 18, paddingVertical: 10 },
  lg: { paddingHorizontal: 22, paddingVertical: 13 },
});
const tv = StyleSheet.create({
  primary: { color: '#FFF' },
  secondary: { color: Colors.textPrimary },
  outline: { color: Colors.textPrimary },
  ghost: { color: Colors.primary },
});
const ts = StyleSheet.create({
  sm: { fontSize: 13 },
  md: { fontSize: 14 },
  lg: { fontSize: 15 },
});
