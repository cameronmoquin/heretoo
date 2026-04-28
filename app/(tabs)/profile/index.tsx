import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { showConfirm } from '../../../lib/alert';
import { Avatar } from '../../../components/shared/Avatar';
import { Button } from '../../../components/shared/Button';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { Colors } from '../../../constants/colors';

export default function OwnProfileScreen() {
  const { profile, signOut } = useAuth();

  const handleSignOut = () => {
    showConfirm('Sign out', 'Are you sure?', signOut, 'Sign out');
  };

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Avatar
            url={profile.avatar_path ? mediaPathToUrl(profile.avatar_path) : null}
            name={profile.display_name}
            size={72}
            borderColor={Colors.primary}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.displayName}>{profile.display_name ?? 'Member'}</Text>
            <Text style={styles.username}>@{profile.handle}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Edit"
            onPress={() => router.push('/(tabs)/profile/settings')}
            variant="outline"
            style={{ flex: 1 }}
          />
          <Button
            title="Sign out"
            onPress={handleSignOut}
            variant="ghost"
            textStyle={{ color: Colors.error }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 24, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerInfo: { flex: 1, gap: 2 },
  displayName: { fontWeight: '800', fontSize: 18, color: Colors.textPrimary },
  username: { fontSize: 15, color: Colors.textMuted },
  bio: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
