/**
 * KioskAppPicker — choose which installed apps Jude can reach.
 *
 * Opened from the parent panel. Writes the runtime allowlist
 * (lib/kiosk-allowlist.ts), which outranks the compiled seed, so adding a game
 * is: unlock, sideload it over ADB, tick it here, re-lock. No laptop edit, no
 * OTA.
 *
 * Rows with a hairline bottom border, per docs/UI_SYSTEM.md §5 — there are no
 * cards in this product.
 *
 * System apps are hidden by default. A Galaxy ships with roughly two hundred
 * launchable packages, nearly all of them Samsung and Google chrome that would
 * bury the six things you actually care about.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius, Spacing, Type, Heights } from '../../constants/design';
import { KIOSK_HIDDEN_PACKAGES } from '../../constants/kioskApps';
import { loadAllowlist, saveAllowlist, resetAllowlist } from '../../lib/kiosk-allowlist';
import { getLaunchableApps, type KioskLaunchableApp } from '../../modules/heretoo-kiosk';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fired after a successful save so the caller can re-provision. */
  onSaved: (packages: string[]) => void;
};

export function KioskAppPicker({ visible, onClose, onSaved }: Props) {
  const [apps, setApps] = useState<KioskLaunchableApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [dirty, setDirty] = useState(false);

  const styles = makeStyles();

  useEffect(() => {
    if (!visible) return;
    setApps(getLaunchableApps());
    loadAllowlist().then((list) => setSelected(new Set(list)));
    setFilter('');
    setDirty(false);
  }, [visible]);

  const visibleApps = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return apps.filter((a) => {
      // A selected system app stays visible even with the system filter off,
      // or unticking something you previously allowed would mean hunting for
      // it behind a toggle.
      if (a.isSystem && !showSystem && !selected.has(a.packageName)) return false;
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q)
      );
    });
  }, [apps, filter, showSystem, selected]);

  const toggle = useCallback((pkg: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
    setDirty(true);
  }, []);

  const onSave = async () => {
    const saved = await saveAllowlist([...selected]);
    setDirty(false);
    onSaved(saved);
    onClose();
  };

  const onReset = async () => {
    const seed = await resetAllowlist();
    setSelected(new Set(seed));
    setDirty(true);
  };

  // Telephony and camera are permitted but tile-less; they are never offered
  // here and are re-added on save regardless.
  const countable = [...selected].filter(
    (p) => !KIOSK_HIDDEN_PACKAGES.includes(p)
  ).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Apps Jude can open</Text>
          <Text style={styles.subtitle}>
            {countable} allowed. Sideload with ADB first, then tick it here.
          </Text>
        </View>

        <TextInput
          style={styles.search}
          value={filter}
          onChangeText={setFilter}
          placeholder="Search apps"
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <Pressable style={styles.systemToggle} onPress={() => setShowSystem((s) => !s)}>
          <Ionicons
            name={showSystem ? 'checkbox' : 'square-outline'}
            size={20}
            color={showSystem ? Colors.primary : Colors.textMuted}
          />
          <Text style={styles.systemToggleText}>Show system apps</Text>
        </Pressable>

        <FlatList
          data={visibleApps}
          keyExtractor={(a) => a.packageName}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing matches.</Text>
          }
          renderItem={({ item }) => {
            const on = selected.has(item.packageName);
            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => toggle(item.packageName)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={on ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.rowPackage} numberOfLines={1}>
                    {item.packageName}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />

        <View style={styles.footer}>
          <TouchableOpacity onPress={onReset} style={[styles.btn, styles.ghostBtn]}>
            <Text style={styles.ghostBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.btn, styles.ghostBtn]}>
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSave}
            disabled={!dirty}
            style={[styles.btn, styles.primaryBtn, !dirty && styles.btnDisabled]}
          >
            <Text style={styles.primaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.sm,
    gap: Spacing.xxs,
  },
  title: {
    fontSize: Type.display.size,
    lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.weight,
    color: Colors.textMuted,
  },
  search: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    minHeight: Heights.input,
    fontSize: Type.body.size,
    color: Colors.textPrimary,
  },
  systemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  systemToggleText: {
    fontSize: Type.ui.size,
    lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: Heights.touchTarget,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowPressed: { backgroundColor: Colors.surfaceAlt },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: Type.cardTitle.size,
    lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight,
    color: Colors.textPrimary,
  },
  rowPackage: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.weight,
    color: Colors.textMuted,
  },
  empty: {
    fontSize: Type.body.size,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: 'center',
    minHeight: Heights.button,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: { borderWidth: 1, borderColor: Colors.border },
  ghostBtnText: {
    fontSize: Type.ui.size,
    fontWeight: Type.uiBold.weight,
    color: Colors.textPrimary,
  },
  primaryBtn: { backgroundColor: Colors.primary },
  primaryBtnText: {
    fontSize: Type.ui.size,
    fontWeight: Type.uiBold.weight,
    color: Colors.onPrimary,
  },
}); }
