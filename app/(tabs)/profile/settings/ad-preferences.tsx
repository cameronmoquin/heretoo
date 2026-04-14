import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAdPreferences } from '../../../../hooks/useAdPreferences';
import { AdCategoryPicker } from '../../../../components/shared/AdCategoryPicker';
import { Button } from '../../../../components/shared/Button';
import { showAlert } from '../../../../lib/alert';
import { Colors } from '../../../../constants/colors';
import { AD_FREE_BACKGROUNDS, MIN_AD_CATEGORIES } from '../../../../constants/adCategories';

export default function AdPreferencesScreen() {
  const {
    preferences,
    selectedCategoryIds: savedCategoryIds,
    selectedSubcategoryIds: savedSubcategoryIds,
    savePreferences,
    goAdFree,
  } = useAdPreferences();

  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [subcategories, setSubcategories] = useState<Set<string>>(new Set());

  // Initialize from saved
  useEffect(() => {
    setCategories(new Set(savedCategoryIds));
    setSubcategories(new Set(savedSubcategoryIds));
  }, [preferences]);

  function toggleCategory(id: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSubcategories((subs) => {
          const nextSubs = new Set(subs);
          for (const sub of subs) {
            if (sub.startsWith(id + '_')) nextSubs.delete(sub);
          }
          return nextSubs;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSubcategory(_catId: string, subId: string) {
    setSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }

  function handleSave() {
    if (categories.size < MIN_AD_CATEGORIES) {
      showAlert('Pick at least 3', `You have ${categories.size}. Pick ${MIN_AD_CATEGORIES - categories.size} more.`);
      return;
    }

    const prefs = [...categories].map((catId) => ({
      category_id: catId,
      subcategory_id: null as string | null,
    }));

    // Add subcategory-level prefs
    for (const subId of subcategories) {
      const catId = subId.split('_').slice(0, -1).join('_');
      prefs.push({ category_id: catId, subcategory_id: subId });
    }

    savePreferences.mutate(prefs, {
      onSuccess: () => {
        showAlert('Saved', 'Ad preferences updated.');
        router.back();
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Ad preferences</Text>
        <Text style={styles.subtitle}>
          Pick what you want to see. Change anytime.
        </Text>

        <AdCategoryPicker
          selectedCategories={categories}
          selectedSubcategories={subcategories}
          onToggleCategory={toggleCategory}
          onToggleSubcategory={toggleSubcategory}
        />

        <Button
          title="Save"
          onPress={handleSave}
          loading={savePreferences.isPending}
          disabled={categories.size < MIN_AD_CATEGORIES}
          size="lg"
          style={styles.saveButton}
        />

        {/* Ad-free option */}
        <View style={styles.adFreeSection}>
          <Text style={styles.adFreeTitle}>Go ad-free</Text>
          <Text style={styles.adFreeDesc}>
            Remove all ads. Pick a background to fill the space.
          </Text>

          <View style={styles.backgroundGrid}>
            {AD_FREE_BACKGROUNDS.map((bg) => (
              <TouchableOpacity
                key={bg.id}
                style={[
                  styles.backgroundOption,
                  { backgroundColor: bg.colors[0] },
                ]}
                onPress={() => {
                  goAdFree.mutate(bg.id, {
                    onSuccess: () => showAlert('Done', 'Ads removed.'),
                  });
                }}
              >
                <Text
                  style={[
                    styles.backgroundLabel,
                    bg.id === 'bg_midnight' && { color: '#FFFFFF' },
                  ]}
                >
                  {bg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingBottom: 100,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  saveButton: {
    width: '100%',
    marginTop: 8,
  },
  adFreeSection: {
    marginTop: 24,
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  adFreeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  adFreeDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  backgroundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  backgroundOption: {
    width: 80,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backgroundLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
