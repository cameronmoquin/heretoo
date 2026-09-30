-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 102: The gear trade
-- ════════════════════════════════════════════════════════════════════════
-- Members sell, trade and give away golf equipment to each other. A
-- LISTING is one item (or one set — an iron set is one listing) with
-- photos, a condition, and a price and/or a wish for what the seller
-- wants in trade. An OFFER is a buyer's move on a listing: a cash
-- amount, a trade proposal, or both. The seller accepts one offer,
-- which parks the listing as pending; the two of them settle it in
-- Messages and off-platform, and the seller marks it sold or traded.
--
-- NO MONEY MOVES HERE. The platform records who agreed to what; it does
-- not hold funds, take a cut, or escrow. Payments happen between the two
-- members however they choose. That keeps the association out of money-
-- transmitter territory, the same reasoning that kept HereToo's
-- donations off every shelf. If a fee is ever wanted, it is a Stripe
-- Checkout on the seller's listing, not a balance on the platform.
--
-- SCOPE. A listing is 'public' (every signed-in member sees it) or
-- 'club' (only active members of the seller's club). families is the
-- club table — the word "family" is HereToo's, kept forever on the
-- stable side; see constants/vocab.ts for the rule.
--
-- STORAGE. Bucket `gear-photos`, public read (a listing photo is meant
-- to be seen). Path convention: {seller_id}/{listing_id}/{n}.{ext}. The
-- write policies check the first path segment is the caller's own id,
-- so nobody uploads into another member's folder.
--
-- GUESTS. Anonymous sessions (083's uid_is_guest) can browse but never
-- list or offer. Enforced with RESTRICTIVE policies so a later
-- migration cannot loosen it by accident.
--
-- Depends on: 001 (profiles, families, family_members, set_updated_at),
-- 083 (uid_is_guest). When this branch's migrations are pruned for the
-- EMSPCR project, those must survive the prune.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Refuse to run on a database missing what this file leans on ────
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.families') is null
     or to_regclass('public.family_members') is null then
    raise exception 'profiles / families / family_members missing: migration 001 has not run here.';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() missing: migration 001 has not run here.';
  end if;
  if to_regprocedure('public.uid_is_guest()') is null then
    raise exception 'public.uid_is_guest() missing: migration 083 has not run here. The guest fence below depends on it.';
  end if;
end$$;


-- ── 1. Listings ──────────────────────────────────────────────────────

create table if not exists public.gear_listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  -- The seller's club, when the listing is club-scoped. Nullable so a
  -- member without a club can still list publicly.
  club_id         uuid references public.families(id) on delete set null,
  scope           text not null default 'public'
                  check (scope in ('public', 'club')),

  title           text not null check (char_length(title) between 3 and 120),
  description     text check (char_length(description) <= 4000),
  category        text not null check (category in (
                    'driver', 'fairway_wood', 'hybrid', 'iron_set', 'single_iron',
                    'wedge', 'putter', 'full_set', 'balls', 'bag', 'push_cart',
                    'apparel', 'shoes', 'rangefinder', 'gps', 'training_aid',
                    'accessory', 'other')),
  brand           text,
  model           text,
  condition       text not null check (condition in ('new', 'like_new', 'good', 'fair', 'worn')),
  handedness      text not null default 'right' check (handedness in ('right', 'left', 'either')),
  -- Club-specific detail that varies by category: shaft, flex, loft,
  -- lie, grip, length, set composition (4-PW), ball count. Freeform so
  -- the form can grow without a migration.
  specs           jsonb not null default '{}'::jsonb,

  -- What the seller wants. At least one of price / trade must apply.
  trade_type      text not null default 'sell_or_trade'
                  check (trade_type in ('sell', 'trade', 'sell_or_trade', 'giveaway')),
  price_cents     integer check (price_cents is null or price_cents >= 0),
  currency        text not null default 'USD',
  trade_for       text check (char_length(trade_for) <= 500),
  shipping        text not null default 'local_only'
                  check (shipping in ('local_only', 'will_ship', 'either')),
  location_text   text,

  status          text not null default 'active'
                  check (status in ('active', 'pending', 'sold', 'traded', 'given', 'withdrawn')),
  accepted_offer_id uuid,   -- FK added below, after gear_offers exists
  closed_at       timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint gear_listings_price_or_trade check (
    (trade_type = 'giveaway')
    or (trade_type = 'trade' and trade_for is not null)
    or (trade_type in ('sell', 'sell_or_trade') and price_cents is not null)
  ),
  constraint gear_listings_club_scope check (scope = 'public' or club_id is not null)
);

drop trigger if exists gear_listings_updated_at on public.gear_listings;
create trigger gear_listings_updated_at before update on public.gear_listings
  for each row execute function public.set_updated_at();

create index if not exists gear_listings_seller_idx   on public.gear_listings(seller_id);
create index if not exists gear_listings_club_idx     on public.gear_listings(club_id) where club_id is not null;
create index if not exists gear_listings_browse_idx   on public.gear_listings(status, scope, created_at desc);
create index if not exists gear_listings_category_idx on public.gear_listings(category) where status = 'active';


-- ── 2. Photos ────────────────────────────────────────────────────────

create table if not exists public.gear_listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.gear_listings(id) on delete cascade,
  path        text not null,           -- in bucket gear-photos
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (listing_id, position)
);

