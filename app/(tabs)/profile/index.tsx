import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import { showConfirm } from '../../../lib/alert';
import { Avatar } from '../../../components/shared/Avatar';
import { Button } from '../../../components/shared/Button';
import { TrustScoreRing } from '../../../components/profile/TrustScoreRing';
import { ClusterBadge } from '../../../components/profile/ClusterBadge';
import { OriginStory } from '../../../components/profile/OriginStory';
import { InviteSection } from '../../../components/profile/InviteSection';
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
        {/* Header */}
        <View style={styles.header}>
          <Avatar
            url={profile.avatar_url}
            name={profile.display_name}
            size={72}
            borderColor={Colors.primary}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.location_region && (
              <Text style={styles.location}>{profile.location_region}</Text>
            )}
          </View>
        </View>

        {/* Trust Score + Cluster */}
        <View style={styles.statsRow}>
          <TrustScoreRing score={profile.trust_score} />
          <ClusterBadge
            clusterId={profile.cluster_id}
            confidence={profile.cluster_confidence}
          />
        </View>

        {/* Origin Story */}
        {profile.origin_story && (
          <OriginStory story={profile.origin_story} />
        )}

        {/* Invite */}
        <InviteSection />

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Edit"
            onPress={() => {}}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    gap: 24,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
  },
  username: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  location: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
});
