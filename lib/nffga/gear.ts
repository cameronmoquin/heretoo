/**
 * Gear trade — the client side of nffga_gear_listings, nffga_gear_photos
 * and nffga_gear_offers (docs/NFFGA_CONTRACT.md; columns per migration
 * 103, minus the club scope).
 *
 * No money moves on the platform. An offer records who proposed what;
 * the seller accepts one, the two settle it in Messages, and the seller
 * marks the listing sold, traded or given.
 *
 * Reads degrade quietly: a missing table gives an empty list and a
 * console warning, never a thrown error.
 */
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../supabase';
import { publicObjectUrl } from './types';
import type {
  GearListing, GearCategory, GearCondition, GearTradeType, GearStatus, NffgaProfile,
} from './types';

export const GEAR_BUCKET = 'nffga-gear' as const;
export const MAX_GEAR_PHOTOS = 8;

// ── Types local to the gear screens ─────────────────────────────────

export type GearOfferKind = 'buy' | 'trade' | 'buy_plus_trade' | 'claim';
export type GearOfferStatus = 'open' | 'accepted' | 'declined' | 'withdrawn' | 'completed';

export interface GearOffer {
  id: string;
  listing_id: string;
  buyer_id: string;
  kind: GearOfferKind;
  amount_cents: number | null;
  trade_description: string | null;
  message: string | null;
  status: GearOfferStatus;
  created_at: string;
  responded_at?: string | null;
  buyer?: Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'> | null;
}

export type SellerLite = Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'>;

// ── Labels ───────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<GearCategory, string> = {
  driver: 'Driver',
  fairway_wood: 'Fairway wood',
  hybrid: 'Hybrid',
  iron_set: 'Iron set',
  single_iron: 'Single iron',
  wedge: 'Wedge',
  putter: 'Putter',
  full_set: 'Full set',
  balls: 'Balls',
  bag: 'Bag',
  push_cart: 'Push cart',
  apparel: 'Apparel',
  shoes: 'Shoes',
  rangefinder: 'Rangefinder',
  gps: 'GPS',
  training_aid: 'Training aid',
  accessory: 'Accessory',
  other: 'Other',
};
export const GEAR_CATEGORIES = Object.keys(CATEGORY_LABEL) as GearCategory[];

export const CONDITION_LABEL: Record<GearCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
};
export const GEAR_CONDITIONS = Object.keys(CONDITION_LABEL) as GearCondition[];

export const HANDEDNESS_LABEL: Record<GearListing['handedness'], string> = {
  right: 'Right-handed',
  left: 'Left-handed',
  either: 'Either hand',
};

export const TRADE_TYPE_LABEL: Record<GearTradeType, string> = {
  sell: 'Sell',
  trade: 'Trade',
  sell_or_trade: 'Sell or trade',
  giveaway: 'Give away',
};

export const SHIPPING_LABEL: Record<GearListing['shipping'], string> = {
  local_only: 'Local pickup only',
  will_ship: 'Will ship',
  either: 'Pickup or ship',
};

export const STATUS_LABEL: Record<GearStatus, string> = {
  active: 'Available',
  pending: 'Offer accepted',
  sold: 'Sold',
  traded: 'Traded',
  given: 'Given away',
  withdrawn: 'Withdrawn',
};

export const OFFER_KIND_LABEL: Record<GearOfferKind, string> = {
  buy: 'Buy',
  trade: 'Trade',
  buy_plus_trade: 'Cash plus trade',
  claim: 'Claim',
};

export const OFFER_STATUS_LABEL: Record<GearOfferStatus, string> = {
  open: 'Open',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
};

/** The offer kinds that make sense for a listing's trade type. */
export function offerKindsFor(tradeType: GearTradeType): GearOfferKind[] {
  switch (tradeType) {
    case 'sell': return ['buy'];
    case 'trade': return ['trade'];
    case 'giveaway': return ['claim'];
    default: return ['buy', 'trade', 'buy_plus_trade'];
  }
}

/** "$120", "Trade", "$120 or trade", "Free". */
export function priceLabel(l: Pick<GearListing, 'trade_type' | 'price_cents' | 'currency'>): string {
  const money = l.price_cents != null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency', currency: l.currency || 'USD',
        maximumFractionDigits: l.price_cents % 100 ? 2 : 0,
      }).format(l.price_cents / 100)
    : '';
  switch (l.trade_type) {
    case 'giveaway': return 'Free';
    case 'trade': return 'Trade';
    case 'sell_or_trade': return money ? `${money} or trade` : 'Trade';
    default: return money || 'Make an offer';
  }
}

export function photoUrl(path: string): string {
  if (/^(https?:|blob:|data:|file:)/.test(path)) return path;
  return publicObjectUrl(GEAR_BUCKET, path);
}

