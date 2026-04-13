import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { FONT_SCALE_OPTIONS } from '../../../../hooks/useScaledFont';
import { Colors } from '../../../../constants/colors';

export default function SettingsScreen() {
  const { fontScale, setFontScale } = useSettingsStore();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Font size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text size</Text>
          <View style={styles.scaleOptions}>
            {FONT_SCALE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.scaleOption,
                  fontScale === opt.value && styles.scaleOptionActive,
                ]}
                onPress={() => setFontScale(opt.value)}
              >
                <Text
                  style={[
                    styles.scalePreview,
                    { fontSize: 16 * opt.value },
                    fontScale === opt.value && styles.scalePreviewActive,
                  ]}
                >
                  Aa
                </Text>
                <Text
                  style={[
                    styles.scaleLabel,
                    fontScale === opt.value && styles.scaleLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ad preferences */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/profile/settings/ad-preferences')}
        >
          <Text style={styles.menuItemText}>Ad preferences</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scaleOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  scaleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  scaleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  scalePreview: {
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scalePreviewActive: {
    color: Colors.primary,
  },
  scaleLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  scaleLabelActive: {
    color: Colors.primary,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  menuArrow: {
    fontSize: 20,
    color: Colors.textMuted,
  },
});
