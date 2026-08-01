/**
 * ConfirmSheet — single-tap-to-confirm replacement for window.confirm.
 *
 * The native browser confirm dialog forces "<domain> says" branding and
 * a two-step modal flow that feels like a stop sign. This is a centered
 * card with a clearly-destructive primary button and a Cancel ghost.
 *
 * Used as a singleton, like Toast: anywhere in the tree calls
 * `confirm({ title, message, confirmLabel, destructive, onConfirm })`,
 * which mounts the sheet on the next render. Tapping the destructive
 * button immediately invokes onConfirm and closes — single tap to
 * commit, not two.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

let _open: ((req: ConfirmRequest) => void) | null = null;

export function confirm(req: ConfirmRequest) {
  if (!_open) {
    // Host hasn't mounted yet — fall back to immediate confirm so we
    // don't silently drop the user's intent.
    req.onConfirm();
    return;
  }
  _open(req);
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  const styles = makeStyles();

  useEffect(() => {
    _open = setReq;
    return () => { _open = null; };
  }, []);

  if (!req) return null;

  const close = () => setReq(null);
  const onConfirm = () => { close(); req.onConfirm(); };
  const onCancel = () => { close(); req.onCancel?.(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{req.title}</Text>
          {!!req.message && <Text style={styles.message}>{req.message}</Text>}
          <View style={styles.row}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.cancelBtn]}>
              <Text style={styles.cancelBtnText}>{req.cancelLabel ?? 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.btn, req.destructive ? styles.destructiveBtn : styles.confirmBtn]}
            >
              <Text style={req.destructive ? styles.destructiveBtnText : styles.confirmBtnText}>
                {req.confirmLabel ?? 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles() { return StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    width: '100%', maxWidth: 420,
    padding: 22, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  confirmBtn: { backgroundColor: Colors.primary },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  destructiveBtn: { backgroundColor: Colors.error },
  destructiveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
}); }
