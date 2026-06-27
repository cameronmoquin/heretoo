/**
 * HuntMap (native) — placeholder.
 *
 * Leaflet is a DOM library, so the map renders on web (HuntMap.web.tsx).
 * Native GPS hunting uses the compass/distance flow without a tile map
 * for now; a native map (react-native-maps or a WebView) lands later.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import type { HuntMapProps } from './HuntMap.types';

export function HuntMap({ height = 320 }: HuntMapProps) {
  const s = makeStyles(height);
  return (
    <View style={s.wrap}>
      <Text style={s.text}>The map view opens on the web app for now.</Text>
    </View>
  );
}

function makeStyles(height: number) {
  return StyleSheet.create({
    wrap: {
      height, width: '100%', borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', padding: 16,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    text: {
      color: Colors.textSecondary, fontSize: 13, textAlign: 'center',
      ...(Platform.OS === 'web' ? ({ fontFamily: 'Inter, sans-serif' } as any) : {}),
    },
  });
}
