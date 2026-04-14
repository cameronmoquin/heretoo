import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { assignInitialCluster } from '../../lib/clusters';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { AdCategoryPicker } from '../../components/shared/AdCategoryPicker';
import { Colors } from '../../constants/colors';
import { INTEREST_TOPICS, type InterestTopic } from '../../constants/clusters';

type Step = 'name' | 'age' | 'location' | 'interests' | 'ads' | 'story';

export default function ProfileSetupScreen() {
  const { createProfile } = useAuth();
  const [step, setStep] = useState<Step>('name');
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<InterestTopic[]>([]);
  const [adCategories, setAdCategories] = useState<Set<string>>(new Set());
  const [adSubcategories, setAdSubcategories] = useState<Set<string>>(new Set());
  const [originStory, setOriginStory] = useState('');

  const steps: Step[] = ['name', 'age', 'location', 'interests', 'ads', 'story'];
  const stepIndex = steps.indexOf(step);

  function nextStep() {
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1]);
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1]);
    }
  }

  function toggleInterest(topic: InterestTopic) {
    setSelectedInterests((prev) => {
      if (prev.includes(topic)) return prev.filter((t) => t !== topic);
      if (prev.length >= 3) return prev;
      return [...prev, topic];
    });
  }

  function toggleAdCategory(categoryId: string) {
    setAdCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
        // Also remove subcategories
        setAdSubcategories((subs) => {
          const nextSubs = new Set(subs);
          for (const sub of subs) {
            if (sub.startsWith(categoryId + '_')) nextSubs.delete(sub);
          }
          return nextSubs;
        });
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function toggleAdSubcategory(_categoryId: string, subcategoryId: string) {
    setAdSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  }

  async function handleComplete() {
    if (!displayName.trim() || !username.trim() || !birthYear) {
      showAlert('Missing info', 'Please fill in your name, username, and birth year.');
      return;
    }

    setLoading(true);
    try {
      const { clusterId, confidence } = assignInitialCluster(selectedInterests);

      await createProfile({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        birth_year: parseInt(birthYear, 10),
        location_region: locationRegion.trim(),
        cluster_id: clusterId,
        cluster_confidence: confidence,
        origin_story: originStory.trim() || undefined,
      });

      router.replace('/(tabs)/feed');
    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress indicator */}
          <View style={styles.progress}>
            {steps.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  i <= stepIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {step === 'name' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Who are you?</Text>
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor={Colors.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                placeholder="Username (lowercase, no spaces)"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={nextStep}
              />
              <Button
                title="Next"
                onPress={nextStep}
                disabled={!displayName.trim() || !username.trim()}
              />
            </View>
          )}

          {step === 'age' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>What year?</Text>
              <Text style={styles.stepSubtitle}>
                For generational matching. Never shown.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Birth year (e.g. 1992)"
                placeholderTextColor={Colors.textMuted}
                value={birthYear}
                onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="go"
                onSubmitEditing={nextStep}
              />
              <View style={styles.navButtons}>
                <Button title="Back" onPress={prevStep} variant="ghost" size="sm" />
                <Button title="Next" onPress={nextStep} disabled={birthYear.length !== 4} />
              </View>
            </View>
          )}

          {step === 'location' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Where are you?</Text>
              <Text style={styles.stepSubtitle}>
                State or region. Helps find local topics.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. California, Texas, Ontario"
                placeholderTextColor={Colors.textMuted}
                value={locationRegion}
                onChangeText={setLocationRegion}
                returnKeyType="go"
                onSubmitEditing={nextStep}
              />
              <View style={styles.navButtons}>
                <Button title="Back" onPress={prevStep} variant="ghost" size="sm" />
                <Button title="Next" onPress={nextStep} />
              </View>
            </View>
          )}

          {step === 'interests' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Pick 3.</Text>
              <Text style={styles.stepSubtitle}>
                Your real community emerges from how you vote.
              </Text>
              <View style={styles.interestGrid}>
                {INTEREST_TOPICS.map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    style={[
                      styles.interestChip,
                      selectedInterests.includes(topic) && styles.interestChipActive,
                    ]}
                    onPress={() => toggleInterest(topic)}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        selectedInterests.includes(topic) && styles.interestChipTextActive,
                      ]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.navButtons}>
                <Button title="Back" onPress={prevStep} variant="ghost" size="sm" />
                <Button
                  title="Next"
                  onPress={nextStep}
                  disabled={selectedInterests.length < 3}
                />
              </View>
            </View>
          )}

          {step === 'ads' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>What do you want to see?</Text>
              <Text style={styles.stepSubtitle}>
                Ads keep HereToo free. Pick at least 3 categories so they are relevant to you. Change anytime.
              </Text>
              <AdCategoryPicker
                selectedCategories={adCategories}
                selectedSubcategories={adSubcategories}
                onToggleCategory={toggleAdCategory}
                onToggleSubcategory={toggleAdSubcategory}
              />
              <View style={styles.navButtons}>
                <Button title="Back" onPress={prevStep} variant="ghost" size="sm" />
                <Button
                  title="Next"
                  onPress={nextStep}
                  disabled={adCategories.size < 3}
                />
              </View>
            </View>
          )}

          {step === 'story' && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Origin story</Text>
              <Text style={styles.stepSubtitle}>
                Where do you come from? What shaped you? You do not have to explain your politics. Just be real.
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="I grew up in a small town where..."
                placeholderTextColor={Colors.textMuted}
                value={originStory}
                onChangeText={setOriginStory}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={handleComplete}
              />
              <View style={styles.navButtons}>
                <Button title="Back" onPress={prevStep} variant="ghost" size="sm" />
                <Button
                  title="Show up"
                  onPress={handleComplete}
                  loading={loading}
                  size="lg"
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  progress: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceLight,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  stepContainer: {
    flex: 1,
    gap: 16,
  },
  stepTitle: {
    fontWeight: '800',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  interestChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  interestChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  interestChipTextActive: {
    color: Colors.brandDark,
    fontWeight: '600',
  },
});
