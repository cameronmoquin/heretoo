import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Transparent so root-layout wallpaper shows through.
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
