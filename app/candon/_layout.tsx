import { Stack } from 'expo-router';
import { CandonColors } from '../../constants/candon-theme';

export default function CandonLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: CandonColors.surface },
        headerTintColor: CandonColors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: CandonColors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Candon' }} />
      <Stack.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Stack.Screen name="contacts/new" options={{ title: 'New Contact' }} />
      <Stack.Screen name="contacts/[id]" options={{ title: 'Contact' }} />
      <Stack.Screen name="family" options={{ title: 'Family' }} />
      <Stack.Screen name="family/new" options={{ title: 'New Family Group' }} />
      <Stack.Screen name="family/join" options={{ title: 'Join Family' }} />
      <Stack.Screen name="family/[id]" options={{ title: 'Family Group' }} />
    </Stack>
  );
}
