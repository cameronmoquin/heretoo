/**
 * ShakespeareanInsults (native stub). The module's period theme is
 * CSS-scoped and web-only; the web variant lives in
 * ShakespeareanInsults.web.tsx. Native gets a pointer.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/colors';

export function ShakespeareanInsults() {
  const styles = makeStyles();
  return (
    <View style={styles.wrap}>
      <Text style={styles.t}>The playhouse opens on the web app.</Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  t: {
    color: Colors.textSecondary, fontSize: 15, textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ fontFamily: 'Georgia, serif' } as any) : {}),
  },
}); }
