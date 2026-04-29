/**
 * Toast — non-modal feedback that doesn't trigger the browser's
 * "<domain> says" dialog. Replaces window.alert calls everywhere.
 *
 * Mounted once at the root via <ToastHost />. Anywhere in the tree
 * can push a toast via the singleton functions exposed below.
 *
 * Singleton on purpose — toasts are global UX furniture, not React
 * state. Wiring them through context would force every parent of
 * every caller to re-render when a toast fires.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type ToastVariant = 'info' | 'success' | 'error';

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
  ttl: number;
}

let _id = 0;
let _push: ((t: ToastEntry) => void) | null = null;

export function pushToast(message: string, variant: ToastVariant = 'info', ttl = 3000) {
  _push?.({ id: ++_id, message, variant, ttl });
}

export function toastError(message: string, ttl = 4000) {
  pushToast(message, 'error', ttl);
}
export function toastSuccess(message: string, ttl = 2500) {
  pushToast(message, 'success', ttl);
}
export function toastInfo(message: string, ttl = 2500) {
  pushToast(message, 'info', ttl);
}

export function ToastHost() {
  const [items, setItems] = useState<ToastEntry[]>([]);

  useEffect(() => {
    _push = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((p) => p.id !== t.id));
      }, t.ttl);
    };
    return () => { _push = null; };
  }, []);

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {items.map((t) => <ToastPill key={t.id} entry={t} onDismiss={() =>
        setItems((prev) => prev.filter((p) => p.id !== t.id))
      } />)}
    </View>
  );
}

function ToastPill({ entry, onDismiss }: { entry: ToastEntry; onDismiss: () => void }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);
  const accent =
    entry.variant === 'error' ? Colors.error :
    entry.variant === 'success' ? Colors.success :
    Colors.primary;
  const icon =
    entry.variant === 'error' ? 'alert-circle' :
    entry.variant === 'success' ? 'checkmark-circle' :
    'information-circle';
  return (
    <Animated.View style={[styles.pill, { opacity, borderLeftColor: accent }]}>
      <Ionicons name={icon as any} size={18} color={accent} />
      <Text style={styles.text} numberOfLines={3}>{entry.message}</Text>
      <Pressable onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={14} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 18,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 100000,
    gap: 8,
    paddingHorizontal: 12,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4, borderColor: Colors.border, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 14,
    maxWidth: 480, width: '100%',
    // Soft shadow for separation from the app body
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
});
