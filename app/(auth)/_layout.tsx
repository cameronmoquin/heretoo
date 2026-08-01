import { useEffect } from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/design';

export default function AuthLayout() {
  const styles = makeStyles();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Tell the global wallpaper CSS to back off — we center ourselves
  // (the 480px card flexed inside a flex-center root). Without this,
  // the global #root > div:first-child > div max-width: 720px rule
  // boxed the auth root and broke its own centering.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.setAttribute('data-auth-layout', 'on');
    return () => { document.body.removeAttribute('data-auth-layout'); };
  }, []);

  return (
    <View style={[styles.root, isDesktop && styles.rootDesktop]}>
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  // Web: fixed-position full-viewport overlay. By escaping the React
  // tree's DOM stacking entirely, the auth screen ignores any
  // sidebar padding, max-width clamps, or margin-auto rules the
  // global wallpaper CSS injects. The child centers in the real
  // viewport, period.
  root: ({
    flex: 1,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 1,
    } : {}),
  } as any),
  rootDesktop: {
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 480,
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
}); }
