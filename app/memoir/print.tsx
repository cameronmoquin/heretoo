/**
 * /memoir/print — where to print the book.
 *
 * The interior PDF the render worker produces is a standard 6×9
 * paperback file with bleed and embedded fonts. Every printer in
 * this list will accept it. The book is yours; this page just lays
 * out the trade-offs and lets you choose.
 *
 * Editorial stance: no favouritism. KDP is the easiest path for most
 * people *and* the easiest to advertise, but a local print shop is
 * often better if you want a single copy in hand by tomorrow. Listed
 * roughly cheapest-to-most-expensive within each category.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { Colors } from '../../constants/colors';
import { Spacing, Type, FontFamily } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { RailCard } from '../../components/shared/RailCard';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

interface PrintOption {
  name: string;
  category: 'print-on-demand' | 'local' | 'specialty';
  tagline: string;
  approxCost: string;
  bestFor: string;
  how: string;
  url?: string;
}

const OPTIONS: PrintOption[] = [
  // ── Print-on-demand (online, ships to you) ───────────────────────
  {
    name: 'Amazon KDP',
    category: 'print-on-demand',
    tagline: 'The default for most people. Cheap, fast, no setup fees.',
    approxCost: '$4–$8 per copy, plus shipping',
    bestFor: 'Sending copies to everyone without paying upfront.',
    how: 'Make a free KDP account, click "Paperback," upload the interior PDF and cover, pick the trim size (6×9). Order a proof first — about $4. Once you approve it, family can order copies directly from the book\'s Amazon page.',
    url: 'https://kdp.amazon.com/',
  },
  {
    name: 'IngramSpark',
    category: 'print-on-demand',
    tagline: 'Bookstore-quality, distributes to libraries too.',
    approxCost: '$4–$9 per copy, $49 one-time setup',
    bestFor: 'Anyone who wants the book in actual bookstores or libraries.',
    how: 'Create an account, upload the interior + cover. Slightly stricter file specs than KDP — the worker\'s PDF is compatible. Setup fee is occasionally waived.',
    url: 'https://www.ingramspark.com/',
  },
  {
    name: 'Lulu',
    category: 'print-on-demand',
    tagline: 'Photo-friendly. Better paper than KDP for family-album-style books.',
    approxCost: '$6–$15 per copy',
    bestFor: 'Books with lots of scanned photographs where colour matters.',
    how: 'Free account, upload interior + cover, choose paper (cream / white / premium).',
    url: 'https://www.lulu.com/',
  },
  {
    name: 'Blurb',
    category: 'specialty',
    tagline: 'Premium photo-book quality, hardcover available.',
    approxCost: '$15–$60 per copy',
    bestFor: 'A single beautiful keepsake — Mom\'s memoir as a hardcover gift.',
    how: 'Use the BookWright or web editor; or import the worker\'s PDF directly. Hardcover binding adds a real heirloom feel.',
    url: 'https://www.blurb.com/',
  },

  // ── Local print shops (walk-in) ──────────────────────────────────
  {
    name: 'FedEx Office',
    category: 'local',
    tagline: 'Walk in with the PDF on a thumb drive, walk out with a book.',
    approxCost: '$15–$40 per copy, depending on page count',
    bestFor: 'Holding a finished copy by tomorrow.',
    how: 'Take the interior PDF (and cover if you want a printed cover, or have them use cardstock). Ask for "perfect binding" — that\'s the paperback glue spine. Some locations also do spiral binding.',
    url: 'https://www.office.fedex.com/',
  },
  {
    name: 'Staples',
    category: 'local',
    tagline: 'Same as FedEx — drop a PDF, get a book printed.',
    approxCost: '$15–$45 per copy',
    bestFor: 'A local option if there\'s no FedEx Office nearby.',
    how: 'Upload via their print online portal or hand them a thumb drive. Ask for perfect binding for the paperback look.',
    url: 'https://www.staples.com/services/printing/',
  },
  {
    name: 'A local print shop',
    category: 'local',
    tagline: 'A small shop near you. Often the warmest experience.',
    approxCost: 'Varies, often comparable to FedEx',
    bestFor: 'Supporting the actual humans in your town, and getting a person\'s eye on the final result.',
    how: 'Search for "book printer near me" or call any print shop and ask if they do perfect-bound paperbacks from PDFs. Most do. Bring the interior PDF and the cover PDF.',
  },
];

const CATEGORY_LABEL: Record<PrintOption['category'], string> = {
  'print-on-demand': 'Print on demand · ships to you',
  'local': 'Local — pick it up tomorrow',
  'specialty': 'Specialty / premium',
};
const CATEGORY_ORDER: PrintOption['category'][] = ['print-on-demand', 'local', 'specialty'];

export default function MemoirPrintScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Where to print"
        showBack
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.page}>
          {CATEGORY_ORDER.map((cat) => {
            const items = OPTIONS.filter((o) => o.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat} style={s.section}>
                <Eyebrow accentColor={Colors.primary}>{CATEGORY_LABEL[cat]}</Eyebrow>
                {items.map((o) => <OptionCard key={o.name} option={o} scale={scale} />)}
              </View>
            );
          })}

          <Text style={s.footnote}>
            None of these companies pay HereToo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionCard({ option, scale }: { option: PrintOption; scale: number }) {
  const s = makeStyles(scale);
  const open = () => { if (option.url) Linking.openURL(option.url); };
  return (
    <RailCard>
      <View style={s.cardHead}>
        <Text style={s.cardName}>{option.name}</Text>
        <Text style={s.cardCost}>{option.approxCost}</Text>
      </View>
      <Text style={s.cardTagline}>{option.tagline}</Text>
      <Text style={s.cardBestFor}>
        <Text style={s.cardBestForLabel}>Best for: </Text>
        {option.bestFor}
      </Text>
      <Text style={s.cardHow}>{option.how}</Text>
      {option.url && (
        <TouchableOpacity onPress={open} style={s.cardLink} activeOpacity={0.85} accessibilityLabel={`Open ${hostnameOf(option.url)}`}>
          <Ionicons name="open-outline" size={14} color={Colors.primary} />
          <Text style={s.cardLinkText}>Open {hostnameOf(option.url)} →</Text>
        </TouchableOpacity>
      )}
    </RailCard>
  );
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 760, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm, gap: Spacing.lg },

    page: { gap: Spacing.lg, marginTop: Spacing.xs },

    section: { gap: 10 },

    cardHead: {
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
    },
    cardName: {
      fontSize: fs(Type.cardTitle.size), lineHeight: fs(Type.cardTitle.lineHeight), fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.2,
      ...displayFont,
    },
    cardCost: { fontSize: fs(Type.caption.size), color: Colors.textMuted, fontStyle: 'italic' },
    cardTagline: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 3), color: Colors.textPrimary, fontStyle: 'italic',
      ...bodyFont,
    },
    cardBestFor: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 3), color: Colors.textSecondary,
      ...bodyFont,
    },
    cardBestForLabel: { fontWeight: '700', color: Colors.primary },
    cardHow: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 3), color: Colors.textPrimary,
      ...bodyFont,
    },
    cardLink: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6,
      alignSelf: 'flex-start',
    },
    cardLinkText: { fontSize: fs(Type.caption.size), fontWeight: '700', color: Colors.primary },

    footnote: {
      fontSize: fs(Type.caption.size), lineHeight: fs(Type.caption.lineHeight + 6), color: Colors.textMuted,
      fontStyle: 'italic', textAlign: 'center', marginTop: 8,
      ...bodyFont,
    },
  });
}
