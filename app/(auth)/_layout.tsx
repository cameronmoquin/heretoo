import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function AuthLayout() {
  const styles = makeStyles();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

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
