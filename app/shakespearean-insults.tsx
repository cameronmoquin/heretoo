/**
 * /shakespearean-insults. The insults room.
 *
 * One cross-platform screen on the house standard. The room renders on
 * web and phone from components/ShakespeareanInsults. The frame is the
 * shared ScreenHeader over the app's own canvas.
 */

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShakespeareanInsults } from '../components/ShakespeareanInsults';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { Colors } from '../constants/colors';
import { Spacing } from '../constants/design';

export default function ShakespeareanInsultsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScreenHeader showBack title="Shakespearean Insults" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ShakespeareanInsults />
      </ScrollView>
    </SafeAreaView>
  );
}
