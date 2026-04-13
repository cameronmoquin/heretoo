import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors } from '../../constants/colors';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
}

/**
 * Centers content with a max-width on desktop.
 * On mobile, fills the screen. On desktop, constrains to a readable column.
 */
export function ResponsiveContainer({
  children,
  maxWidth = 600,
}: ResponsiveContainerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={[styles.outer, isDesktop && styles.outerDesktop]}>
      <View
        style={[
          styles.inner,
          isDesktop && { maxWidth, width: '100%' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Hook to get responsive breakpoint info.
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    isMobile: width <= 768,
    isTablet: width > 768 && width <= 1024,
    isDesktop: width > 1024,
    width,
  };
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  outerDesktop: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  inner: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
