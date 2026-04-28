/**
 * Web stub for TwoWayCapture.
 *
 * Two-Way is a mobile-only experience (simultaneous front+back capture
 * isn't reliable in browsers, and react-native-vision-camera is a native
 * module that crashes the web bundle if imported). Metro's platform-
 * specific resolution picks this `.web.tsx` file when targeting web,
 * keeping vision-camera out of the web bundle entirely.
 *
 * The real implementation lives in TwoWayCapture.tsx (and is loaded on
 * iOS/Android only).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export interface CapturedAsset {
  uri: string;
  width: number;
  height: number;
  type: 'image';
  mimeType: 'image/jpeg';
  fileSize?: number;
}

interface Props {
  onCapture: (asset: CapturedAsset) => void;
  onClose: () => void;
}

// onCapture is intentionally unused in the web stub — Two-Way needs the
// mobile app to actually capture. We expose the same prop shape so the
// caller code is unchanged across platforms.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TwoWayCapture({ onCapture: _onCapture, onClose }: Props) {
  const s = makeStyles();
  return (
    <View style={s.notSupported}>
      <Ionicons name="phone-portrait-outline" size={32} color={Colors.textMuted} />
      <Text style={s.notSupportedTitle}>Two-Way is mobile only</Text>
      <Text style={s.notSupportedText}>
        Open HereToo on your phone to capture front + back together.
      </Text>
      <TouchableOpacity style={s.closeBtn} onPress={onClose}>
        <Text style={s.closeBtnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  notSupported: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', padding: 32, gap: 12,
  },
  notSupportedTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 8 },
  notSupportedText: { color: '#999', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
  closeBtn: {
    marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: '#FFF',
  },
  closeBtnText: { color: '#000', fontWeight: '600' },
}); }
