import { useEffect } from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';

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
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
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
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
}); }