// ── Quiet failure ────────────────────────────────────────────────────

function quiet(where: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[nffga] ${where}:`, (error as any)?.message ?? error);
}

// ── Reads ────────────────────────────────────────────────────────────

async function profilesById(ids: string[]): Promise<Record<string, SellerLite>> {
  const out: Record<string, SellerLite> = {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from('nffga_profiles')
      .select('user_id, display_name, department')
      .in('user_id', unique);
    if (error) { quiet('profiles', error); return out; }
    for (const p of (data ?? []) as SellerLite[]) out[p.user_id] = p;
  } catch (e) {
    quiet('profiles', e);
  }
  return out;
}

async function photosByListing(ids: string[]): Promise<Record<string, NonNullable<GearListing['photos']>>> {
  const out: Record<string, NonNullable<GearListing['photos']>> = {};
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from('nffga_gear_photos')
      .select('id, listing_id, path, position')
      .in('listing_id', ids)
      .order('position', { ascending: true });
    if (error) { quiet('gear photos', error); return out; }
    for (const p of (data ?? []) as { id: string; listing_id: string; path: string; position: number }[]) {
      (out[p.listing_id] ??= []).push({ id: p.id, path: p.path, position: p.position });
    }
  } catch (e) {
    quiet('gear photos', e);
  }
  return out;
}

async function decorate(rows: GearListing[]): Promise<GearListing[]> {
  const [photos, sellers] = await Promise.all([
    photosByListing(rows.map((r) => r.id)),
    profilesById(rows.map((r) => r.seller_id)),
  ]);
  return rows.map((r) => ({
    ...r,
    specs: r.specs && typeof r.specs === 'object' ? r.specs : {},
    photos: photos[r.id] ?? [],
    seller: sellers[r.seller_id] ?? null,
  }));
}

export async function fetchListings(opts: { category?: GearCategory | null; limit?: number } = {}): Promise<GearListing[]> {
  try {
    let q = supabase
      .from('nffga_gear_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (opts.category) q = q.eq('category', opts.category);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) { quiet('gear listings', error); return []; }
    return decorate((data ?? []) as GearListing[]);
  } catch (e) {
    quiet('gear listings', e);
    return [];
  }
}

export async function fetchListing(id: string): Promise<GearListing | null> {
  try {
    const { data, error } = await supabase.from('nffga_gear_listings').select('*').eq('id', id).maybeSingle();
    if (error) { quiet('gear listing', error); return null; }
    if (!data) return null;
    const [one] = await decorate([data as GearListing]);
    return one ?? null;
  } catch (e) {
    quiet('gear listing', e);
    return null;
  }
}

/** Offers the caller may see on a listing: all of them for the seller, their own for a buyer. */
export async function fetchOffers(listingId: string): Promise<GearOffer[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_gear_offers')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });
    if (error) { quiet('gear offers', error); return []; }
    const rows = (data ?? []) as GearOffer[];
    const buyers = await profilesById(rows.map((o) => o.buyer_id));
    return rows.map((o) => ({ ...o, buyer: buyers[o.buyer_id] ?? null }));
  } catch (e) {
    quiet('gear offers', e);
    return [];
  }
}

// ── Hooks ────────────────────────────────────────────────────────────

export const gearKeys = {
  list: (category: GearCategory | null, limit?: number) => ['nffga', 'gear', category, limit ?? null] as const,
  all: ['nffga', 'gear'] as const,
  one: (id: string) => ['nffga', 'gear-listing', id] as const,
  offers: (id: string, userId: string | null) => ['nffga', 'gear-offers', id, userId] as const,
};

export function useGearListings(category: GearCategory | null = null, limit?: number) {
  return useQuery({ queryKey: gearKeys.list(category, limit), queryFn: () => fetchListings({ category, limit }) });
}

export function useGearListing(id: string | undefined) {
  return useQuery({ queryKey: gearKeys.one(id ?? ''), queryFn: () => fetchListing(id as string), enabled: !!id });
}

export function useGearOffers(id: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: gearKeys.offers(id ?? '', userId),
    queryFn: () => fetchOffers(id as string),
    enabled: !!id && !!userId,
  });
}

// ── Writes ───────────────────────────────────────────────────────────

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const RPC_ERROR_TEXT: Record<string, string> = {
  not_found: 'That could not be found.',
  not_seller: 'Only the seller can do that.',
  listing_not_active: 'This listing is no longer available.',
  offer_not_open: 'That offer is no longer open.',
  no_accepted_offer: 'Accept an offer first.',
  not_pending: 'This listing has no accepted offer to undo.',
  not_signed_in: 'Sign in first.',
};

async function sellerRpc(fn: string, args: Record<string, string>): Promise<Result> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) { quiet(fn, error); return { ok: false, error: 'That did not go through. Try again later.' }; }
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (!r.ok) return { ok: false, error: RPC_ERROR_TEXT[r.error ?? ''] ?? 'That did not go through. Try again.' };
    return { ok: true };
  } catch (e) {
    quiet(fn, e);
    return { ok: false, error: 'That did not go through. Try again later.' };
  }
}

export const acceptOffer = (offerId: string) => sellerRpc('nffga_accept_gear_offer', { p_offer_id: offerId });
export const declineOffer = (offerId: string) => sellerRpc('nffga_decline_gear_offer', { p_offer_id: offerId });
export const completeListing = (listingId: string) => sellerRpc('nffga_complete_gear_listing', { p_listing_id: listingId });
export const reopenListing = (listingId: string) => sellerRpc('nffga_reopen_gear_listing', { p_listing_id: listingId });

export async function withdrawListing(listingId: string): Promise<Result> {
  try {
    const { error } = await supabase.from('nffga_gear_listings').update({ status: 'withdrawn' }).eq('id', listingId);
    if (error) { quiet('withdraw listing', error); return { ok: false, error: friendlyWriteError(error) }; }
    return { ok: true };
  } catch (e) {
    quiet('withdraw listing', e);
    return { ok: false, error: 'That did not go through. Try again later.' };
  }
}

/** A withdrawn listing goes back on the market. */
export async function relistListing(listingId: string): Promise<Result> {
  try {
    const { error } = await supabase.from('nffga_gear_listings').update({ status: 'active' }).eq('id', listingId);
    if (error) { quiet('relist', error); return { ok: false, error: friendlyWriteError(error) }; }
    return { ok: true };
  } catch (e) {
    quiet('relist', e);
    return { ok: false, error: 'That did not go through. Try again later.' };
  }
}

export interface OfferInput {
  kind: GearOfferKind;
  amount_cents: number | null;
  trade_description: string | null;
  message: string | null;
}

export async function makeOffer(listingId: string, buyerId: string, input: OfferInput): Promise<Result> {
  try {
    const { error } = await supabase.from('nffga_gear_offers').insert({
      listing_id: listingId,
      buyer_id: buyerId,
      kind: input.kind,
      amount_cents: input.amount_cents,
      trade_description: input.trade_description,
      message: input.message,
    });
    if (error) {
      quiet('make offer', error);
      if (error.code === '23505') return { ok: false, error: 'You already have an open offer on this listing. Withdraw it to make a new one.' };
      return { ok: false, error: friendlyWriteError(error) };
    }
    return { ok: true };
  } catch (e) {
    quiet('make offer', e);
    return { ok: false, error: 'Could not send the offer. Try again later.' };
  }
}

/** A buyer takes back their own open offer. */
export async function withdrawOffer(offerId: string): Promise<Result> {
  try {
    const { error } = await supabase.from('nffga_gear_offers').update({ status: 'withdrawn' }).eq('id', offerId);
    if (error) { quiet('withdraw offer', error); return { ok: false, error: friendlyWriteError(error) }; }
    return { ok: true };
  } catch (e) {
    quiet('withdraw offer', e);
    return { ok: false, error: 'That did not go through. Try again later.' };
  }
}

/** Open (or reuse) a 1:1 thread with the seller about this listing. */
export async function messageSeller(sellerId: string, body: string, listingId: string): Promise<Result<{ threadId: string }>> {
  try {
    const { data, error } = await supabase.rpc('nffga_start_thread', {
      p_other: sellerId, p_body: body, p_gear_listing_id: listingId,
    });
    if (error) { quiet('start thread', error); return { ok: false, error: 'Messages are not available right now. Try again later.' }; }
    const r = (data ?? {}) as { ok?: boolean; thread_id?: string; error?: string };
    if (!r.ok || !r.thread_id) return { ok: false, error: 'Could not send the message. Try again.' };
    return { ok: true, threadId: r.thread_id };
  } catch (e) {
    quiet('start thread', e);
    return { ok: false, error: 'Messages are not available right now. Try again later.' };
  }
}

export interface ListingInput {
  title: string;
  description: string | null;
  category: GearCategory;
  brand: string | null;
  model: string | null;
  condition: GearCondition;
  handedness: GearListing['handedness'];
  specs: Record<string, unknown>;
  trade_type: GearTradeType;
  price_cents: number | null;
  trade_for: string | null;
  shipping: GearListing['shipping'];
  location_text: string | null;
}

/** A photo in the listing form: already stored (path) or freshly picked (uri). */
export type PhotoDraft =
  | { kind: 'stored'; path: string }
  | { kind: 'new'; uri: string; mimeType?: string | null; fileName?: string | null };

/**
 * Create or update a listing, upload new photos to
 * nffga-gear/{seller}/{listing}/{n}.{ext}, and rewrite the photo rows in
 * the order shown in the form.
 */
export async function saveListing(
  input: ListingInput,
  photos: PhotoDraft[],
  opts: { id?: string; sellerId: string },
): Promise<Result<{ id: string; photoError?: string }>> {
  let id = opts.id;
  try {
    if (id) {
      const { error } = await supabase.from('nffga_gear_listings').update(input).eq('id', id);
      if (error) { quiet('update listing', error); return { ok: false, error: friendlyWriteError(error) }; }
    } else {
      const { data, error } = await supabase
        .from('nffga_gear_listings')
        .insert({ ...input, seller_id: opts.sellerId })
        .select('id')
        .single();
      if (error || !data) { quiet('create listing', error); return { ok: false, error: friendlyWriteError(error) }; }
      id = (data as { id: string }).id;
    }
  } catch (e) {
    quiet('save listing', e);
    return { ok: false, error: 'Could not save right now. Try again later.' };
  }

  // Photos. The listing is saved either way; a photo failure is reported
  // but does not lose the rest of the form.
  const photoError = await syncPhotos(id as string, opts.sellerId, photos.slice(0, MAX_GEAR_PHOTOS));
  return { ok: true, id: id as string, photoError: photoError ?? undefined };
}

async function syncPhotos(listingId: string, sellerId: string, photos: PhotoDraft[]): Promise<string | null> {
  const paths: string[] = [];
  let failed = 0;
  const stamp = Date.now();
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (p.kind === 'stored') { paths.push(p.path); continue; }
    try {
      const prepared = await preparePhoto(p);
      const path = `${sellerId}/${listingId}/${stamp + i}.${prepared.ext}`;
      const { error } = await supabase.storage
        .from(GEAR_BUCKET)
        .upload(path, prepared.body, { contentType: prepared.contentType, upsert: false });
      if (error) throw error;
      paths.push(path);
    } catch (e) {
      quiet('photo upload', e);
      failed += 1;
    }
  }

  try {
    const { data: before } = await supabase.from('nffga_gear_photos').select('path').eq('listing_id', listingId);
    const { error: delErr } = await supabase.from('nffga_gear_photos').delete().eq('listing_id', listingId);
    if (delErr) throw delErr;
    if (paths.length > 0) {
      const { error: insErr } = await supabase
        .from('nffga_gear_photos')
        .insert(paths.map((path, position) => ({ listing_id: listingId, path, position })));
      if (insErr) throw insErr;
    }
    // Storage objects no longer referenced. Best effort.
    const dropped = ((before ?? []) as { path: string }[]).map((r) => r.path).filter((x) => !paths.includes(x));
    if (dropped.length > 0) {
      supabase.storage.from(GEAR_BUCKET).remove(dropped).catch(() => {});
    }
  } catch (e) {
    quiet('photo rows', e);
    return 'The listing was saved, but the photos could not be attached. Edit the listing to try again.';
  }

  if (failed > 0) {
    return failed === 1
      ? 'The listing was saved, but one photo did not upload.'
      : `The listing was saved, but ${failed} photos did not upload.`;
  }
  return null;
}

async function preparePhoto(p: Extract<PhotoDraft, { kind: 'new' }>): Promise<{ body: Blob | ArrayBuffer; contentType: string; ext: string }> {
  let uri = p.uri;
  let contentType = 'image/jpeg';
  let ext = 'jpg';
  try {
    const out = await ImageManipulator.manipulateAsync(
      p.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    uri = out.uri;
  } catch {
    // Ship the original bytes.
    contentType = p.mimeType || 'image/jpeg';
    ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
  }
  const buffer = await readAsArrayBuffer(uri);
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('photo too large');
  return { body: new Blob([buffer], { type: contentType }), contentType, ext };
}

async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const r = await fetch(uri);
    return r.arrayBuffer();
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy');
  const base64: string = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function friendlyWriteError(error: any): string {
  const msg = String(error?.message ?? '');
  const code = String(error?.code ?? '');
  if (code === '42501' || /row-level security/i.test(msg)) return 'Your account cannot make this change.';
  if (code === '42P01' || code === 'PGRST205') return 'The gear trade is not set up on the server yet.';
  if (/price_or_trade/.test(msg)) return 'Add a price, or say what you want in trade.';
  if (/gear_offers_shape/.test(msg)) return 'Add an amount or a trade description for this kind of offer.';
  if (/title/.test(msg) && /check/i.test(msg)) return 'The title must be 3 to 120 characters.';
  if (/check constraint/i.test(msg)) return 'One of the values is out of range. Check the form and try again.';
  return msg || 'That did not go through. Try again.';
}
