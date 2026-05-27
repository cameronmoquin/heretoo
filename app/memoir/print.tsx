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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

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
    bestFor: 'Sending a copy to every grandchild without paying upfront.',
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
  const { elder } = reading;
  const s = makeStyles(elder);
  const ic = elder
    ? { chrome: Colors.brandIvory, secondary: Colors.textSecondary }
    : { chrome: Colors.textPrimary, secondary: Colors.textSecondary };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome} />
          </TouchableOpacity>
          <Text style={s.kicker}>Where to print</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.page}>
          <Text style={s.lede}>
            The PDF you just rendered is a standard 6×9 book file with bleed
            and embedded fonts. Every printer below will accept it. Pick the
            one that fits how you want to give the book away.
          </Text>

          {CATEGORY_ORDER.map((cat) => {
            const items = OPTIONS.filter((o) => o.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat} style={s.section}>
                <Text style={s.sectionTitle}>{CATEGORY_LABEL[cat]}</Text>
                {items.map((o) => <OptionCard key={o.name} option={o} elder={elder} />)}
              </View>
            );
          })}

          <Text style={s.footnote}>
            None of these companies pay HereToo. The list is here so the
            choice is yours, not ours.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionCard({ option, elder }: { option: PrintOption; elder: boolean }) {
  const s = makeStyles(elder);
  const accent = elder ? '#8A5B1A' : Colors.primary;
  const open = () => { if (option.url) Linking.openURL(option.url); };
  return (
    <View style={s.card}>
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
        <TouchableOpacity onPress={open} style={s.cardLink} activeOpacity={0.85}>
          <Ionicons name="open-outline" size={14} color={accent} />
          <Text style={s.cardLinkText}>Open {hostnameOf(option.url)} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function makeStyles(elder: boolean) {
  const chromeText = Colors.brandIvory;
  const chromeBorder = Colors.border;
  const chromeSecondary = Colors.textSecondary;

  const pageCardBg = elder ? '#F2E8CC' : 'transparent';
  const pageInk = elder ? '#2A1F18' : Colors.textPrimary;
  const pageInkSecondary = elder ? '#5A4A38' : Colors.textSecondary;
  const pageInkMuted = elder ? '#8C7E60' : Colors.textMuted;
  const pageAccent = elder ? '#8A5B1A' : Colors.primary;
  const pageBorder = elder ? '#CFC0A0' : Colors.border;
  const pageSurface = elder ? '#FBF4DE' : Colors.surface;

  const pageCardWeb = (elder && Platform.OS === 'web') ? ({
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
    boxShadow:
      '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
  } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 760, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: chromeBorder,
    },
    aaText: { fontSize: 14, fontWeight: '700', color: chromeSecondary },

    page: elder ? {
      marginTop: 24, padding: 32, borderRadius: 14,
      backgroundColor: pageCardBg, borderWidth: 1, borderColor: pageBorder,
      gap: Spacing.lg, ...pageCardWeb,
    } : { gap: Spacing.lg, marginTop: 8 },

    lede: {
      fontSize: 17, lineHeight: 28, color: pageInk, fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    section: { gap: 10 },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: pageAccent,
      letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 8,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },

    card: {
      padding: Spacing.md, gap: 8,
      borderRadius: Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
    },
    cardHead: {
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
    },
    cardName: {
      fontSize: 18, fontWeight: '800', color: pageInk, letterSpacing: -0.2,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    cardCost: { fontSize: 13, color: pageInkMuted, fontStyle: 'italic' },
    cardTagline: {
      fontSize: 15, lineHeight: 22, color: pageInk, fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    cardBestFor: {
      fontSize: 14, lineHeight: 22, color: pageInkSecondary,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    cardBestForLabel: { fontWeight: '700', color: pageAccent },
    cardHow: {
      fontSize: 14, lineHeight: 22, color: pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    cardLink: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 6,
      alignSelf: 'flex-start',
    },
    cardLinkText: { fontSize: 13, fontWeight: '700', color: pageAccent },

    footnote: {
      fontSize: 13, lineHeight: 22, color: pageInkMuted,
      fontStyle: 'italic', textAlign: 'center', marginTop: 8,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
  });
}
