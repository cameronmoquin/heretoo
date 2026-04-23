import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useContacts } from '../../hooks/useContacts';
import { useFamilyGroups } from '../../hooks/useFamilyGroups';
import { CandonColors } from '../../constants/candon-theme';

export default function CandonHome() {
  const profile = useAuthStore((s) => s.profile);
  const { data: contacts } = useContacts();
  const { data: families } = useFamilyGroups();

  const name = profile?.display_name?.split(' ')[0] ?? 'there';
  const contactCount = contacts?.length ?? 0;
  const familyCount = families?.length ?? 0;

  const Card = ({
    icon, title, subtitle, onPress,
  }: { icon: any; title: string; subtitle: string; onPress: () => void }) => (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardIcon}>
        <Ionicons name={icon} size={22} color={CandonColors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={CandonColors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.hello}>Hello, {name}.</Text>
        <Text style={s.sub}>Stay in touch with the people who matter.</Text>

        <Card
          icon="people-outline"
          title="Contacts"
          subtitle={contactCount === 0 ? 'No contacts yet' : `${contactCount} ${contactCount === 1 ? 'person' : 'people'}`}
          onPress={() => router.push('/candon/contacts')}
        />

        <Card
          icon="home-outline"
          title="Family Groups"
          subtitle={familyCount === 0 ? 'No families yet' : `${familyCount} ${familyCount === 1 ? 'group' : 'groups'}`}
          onPress={() => router.push('/candon/family')}
        />

        <View style={s.placeholder}>
          <Text style={s.placeholderText}>
            Daily queue, content reservoir, and bulletin workflows coming in Phase 2.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 12, maxWidth: 600, alignSelf: 'center', width: '100%' },
  hello: { fontSize: 24, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 8 },
  sub: { fontSize: 15, color: CandonColors.textSecondary, marginBottom: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: CandonColors.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary },
  cardSubtitle: { fontSize: 13, color: CandonColors.textSecondary, marginTop: 2 },
  placeholder: {
    marginTop: 24, padding: 16, borderRadius: 10,
    backgroundColor: CandonColors.surfaceRaise,
    borderWidth: 1, borderColor: CandonColors.borderLight,
  },
  placeholderText: { fontSize: 13, color: CandonColors.textMuted, textAlign: 'center' },
});
