/**
 * /gear/[id] — one listing: photos, details, seller. Buyers make an
 * offer or message the seller (account needed). The seller sees the
 * offers instead, with accept / decline, and closes or reopens the deal.
 */
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/shared/Button';
import { confirm } from '../../../components/shared/ConfirmSheet';
import { RequireAccount } from '../../../components/nffga/RequireAccount';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { formatMoney, type GearListing } from '../../../lib/nffga/types';
import { useSession } from '../../../lib/nffga/useSession';
import {
  CATEGORY_LABEL, CONDITION_LABEL, HANDEDNESS_LABEL, OFFER_KIND_LABEL, OFFER_STATUS_LABEL, SHIPPING_LABEL,
  STATUS_LABEL, TRADE_TYPE_LABEL, acceptOffer, completeListing, declineOffer, gearKeys, photoUrl, priceLabel,
  relistListing, reopenListing, useGearListing, useGearOffers, withdrawListing, withdrawOffer, type GearOffer,
} from '../../../lib/nffga/gear';
import { OfferForm } from '../../../components/nffga/gear/OfferForm';
import { MessageBox } from '../../../components/nffga/gear/MessageBox';
import {
  ErrorText, Loading, Muted, Notice, Page, Paragraph, Row, Section,
} from '../../../components/nffga/tournaments/ui';

