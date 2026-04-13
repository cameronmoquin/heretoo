import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Avatar } from '../../../components/shared/Avatar';
import { TrustScoreRing } from '../../../components/profile/TrustScoreRing';
import { ClusterBadge } from '../../../components/profile/ClusterBadge';
import { OriginStory } from '../../../components/profile/OriginStory';
import { Colors } from '../../../constants/colors';
import type { Profile } from '../../../stores/authStore';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Avatar
            url={profile.avatar_url}
            name={profile.display_name}
            size={72}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.location_region && (
              <Text style={styles.location}>{profile.location_region}</Text>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <TrustScoreRing score={profile.trust_score} />
          <ClusterBadge
            clusterId={profile.cluster_id}
            confidence={profile.cluster_confidence}
          />
        </View>

        {profile.origin_story && (
          <OriginStory story={profile.origin_story} />
        )}
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
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
});
