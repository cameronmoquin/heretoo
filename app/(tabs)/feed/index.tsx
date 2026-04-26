import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFeed, useToggleEngagement } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { useFeedFormatStore, FEED_FORMATS, type FeedFormat } from '../../../stores/feedFormatStore';
import { useFamilyGroups } from '../../../hooks/useFamilyGroups';
import { FeedList } from '../../../components/feed/FeedList';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'bridging', label: 'Bridging' },
];

export default function FeedScreen() {
  const { activeTab, setActiveTab } = useFeedStore();
  const { format, setFormat } = useFeedFormatStore();
  const feed = useFeed(activeTab);
  const toggleEngagement = useToggleEngagement();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const posts = feed.data?.pages.flat() ?? [];
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);

  const currentFormat = FEED_FORMATS.find((f) => f.id === format);
  const { data: families } = useFamilyGroups();
  const familyCount = families?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={isDesktop ? [] : ['top']}>
      {!isDesktop && (
        <View style={styles.header}>
          <View style={{ position: 'relative' }}>
            <Text style={[styles.logo, { color: '#FF0040', position: 'absolute', left: -1, top: -1, opacity: 0.6 }]}>HT</Text>
            <Text style={[styles.logo, { color: '#00FF88', position: 'absolute', left: 1, top: 1, opacity: 0.6 }]}>HT</Text>
            <Text style={styles.logo}>HT</Text>
          </View>
          <TouchableOpacity style={styles.formatBtn} onPress={() => setFormatPickerOpen(true)}>
            <Text style={styles.formatBtnText}>{currentFormat?.label ?? 'View'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDesktop && (
        <View style={styles.desktopFormatRow}>
          <TouchableOpacity style={styles.formatBtn} onPress={() => setFormatPickerOpen(true)}>
            <Text style={styles.formatBtnText}>{currentFormat?.label ?? 'View'} ▾</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Family Group banner — links to private family bulletin board */}
      <TouchableOpacity
        style={styles.familyBanner}
        onPress={() => router.push(familyCount > 0 ? '/candon/family' : '/candon')}
        activeOpacity={0.8}
      >
        <View style={styles.familyBannerIcon}>
          <Ionicons name="home" size={18} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.familyBannerTitle}>Family Group</Text>
          <Text style={styles.familyBannerSub}>
            {familyCount === 0
              ? 'Set up a private circle for the people closest to you'
              : familyCount === 1
                ? 'Open your family bulletin board'
                : `${familyCount} family circles`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {active && <View style={styles.tabBar} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <FeedList
        posts={posts}
        isLoading={feed.isLoading}
        isRefreshing={feed.isRefetching}
        hasMore={feed.hasNextPage ?? false}
        onRefresh={() => feed.refetch()}
        onLoadMore={() => feed.fetchNextPage()}
        onEngage={(postId, type) => toggleEngagement.mutate({ postId, type })}
      />

      {/* Format Picker Modal */}
      <Modal visible={formatPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormatPickerOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose your view</Text>
            <TouchableOpacity onPress={() => setFormatPickerOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>Same content. Your preferred format.</Text>
          <ScrollView contentContainerStyle={styles.formatList}>
            {FEED_FORMATS.map((f) => {
              const active = format === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.formatOption, active && styles.formatOptionActive]}
                  onPress={() => { setFormat(f.id); setFormatPickerOpen(false); }}
                >
                  <Text style={[styles.formatLabel, active && styles.formatLabelActive]}>{f.label}</Text>
                  <Text style={styles.formatDesc}>{f.description}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  logo: { fontWeight: '800', fontSize: 22, letterSpacing: -0.5 },
  formatBtn: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  formatBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  desktopFormatRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  familyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: Spacing.md, marginVertical: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  familyBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4A6B4A',
    alignItems: 'center', justifyContent: 'center',
  },
  familyBannerTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  familyBannerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  tabBar: { position: 'absolute', bottom: 0, width: 26, height: 2, borderRadius: 1, backgroundColor: Colors.primary },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.background, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  modalClose: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  modalSub: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 20, marginBottom: 20 },
  formatList: { paddingHorizontal: 20, gap: 8 },
  formatOption: {
    padding: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  formatOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  formatLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  formatLabelActive: { color: Colors.primary },
  formatDesc: { fontSize: 13, color: Colors.textSecondary },
});