export default function GearListingScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const lq = useGearListing(id);
  const oq = useGearOffers(id, userId);
  const l = lq.data;
  const [mode, setMode] = useState<'none' | 'offer' | 'message'>('none');
  const [msgTo, setMsgTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (lq.isLoading) return <Page><Loading /></Page>;
  if (!l) {
    return (
      <Page>
        <Stack.Screen options={{ title: 'Gear' }} />
        <Notice>This listing could not be found. It may have been sold or withdrawn.</Notice>
        <View><Button title="Back to the gear trade" onPress={() => router.replace('/gear' as any)} variant="outline" /></View>
      </Page>
    );
  }

  const listing = l;
  const isSeller = !!userId && userId === l.seller_id;
  const offers = oq.data ?? [];
  const accepted = offers.find((o) => o.id === l.accepted_offer_id) ?? offers.find((o) => o.status === 'accepted') ?? null;

  function refresh() {
    qc.invalidateQueries({ queryKey: gearKeys.one(listing.id) });
    qc.invalidateQueries({ queryKey: ['nffga', 'gear-offers', listing.id] });
    qc.invalidateQueries({ queryKey: gearKeys.all });
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key); setErr(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? 'That did not go through.'); return; }
    refresh();
  }

  const completeLabel = l.trade_type === 'giveaway' || accepted?.kind === 'claim'
    ? 'Mark given' : accepted?.kind === 'trade' ? 'Mark traded' : 'Mark sold';

  const specs = Object.entries(l.specs ?? {}).filter(([, v]) => v != null && String(v).trim() !== '');

  return (
    <Page>
      <Stack.Screen options={{ title: l.title }} />
      <View style={[s.top, wide && s.topWide]}>
        <View style={wide ? s.photosWide : undefined}><Photos l={l} /></View>

        <View style={[s.info, wide && s.infoWide]}>
          {l.status !== 'active' ? <Text style={s.status}>{STATUS_LABEL[l.status]}</Text> : null}
          <Text style={s.title} accessibilityRole="header">{l.title}</Text>
          <Text style={s.price}>{priceLabel(l)}</Text>
          <Text style={s.meta}>
            {[CONDITION_LABEL[l.condition], CATEGORY_LABEL[l.category], l.location_text].filter(Boolean).join(' · ')}
          </Text>

          {/* Seller */}
          <Pressable onPress={() => router.push(`/members/${l.seller_id}` as any)} accessibilityRole="link" style={s.seller}>
            <Text style={s.sellerLabel}>Seller</Text>
            <Text style={s.sellerName}>{l.seller?.display_name ?? 'Member'}</Text>
            {l.seller?.department ? <Text style={s.meta}>{l.seller.department}</Text> : null}
          </Pressable>

          {/* Buyer actions */}
          {!isSeller && l.status === 'active' ? (
            <View style={s.actionsBlock}>
              {sent ? <Notice>Offer sent. The seller will see it on this listing.</Notice> : null}
              {mode === 'none' ? (
                <View style={s.actions}>
                  <Button title={l.trade_type === 'giveaway' ? 'Claim it' : 'Make an offer'} onPress={() => { setMode('offer'); setSent(false); }} variant="primary" size="lg" />
                  <Button title="Message seller" onPress={() => setMode('message')} variant="outline" size="lg" />
                </View>
              ) : (
                <RequireAccount reason={mode === 'offer' ? 'to make an offer' : 'to message the seller'}>
                  {mode === 'offer' ? (
                    <OfferForm
                      listing={l}
                      buyerId={userId as string}
                      onCancel={() => setMode('none')}
                      onDone={() => { setMode('none'); setSent(true); refresh(); }}
                    />
                  ) : (
                    <MessageBox to={l.seller_id} listingId={l.id} label="Message to the seller"
                      initial={`Hi, is the ${l.title} still available?`} onCancel={() => setMode('none')} />
                  )}
                </RequireAccount>
              )}
              {mode !== 'none' && !userId ? (
                <View style={s.actions}><Button title="Cancel" onPress={() => setMode('none')} variant="ghost" /></View>
              ) : null}
            </View>
          ) : null}
          {!isSeller && l.status === 'pending' ? <Muted>The seller has accepted an offer on this listing.</Muted> : null}

          {/* Seller controls */}
          {isSeller ? (
            <View style={s.actionsBlock}>
              <View style={s.actions}>
                {l.status === 'pending' ? (
                  <>
                    <Button title={completeLabel} onPress={() => run('complete', () => completeListing(listing.id))} variant="primary" loading={busy === 'complete'} />
                    <Button title="Reopen" onPress={() => confirm({
                      title: 'Reopen this listing?',
                      message: 'The accepted offer is declined and the listing becomes available again.',
                      confirmLabel: 'Reopen',
                      onConfirm: () => run('reopen', () => reopenListing(listing.id)),
                    })} variant="outline" loading={busy === 'reopen'} />
                  </>
                ) : null}
                {l.status === 'active' || l.status === 'pending' ? (
                  <Button title="Edit" onPress={() => router.push(`/gear/${listing.id}/edit` as any)} variant="outline" />
                ) : null}
                {l.status === 'active' ? (
                  <Button title="Withdraw" onPress={() => confirm({
                    title: 'Withdraw this listing?',
                    message: 'It comes off the gear trade. You can relist it later.',
                    confirmLabel: 'Withdraw',
                    destructive: true,
                    onConfirm: () => run('withdraw', () => withdrawListing(listing.id)),
                  })} variant="ghost" loading={busy === 'withdraw'} />
                ) : null}
                {l.status === 'withdrawn' ? (
                  <Button title="Relist" onPress={() => run('relist', () => relistListing(listing.id))} variant="primary" loading={busy === 'relist'} />
                ) : null}
              </View>
            </View>
          ) : null}
          <ErrorText>{err}</ErrorText>
        </View>
      </View>

      {/* Offers: the seller sees every offer; a buyer sees their own. */}
      {userId && offers.length > 0 ? (
        <Section title={isSeller ? `Offers (${offers.length})` : 'Your offers'}>
          <View style={s.table}>
            {offers.map((o, i) => (
              <View key={o.id} style={[s.offer, i > 0 && s.offerBorder]}>
                <OfferSummary o={o} showBuyer={isSeller} currency={l.currency} />
                <View style={s.actions}>
                  {isSeller && o.status === 'open' && l.status === 'active' ? (
                    <>
                      <Button title="Accept" size="sm" variant="primary" loading={busy === `a${o.id}`}
                        onPress={() => confirm({
                          title: 'Accept this offer?',
                          message: 'Other open offers are declined and the listing is marked as having an accepted offer.',
                          confirmLabel: 'Accept',
                          onConfirm: () => run(`a${o.id}`, () => acceptOffer(o.id)),
                        })} />
                      <Button title="Decline" size="sm" variant="outline" loading={busy === `d${o.id}`}
                        onPress={() => run(`d${o.id}`, () => declineOffer(o.id))} />
                    </>
                  ) : null}
                  {isSeller ? (
                    <Button title="Message" size="sm" variant="ghost" onPress={() => setMsgTo(msgTo === o.id ? null : o.id)} />
                  ) : null}
                  {!isSeller && o.status === 'open' ? (
                    <Button title="Withdraw offer" size="sm" variant="ghost" loading={busy === `w${o.id}`}
                      onPress={() => run(`w${o.id}`, () => withdrawOffer(o.id))} />
                  ) : null}
                </View>
                {isSeller && msgTo === o.id ? (
                  <MessageBox to={o.buyer_id} listingId={l.id} label={`Message to ${o.buyer?.display_name ?? 'the buyer'}`}
                    onCancel={() => setMsgTo(null)} />
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      ) : isSeller && l.status === 'active' ? (
        <Section title="Offers"><Muted>No offers yet.</Muted></Section>
      ) : null}

      <View style={s.grid}>
        <Section title="Details" style={s.cell}>
          <Row label="Category" value={CATEGORY_LABEL[l.category]} />
          <Row label="Brand" value={l.brand} />
          <Row label="Model" value={l.model} />
          <Row label="Condition" value={CONDITION_LABEL[l.condition]} />
          <Row label="Hand" value={HANDEDNESS_LABEL[l.handedness]} />
          {specs.map(([k, v]) => <Row key={k} label={specLabel(k)} value={String(v)} />)}
        </Section>
        <Section title="Deal" style={s.cell}>
          <Row label="Seller wants" value={TRADE_TYPE_LABEL[l.trade_type]} />
          <Row label="Price" value={l.price_cents != null && l.trade_type !== 'giveaway' && l.trade_type !== 'trade' ? formatMoney(l.price_cents, l.currency) : null} />
          {l.price_cents != null && (l.trade_type === 'sell' || l.trade_type === 'sell_or_trade') ? (
            <Row label="Price negotiable" value={l.negotiable ? 'Yes' : 'No'} />
          ) : null}
          <Row label="Would trade for" value={l.trade_for} />
          <Row label="Shipping" value={SHIPPING_LABEL[l.shipping]} />
          <Row label="Location" value={l.location_text} />
          <Row label="Listed" value={new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          <Muted>Payment, pickup and shipping are arranged with the seller in Messages. Nothing is paid on this site.</Muted>
        </Section>
      </View>

      {l.description ? (
        <Section title="Description"><Paragraph>{l.description}</Paragraph></Section>
      ) : null}
    </Page>
  );
}

function specLabel(k: string): string {
  const t = k.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function OfferSummary({ o, showBuyer, currency }: { o: GearOffer; showBuyer: boolean; currency: string }) {
  const s = makeStyles();
  const what = [
    OFFER_KIND_LABEL[o.kind],
    o.amount_cents != null ? formatMoney(o.amount_cents, currency) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={s.offerText}>
      <View style={s.offerHead}>
        <Text style={s.offerWhat}>{what}</Text>
        <Text style={s.offerStatus}>{OFFER_STATUS_LABEL[o.status]}</Text>
      </View>
      {showBuyer ? <Text style={s.meta}>{[o.buyer?.display_name ?? 'Member', o.buyer?.department].filter(Boolean).join(' · ')}</Text> : null}
      {o.trade_description ? <Text style={s.offerBody}>Trade: {o.trade_description}</Text> : null}
      {o.message ? <Text style={s.offerBody}>{o.message}</Text> : null}
      <Text style={s.when}>{new Date(o.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
    </View>
  );
}

function Photos({ l }: { l: GearListing }) {
  const s = makeStyles();
  const photos = l.photos ?? [];
  const [i, setI] = useState(0);
  if (photos.length === 0) {
    return <View style={[s.main, s.noPhoto]}><Text style={s.meta}>No photos</Text></View>;
  }
  const current = photos[Math.min(i, photos.length - 1)];
  return (
    <View style={s.photos}>
      <View style={s.main}>
        <Image source={{ uri: photoUrl(current.path) }} style={s.mainImg} resizeMode="contain" accessibilityLabel={`Photo ${i + 1} of ${photos.length}`} />
      </View>
      {photos.length > 1 ? (
        <View style={s.thumbs}>
          {photos.map((p, j) => (
            <Pressable key={p.id ?? p.path} onPress={() => setI(j)} style={[s.thumb, j === i && s.thumbOn]}
              accessibilityRole="button" accessibilityLabel={`Show photo ${j + 1}`}>
              <Image source={{ uri: photoUrl(p.path) }} style={s.thumbImg} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  top: { gap: Spacing.lg },
  topWide: { flexDirection: 'row', alignItems: 'flex-start' },
  photosWide: { flex: 1.2, minWidth: 0 },
  info: { gap: Spacing.sm },
  infoWide: { flex: 1, minWidth: 0 },
  status: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textSecondary },
  title: { fontSize: Type.display.size, lineHeight: Type.display.lineHeight, fontWeight: Type.display.weight, color: Colors.textPrimary },
  price: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
  seller: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, gap: 2 },
  sellerLabel: { fontSize: Type.caption.size, color: Colors.textMuted },
  sellerName: { fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  actionsBlock: { gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  photos: { gap: Spacing.xs },
  main: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.media, overflow: 'hidden', backgroundColor: Colors.surfaceAlt },
  mainImg: { width: '100%', height: '100%' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  thumb: { width: 64, height: 64, borderRadius: Radius.control, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: Colors.primary },
  thumbImg: { width: '100%', height: '100%' },
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media },
  offer: { padding: Spacing.md, gap: Spacing.sm },
  offerBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  offerText: { gap: 2 },
  offerHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  offerWhat: { fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  offerStatus: { fontSize: Type.caption.size, color: Colors.textSecondary },
  offerBody: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  when: { fontSize: Type.caption.size, color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.xl, rowGap: Spacing.lg },
  cell: { flexGrow: 1, flexBasis: 420, minWidth: 0 },
}); }