create index if not exists gear_listing_photos_listing_idx on public.gear_listing_photos(listing_id);


-- ── 3. Offers ────────────────────────────────────────────────────────

create table if not exists public.gear_offers (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.gear_listings(id) on delete cascade,
  buyer_id          uuid not null references public.profiles(id) on delete cascade,
  kind              text not null check (kind in ('buy', 'trade', 'buy_plus_trade', 'claim')),
  amount_cents      integer check (amount_cents is null or amount_cents >= 0),
  trade_description text check (char_length(trade_description) <= 1000),
  message           text check (char_length(message) <= 1000),
  status            text not null default 'open'
                    check (status in ('open', 'accepted', 'declined', 'withdrawn', 'completed')),
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,

  constraint gear_offers_shape check (
    (kind = 'claim')
    or (kind = 'buy' and amount_cents is not null)
    or (kind = 'trade' and trade_description is not null)
    or (kind = 'buy_plus_trade' and amount_cents is not null and trade_description is not null)
  )
);

-- One open offer per buyer per listing. Withdraw and re-offer is fine.
create unique index if not exists gear_offers_one_open_idx
  on public.gear_offers(listing_id, buyer_id) where status = 'open';
create index if not exists gear_offers_listing_idx on public.gear_offers(listing_id);
create index if not exists gear_offers_buyer_idx   on public.gear_offers(buyer_id);

-- Now the back-reference from listing to its accepted offer.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gear_listings_accepted_offer_fk'
  ) then
    alter table public.gear_listings
      add constraint gear_listings_accepted_offer_fk
      foreign key (accepted_offer_id) references public.gear_offers(id) on delete set null;
  end if;
end$$;


-- ── 4. Helpers ───────────────────────────────────────────────────────

-- Active membership in a club. Mirrors the inline exists() every
-- HereToo policy writes out; named so the policies below read.
create or replace function public.is_active_club_member(p_club_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_club_id
      and fm.profile_id = p_profile_id
      and fm.status = 'active'
  );
$$;
revoke all on function public.is_active_club_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_club_member(uuid, uuid) to authenticated;


-- ── 5. RLS ───────────────────────────────────────────────────────────

alter table public.gear_listings       enable row level security;
alter table public.gear_listing_photos enable row level security;
alter table public.gear_offers         enable row level security;

-- Listings: browse public ones, your club's, and your own (any status,
-- so a seller sees their sold history).
drop policy if exists gear_listings_read on public.gear_listings;
create policy gear_listings_read on public.gear_listings
  for select to authenticated
  using (
    seller_id = auth.uid()
    or (status in ('active', 'pending') and (
      scope = 'public'
      or (scope = 'club' and public.is_active_club_member(club_id, auth.uid()))
    ))
    -- A buyer whose offer was accepted keeps seeing the listing after
    -- it closes, so the record of what they bought does not vanish.
    or exists (
      select 1 from public.gear_offers o
      where o.listing_id = gear_listings.id and o.buyer_id = auth.uid()
        and o.status in ('accepted', 'completed')
    )
  );

drop policy if exists gear_listings_insert on public.gear_listings;
create policy gear_listings_insert on public.gear_listings
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and (club_id is null or public.is_active_club_member(club_id, auth.uid()))
  );

drop policy if exists gear_listings_update on public.gear_listings;
create policy gear_listings_update on public.gear_listings
  for update to authenticated
  using (seller_id = auth.uid())
  with check (
    seller_id = auth.uid()
    and (club_id is null or public.is_active_club_member(club_id, auth.uid()))
  );

drop policy if exists gear_listings_delete on public.gear_listings;
create policy gear_listings_delete on public.gear_listings
  for delete to authenticated
  using (seller_id = auth.uid() and status in ('active', 'withdrawn'));

-- Guests browse; they never list. RESTRICTIVE, so it ANDs with the above.
drop policy if exists gear_listings_no_guests on public.gear_listings;
create policy gear_listings_no_guests on public.gear_listings
  as restrictive for insert to authenticated
  with check (not public.uid_is_guest());

