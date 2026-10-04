/**
 * NFFGA data types — the client side of docs/NFFGA_CONTRACT.md.
 * Add fields freely; do not rename. Every table is nffga_-prefixed in
 * the shared EMSPCR database.
 */

export interface NffgaProfile {
  user_id: string;
  display_name: string;
  department: string | null;
  rank_title: string | null;
  city: string | null;
  state: string | null;
  handicap: number | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardPost {
  id: string;
  author_id: string;
  body: string;
  /** First photo; mirrored from photo_paths[0] by the database. */
  photo_path: string | null;
  /** Up to five photos, in order (migration 108). */
  photo_paths?: string[];
  kind: 'post' | 'announcement';
  created_at: string;
  deleted_at: string | null;
  /** Joined for display. */
  author?: Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'> | null;
  comment_count?: number;
}

export interface BoardComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  author?: Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'> | null;
}

export type GearCategory =
  | 'driver' | 'fairway_wood' | 'hybrid' | 'iron_set' | 'single_iron' | 'wedge' | 'putter'
  | 'full_set' | 'balls' | 'bag' | 'push_cart' | 'apparel' | 'shoes' | 'rangefinder' | 'gps'
  | 'training_aid' | 'accessory' | 'other';
/** Seller's scale (migration 108): everything but 'new' is used. */
export type GearCondition = 'new' | 'mint' | 'great' | 'good' | 'fair' | 'poor';
export type GearTradeType = 'sell' | 'trade' | 'sell_or_trade' | 'giveaway';
export type GearStatus = 'active' | 'pending' | 'sold' | 'traded' | 'given' | 'withdrawn';

export interface GearListing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  category: GearCategory;
  brand: string | null;
  model: string | null;
  condition: GearCondition;
  handedness: 'right' | 'left' | 'either';
  specs: Record<string, unknown>;
  trade_type: GearTradeType;
  price_cents: number | null;
  /** The price is open to offers (migration 108). */
  negotiable: boolean;
  currency: string;
  trade_for: string | null;
  shipping: 'local_only' | 'will_ship' | 'either';
  location_text: string | null;
  status: GearStatus;
  /** The offer the seller accepted while the listing is pending. Migration 103. */
  accepted_offer_id?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  photos?: { id: string; path: string; position: number }[];
  seller?: Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'> | null;
}

export type TournamentStatus =
  | 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentFormat =
  | 'scramble' | 'shamble' | 'best_ball' | 'stroke_play' | 'stableford' | 'match_play' | 'alternate_shot' | 'other';

/** Who may enter a tournament. Migration 107. */
export type TournamentEntryMode = 'individual' | 'team' | 'both';

/** A sponsorship or add-on (mulligans, hole sign...). Recorded, never sold here. Migration 107. */
export interface TournamentPackage {
  name: string;
  price_cents: number | null;
  description?: string | null;
  quantity_available?: number | null;
}

/** An on-course contest (closest to the pin, longest drive...). Migration 107. */
export interface TournamentContest {
  name: string;
  hole?: string | null;
  prize?: string | null;
  sponsor?: string | null;
}

export interface Tournament {
  id: string;
  /** Null when NFFGA itself created the event (migration 107). */
  organizer_id: string | null;
  status: TournamentStatus;
  name: string;
  description: string | null;
  format: TournamentFormat;
  format_notes: string | null;
  team_size: number;
  holes: number;
  flights: string | null;
  handicap_required: boolean;
  handicap_max: number | null;
  beneficiary: string | null;
  course_name: string | null;
  course_address: string | null;
  course_city: string | null;
  course_state: string | null;
  course_postal: string | null;
  course_phone: string | null;
  course_url: string | null;
  timezone: string;
  starts_at: string | null;
  ends_at: string | null;
  check_in_at: string | null;
  start_type: 'shotgun' | 'tee_times';
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  rain_date: string | null;
  rain_policy: string | null;
  max_players: number | null;
  max_teams: number | null;
  waitlist_enabled: boolean;
  entry_fee_cents: number;
  currency: string;
  fee_includes: string | null;
  payment_instructions: string | null;
  payment_url: string | null;
  dress_code: string | null;
  cart_policy: string | null;
  mulligans_policy: string | null;
  alcohol_policy: string | null;
  meal_included: boolean;
  meal_notes: string | null;
  prizes: string | null;
  sponsors: string | null;
  schedule: { at: string; what: string }[];
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  waiver_required: boolean;
  waiver_text: string | null;
  waiver_version: number;
  cover_path: string | null;
  /** Minutes between groups on a tee-time start (5–20). Migration 104. */
  tee_interval_min?: number | null;
  /** Extra notes shown on the public sheet. Migration 104. */
  public_notes?: string | null;
  created_at: string;
  updated_at: string;
  /** Migration 107: entry options, add-ons, contests, host. */
  entry_mode?: TournamentEntryMode;
  team_fee_cents?: number | null;
  packages?: TournamentPackage[];
  contests?: TournamentContest[];
  host_department?: string | null;
  sanctioned?: boolean;
  /** Seats taken (a team entry holds team_size seats), from nffga_tournament_field_counts. */
  registered_count?: number;
  /** Team entries seated, from nffga_tournament_field_counts. */
  teams_entered?: number;
}

/** A fire department's proposal for a regional event. Migration 107. */
export type EventRequestStatus = 'submitted' | 'reviewing' | 'approved' | 'declined';
export interface EventRequest {
  id: string;
  submitted_by: string | null;
  department_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  proposed_dates: string | null;
  course_name: string | null;
  course_city: string | null;
  expected_players: number | null;
  format: string | null;
  beneficiary: string | null;
  notes: string | null;
  status: EventRequestStatus;
  officer_notes: string | null;
  tournament_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  subject: string | null;
  gear_listing_id: string | null;
  created_at: string;
  last_message_at: string | null;
  /** The other participant, joined for display. */
  other?: Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'> | null;
  last_message?: string | null;
  unread?: boolean;
}

export interface Message {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/** Public URL for an object in a public NFFGA bucket. */
export function publicObjectUrl(bucket: 'nffga-gear' | 'nffga-media' | 'nffga-site', path: string): string {
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export function formatMoney(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
