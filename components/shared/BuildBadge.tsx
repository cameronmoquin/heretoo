import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { BuildInfo } from '../../constants/build-info';

/**
 * Tiny fixed-position badge that shows the current deployed build.
 * Tap to go to /version for full details.
 * Only visible when explicitly enabled (not in dev).
 */
export function BuildBadge() {
  const styles = makeStyles();
  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={() => router.push('/version')}
      activeOpacity={0.6}
    >
      <Text style={styles.text}>
        {BuildInfo.commit}{BuildInfo.dirty ? '·dirty' : ''}
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9999,
  },
  text: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#8CF',
    letterSpacing: 0.5,
  },
}); }
