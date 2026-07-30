/**
 * ShakespeareanInsults. One cross-platform room.
 *
 * Was a web-only DOM widget. Was a dead native stub. Now one RN screen
 * on the house standard. Runs on web and phone from this file.
 *
 * The engine and the data stay put. Only the container changes. Forge a
 * line. Summon a true one. Set the meter. Content is data-driven via
 * lib/insultEngine reading data/bard-insults.json. Nothing generated.
 *
 * Cards are the house RailCard. Selectors are the house Chip. Actions are
 * the house Button. Color routes through Colors, size through Type, gaps
 * through Spacing, fonts through Gen. The First Folio serif reading voice
 * returns on the Boomer skin through Gen.bodyFont. No webfont fetch.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import {
  insultEngine, tierMeta,
  type Tier, type Meter, type Ending, type ForgeResult, type TrueLine,
} from '../lib/insultEngine';
import { Colors } from '../constants/colors';
import { Spacing, Type } from '../constants/design';
import { Gen } from '../constants/generations';
import { RailCard } from './shared/RailCard';
import { Chip } from './shared/Chip';
import { Button } from './shared/Button';

const TIERS: Tier[] = ['safe', 'edgy', 'full'];

const METERS: { value: Meter; label: string }[] = [
  { value: 'any', label: 'Off' },
  { value: 'iambicPentameter', label: 'Iambic pentameter' },
  { value: 'trochaicTetrameter', label: 'Trochaic tetrameter' },
];

const ENDINGS: { value: Ending; label: string }[] = [
  { value: 'masculine', label: 'Masculine' },
  { value: 'feminine', label: 'Feminine' },
];

export function ShakespeareanInsults() {
  const s = makeStyles();

  const [tier, setTier] = useState<Tier>('safe');
  const [meter, setMeter] = useState<Meter>('any');
  const [ending, setEnding] = useState<Ending>('masculine');
  const [strict, setStrict] = useState(false);

  const [forgeRes, setForgeRes] = useState<ForgeResult | null>(null);
  const [line, setLine] = useState<TrueLine | null>(null);
  const [cascade, setCascade] = useState<ForgeResult | null>(null);

  // Display only. Never in any pool.
  const epi = useMemo(() => insultEngine.epigraph(), []);

  const strike = () => setForgeRes(insultEngine.forge(tier, { meter, ending, strict }));
  const summon = () => setLine(insultEngine.summonLine(tier, { avoid: line?.text }));
  const runCascade = () => setCascade(insultEngine.diminutiveCascade(tier, 4));

  return (
    <View style={s.stack}>
      {/* Epigraph. Provenance. Muted edge. */}
      <RailCard eyebrow={epi.play} accentColor={Colors.textMuted}>
        <Text style={s.content}>{`“${epi.text}”`}</Text>
        <Text style={s.attr}>{epi.speaker}</Text>
      </RailCard>

      {/* Tier */}
      <View style={s.row}>
        {TIERS.map((t) => (
          <Chip
            key={t}
            label={tierMeta(t).label}
            selected={tier === t}
            onPress={() => setTier(t)}
          />
        ))}
      </View>

      {/* Meter */}
      <View style={s.row}>
        {METERS.map((m) => (
          <Chip
            key={m.value}
            label={m.label}
            selected={meter === m.value}
            onPress={() => setMeter(m.value)}
          />
        ))}
      </View>

      {/* Ending. Metered only. */}
      {meter !== 'any' && (
        <View style={s.row}>
          {ENDINGS.map((e) => (
            <Chip
              key={e.value}
              label={e.label}
              selected={ending === e.value}
              onPress={() => setEnding(e.value)}
            />
          ))}
        </View>
      )}

      {/* Strict. Iambic only. */}
      {meter === 'iambicPentameter' && (
        <View style={s.row}>
          <Chip label="Strict" selected={strict} onPress={() => setStrict((v) => !v)} />
        </View>
      )}

      <Button title="Strike" onPress={strike} />

      {forgeRes && (
        <RailCard eyebrow="FORGED" accentColor={Colors.primary}>
          {forgeRes.scanned ? (
            <>
              <Text style={s.line}>{forgeRes.text}</Text>
              {!!forgeRes.speaker && <Text style={s.attr}>{forgeRes.speaker}</Text>}
              <Text style={s.cite}>{forgeRes.play}</Text>
            </>
          ) : (
            <Text style={s.line}>No line scans that way.</Text>
          )}
        </RailCard>
      )}

      <Button title="Summon" onPress={summon} variant="secondary" />

      {line && (
        <RailCard eyebrow={line.play} accentColor={Colors.primary}>
          <Text style={s.content}>{`“${line.text}”`}</Text>
          <Text style={s.attr}>
            {line.speaker}{line.target ? `, of ${line.target}` : ''}
          </Text>
          {!!line.citation && <Text style={s.cite}>{line.citation}</Text>}
          {!!line.gloss && <Text style={s.gloss}>{line.gloss}</Text>}
        </RailCard>
      )}

      <Button title="Cascade" onPress={runCascade} variant="outline" />

      {cascade && (
        <RailCard eyebrow="CASCADE" accentColor={Colors.primary}>
          {cascade.scanned ? (
            <>
              <Text style={s.line}>{cascade.text}</Text>
              {!!cascade.speaker && <Text style={s.attr}>{cascade.speaker}</Text>}
              <Text style={s.cite}>{cascade.play}</Text>
            </>
          ) : (
            <Text style={s.line}>No line scans that way.</Text>
          )}
        </RailCard>
      )}
    </View>
  );
}

function makeStyles() {
  // Web carries the skin's fonts. Native falls back to the platform face,
  // as every shared primitive does. The serif reading voice is Boomer's
  // bodyFont; the small-caps provenance rides the display font.
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: Gen.bodyFont } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {};

  return StyleSheet.create({
    stack: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: Spacing.xs,
    },
    // Quoted true lines and the epigraph.
    content: {
      fontSize: Type.cardTitle.size,
      lineHeight: Type.cardTitle.lineHeight,
      fontWeight: Type.cardTitle.weight,
      letterSpacing: Type.cardTitle.letterSpacing,
      color: Colors.textPrimary,
      ...bodyFont,
    },
    // The forged and cascade lines. The room's payoff.
    line: {
      fontSize: Type.title.size,
      lineHeight: Type.title.lineHeight,
      fontWeight: '700',
      letterSpacing: Type.title.letterSpacing,
      color: Colors.textPrimary,
      ...bodyFont,
    },
    attr: {
      fontSize: Type.ui.size,
      lineHeight: Type.ui.lineHeight,
      fontStyle: 'italic',
      color: Colors.textSecondary,
      ...bodyFont,
    },
    cite: {
      fontSize: Type.eyebrow.size,
      lineHeight: Type.eyebrow.lineHeight,
      fontWeight: '700',
      letterSpacing: Type.eyebrow.letterSpacing,
      textTransform: 'uppercase',
      color: Colors.textMuted,
      ...displayFont,
    },
    gloss: {
      fontSize: Type.caption.size,
      lineHeight: Type.caption.lineHeight,
      fontStyle: 'italic',
      color: Colors.textMuted,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: Spacing.xs,
      marginTop: Spacing.xxs,
      ...bodyFont,
    },
  });
}