-- Photos follow their listing.
drop policy if exists gear_listing_photos_read on public.gear_listing_photos;
create policy gear_listing_photos_read on public.gear_listing_photos
  for select to authenticated
  using (exists (select 1 from public.gear_listings l where l.id = listing_id));
  -- (the listing's own read policy already gates which listings resolve)

drop policy if exists gear_listing_photos_write on public.gear_listing_photos;
create policy gear_listing_photos_write on public.gear_listing_photos
  for all to authenticated
  using (exists (select 1 from public.gear_listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.gear_listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Offers: the buyer and the seller see them; nobody else.
drop policy if exists gear_offers_read on public.gear_offers;
create policy gear_offers_read on public.gear_offers
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or exists (select 1 from public.gear_listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

-- A buyer offers on an active listing they can see and do not own.
drop policy if exists gear_offers_insert on public.gear_offers;
create policy gear_offers_insert on public.gear_offers
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and status = 'open'
    and exists (
      select 1 from public.gear_listings l
      where l.id = listing_id and l.status = 'active' and l.seller_id <> auth.uid()
    )
  );

-- A buyer may only withdraw. Accept / decline go through the RPCs below,
-- which run as the seller and are the only path that touches the listing.
drop policy if exists gear_offers_buyer_withdraw on public.gear_offers;
create policy gear_offers_buyer_withdraw on public.gear_offers
  for update to authenticated
  using (buyer_id = auth.uid() and status = 'open')
  with check (buyer_id = auth.uid() and status = 'withdrawn');

drop policy if exists gear_offers_no_guests on public.gear_offers;
create policy gear_offers_no_guests on public.gear_offers
  as restrictive for insert to authenticated
  with check (not public.uid_is_guest());


-- ── 6. The seller's moves ────────────────────────────────────────────

-- Accept one offer: it becomes accepted, every other open offer on the
-- listing is declined, the listing parks as pending. Seller only.
create or replace function public.accept_gear_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.gear_offers;
  l public.gear_listings;
begin
  select * into o from public.gear_offers where id = p_offer_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into l from public.gear_listings where id = o.listing_id for update;
  if l.seller_id <> auth.uid() then return jsonb_build_object('ok', false, 'error', 'not_seller'); end if;
  if l.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'listing_not_active'); end if;
  if o.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'offer_not_open'); end if;

  update public.gear_offers set status = 'accepted', responded_at = now() where id = o.id;
  update public.gear_offers set status = 'declined', responded_at = now()
    where listing_id = l.id and status = 'open' and id <> o.id;
  update public.gear_listings set status = 'pending', accepted_offer_id = o.id where id = l.id;

  return jsonb_build_object('ok', true, 'listing_id', l.id, 'buyer_id', o.buyer_id);
end; $$;
revoke all on function public.accept_gear_offer(uuid) from public, anon;
grant execute on function public.accept_gear_offer(uuid) to authenticated;

-- Decline one open offer. Seller only.
create or replace function public.decline_gear_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.gear_offers;
begin
  select o2.* into o from public.gear_offers o2
    join public.gear_listings l on l.id = o2.listing_id
    where o2.id = p_offer_id and l.seller_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if o.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'offer_not_open'); end if;
  update public.gear_offers set status = 'declined', responded_at = now() where id = o.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.decline_gear_offer(uuid) from public, anon;
grant execute on function public.decline_gear_offer(uuid) to authenticated;

-- Close the deal. The listing goes sold / traded / given according to
-- the accepted offer's kind; the offer goes completed. Seller only.
create or replace function public.complete_gear_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.gear_listings;
  o public.gear_offers;
  final_status text;
begin
  select * into l from public.gear_listings where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if l.status <> 'pending' or l.accepted_offer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_accepted_offer');
  end if;
  select * into o from public.gear_offers where id = l.accepted_offer_id;

  final_status := case
    when l.trade_type = 'giveaway' or o.kind = 'claim' then 'given'
    when o.kind = 'trade' then 'traded'
    else 'sold'
  end;

  update public.gear_offers set status = 'completed', responded_at = now() where id = o.id;
  update public.gear_listings set status = final_status, closed_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'status', final_status);
end; $$;
revoke all on function public.complete_gear_listing(uuid) from public, anon;
grant execute on function public.complete_gear_listing(uuid) to authenticated;

-- Back out of an accepted offer: the listing returns to active, the
-- offer is declined. Seller only (a buyer who wants out just says so
-- in Messages; the seller reopens).
create or replace function public.reopen_gear_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.gear_listings;
begin
  select * into l from public.gear_listings where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if l.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  if l.accepted_offer_id is not null then
    update public.gear_offers set status = 'declined', responded_at = now() where id = l.accepted_offer_id;
  end if;
  update public.gear_listings set status = 'active', accepted_offer_id = null where id = l.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.reopen_gear_listing(uuid) from public, anon;
grant execute on function public.reopen_gear_listing(uuid) to authenticated;


-- ── 7. Storage bucket: gear-photos (public read) ─────────────────────

insert into storage.buckets (id, name, public)
values ('gear-photos', 'gear-photos', true)
on conflict (id) do nothing;

-- Upload and remove only inside your own top-level folder.
drop policy if exists gear_photos_insert on storage.objects;
create policy gear_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gear-photos'
    and not public.uid_is_guest()
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists gear_photos_update on storage.objects;
create policy gear_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'gear-photos' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'gear-photos' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists gear_photos_delete on storage.objects;
create policy gear_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gear-photos' and split_part(name, '/', 1) = auth.uid()::text);

commit;

-- DONE.
