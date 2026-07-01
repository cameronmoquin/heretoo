/**
 * /shakespearean-insults — the themed insults module.
 *
 * A self-contained module, not a redesign. Its First-Folio theme is
 * scoped inside the component's `.bard-root`; the rest of HereToo is
 * visually unchanged.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShakespeareanInsults } from '../components/ShakespeareanInsults';

export default function ShakespeareanInsultsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ShakespeareanInsults />
      </ScrollView>
    </SafeAreaView>
  );
}
