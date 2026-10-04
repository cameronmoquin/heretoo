/**
 * OfferForm — a buyer's offer on a listing: what kind, how much, what
 * they would trade, and a note. No money moves; the seller accepts one
 * offer and the two settle it between themselves.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '../../shared/Button';
import { Spacing } from '../../../constants/design';
import type { GearListing } from '../../../lib/nffga/types';
import { OFFER_KIND_LABEL, makeOffer, offerKindsFor, type GearOfferKind } from '../../../lib/nffga/gear';
import { ChipPicker, ErrorText, TextField, blankToNull, centsToDollars, dollarsToCents } from '../tournaments/ui';

export function OfferForm({ listing, buyerId, onDone, onCancel }: {
  listing: GearListing; buyerId: string; onDone: () => void; onCancel: () => void;
}) {
  const s = makeStyles();
  const kinds = offerKindsFor(listing.trade_type);
  const [kind, setKind] = useState<GearOfferKind>(kinds[0]);
  const [amount, setAmount] = useState(centsToDollars(listing.price_cents));
  const [trade, setTrade] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wantsAmount = kind === 'buy' || kind === 'buy_plus_trade';
  const wantsTrade = kind === 'trade' || kind === 'buy_plus_trade';
  const cents = dollarsToCents(amount);

  async function send() {
    setErr(null);
    if (wantsAmount && (cents == null || Number.isNaN(cents))) { setErr('Enter an amount in dollars.'); return; }
    if (wantsTrade && !trade.trim()) { setErr('Describe what you would trade.'); return; }
    setBusy(true);
    const r = await makeOffer(listing.id, buyerId, {
      kind,
      amount_cents: wantsAmount ? (cents as number) : null,
      trade_description: wantsTrade ? trade.trim() : null,
      message: blankToNull(message),
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    onDone();
  }

  return (
    <View style={s.form}>
      {kinds.length > 1 ? (
        <ChipPicker label="Offer" options={kinds} value={kind} onChange={(v) => v && setKind(v)} labels={OFFER_KIND_LABEL} />
      ) : null}
      {wantsAmount ? (
        <TextField label="Amount (dollars)" required value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      ) : null}
      {wantsTrade ? (
        <TextField label="What you would trade" required value={trade} onChangeText={setTrade} multiline={3} maxLength={1000} />
      ) : null}
      <TextField label="Message to the seller" value={message} onChangeText={setMessage} multiline={3} maxLength={1000} />
      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title={kind === 'claim' ? 'Claim it' : 'Send offer'} onPress={send} variant="primary" loading={busy} />
        <Button title="Cancel" onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  form: { gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
}); }
