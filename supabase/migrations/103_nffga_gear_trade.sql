-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 103: The gear trade
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
-- transmitter territory. If a fee is ever wanted, it is a Stripe
-- Checkout on the seller's listing, not a balance on the platform.
--
-- PUBLIC. Every listing is public for this version (the HereToo draft's
-- club scope is gone). Anyone who scans the QR code — the `anon` role —
-- can browse active and pending listings and their photos. Offers are
-- never public: only the buyer and the seller see them.
--
-- STORAGE. Bucket `nffga-gear`, public read (a listing photo is meant
-- to be seen). Path convention: {seller_id}/{listing_id}/{n}.{ext}. The
-- write policies check the first path segment is the caller's own id,
-- so nobody uploads into another member's folder.
--
-- GUESTS. Anonymous sessions (JWT is_anonymous = true) can browse but
-- never list or offer. Enforced with RESTRICTIVE policies so a later
-- migration cannot loosen it by accident.
--
-- SHARED DATABASE. Project avepftawrkwytlohobjh (EMSPCR) also serves
-- EMSPCR and Car56. Everything here is prefixed nffga_ / nffga-, refers
-- to auth.users directly, and `create or replace`s only functions named
-- nffga_*. Depends on nothing but auth.users and the storage schema.
--
-- Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Helper: is this session an anonymous (guest) sign-in? ──────────

create or replace function public.nffga_is_guest()
returns boolean language sql stable set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;
revoke all on function public.nffga_is_guest() from public, anon;
grant execute on function public.nffga_is_guest() to authenticated;


-- ── 0b. Helper: keep updated_at honest ─────────────────────────────────

create or replace function public.nffga_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.nffga_touch_updated_at() from public, anon, authenticated;


-- ── 1. Listings ──────────────────────────────────────────────────────

create table if not exists public.nffga_gear_listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,

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
  accepted_offer_id uuid,   -- FK added below, after nffga_gear_offers exists
  closed_at       timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint nffga_gear_listings_price_or_trade check (
    (trade_type = 'giveaway')
    or (trade_type = 'trade' and trade_for is not null)
    or (trade_type in ('sell', 'sell_or_trade') and price_cents is not null)
  )
);

drop trigger if exists nffga_gear_listings_updated_at on public.nffga_gear_listings;
create trigger nffga_gear_listings_updated_at before update on public.nffga_gear_listings
  for each row execute function public.nffga_touch_updated_at();

create index if not exists nffga_gear_listings_seller_idx   on public.nffga_gear_listings(seller_id);
create index if not exists nffga_gear_listings_browse_idx   on public.nffga_gear_listings(status, created_at desc);
create index if not exists nffga_gear_listings_category_idx on public.nffga_gear_listings(category) where status = 'active';


-- ── 2. Photos ────────────────────────────────────────────────────────

create table if not exists public.nffga_gear_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.nffga_gear_listings(id) on delete cascade,
  path        text not null,           -- in bucket nffga-gear
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  constraint nffga_gear_photos_listing_position_key unique (listing_id, position)
);

create index if not exists nffga_gear_photos_listing_idx on public.nffga_gear_photos(listing_id);


-- ── 3. Offers ────────────────────────────────────────────────────────

create table if not exists public.nffga_gear_offers (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.nffga_gear_listings(id) on delete cascade,
  buyer_id          uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('buy', 'trade', 'buy_plus_trade', 'claim')),
  amount_cents      integer check (amount_cents is null or amount_cents >= 0),
  trade_description text check (char_length(trade_description) <= 1000),
  message           text check (char_length(message) <= 1000),
  status            text not null default 'open'
                    check (status in ('open', 'accepted', 'declined', 'withdrawn', 'completed')),
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,

  constraint nffga_gear_offers_shape check (
    (kind = 'claim')
    or (kind = 'buy' and amount_cents is not null)
    or (kind = 'trade' and trade_description is not null)
    or (kind = 'buy_plus_trade' and amount_cents is not null and trade_description is not null)
  )
);

-- One open offer per buyer per listing. Withdraw and re-offer is fine.
create unique index if not exists nffga_gear_offers_one_open_idx
  on public.nffga_gear_offers(listing_id, buyer_id) where status = 'open';
create index if not exists nffga_gear_offers_listing_idx on public.nffga_gear_offers(listing_id);
create index if not exists nffga_gear_offers_buyer_idx   on public.nffga_gear_offers(buyer_id);

-- Now the back-reference from listing to its accepted offer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nffga_gear_listings_accepted_offer_fk'
      and conrelid = 'public.nffga_gear_listings'::regclass
  ) then
    alter table public.nffga_gear_listings
      add constraint nffga_gear_listings_accepted_offer_fk
      foreign key (accepted_offer_id) references public.nffga_gear_offers(id) on delete set null;
  end if;
end$$;


-- ── 4. Policy helpers ────────────────────────────────────────────────
-- Listings' read policy looks at offers and offers' read policy looks at
-- listings. Written inline, that is infinite RLS recursion; through
-- SECURITY DEFINER helpers it is two plain lookups.

create or replace function public.nffga_is_gear_seller(p_listing_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nffga_gear_listings l
    where l.id = p_listing_id and l.seller_id = p_user_id
  );
$$;
revoke all on function public.nffga_is_gear_seller(uuid, uuid) from public, anon;
grant execute on function public.nffga_is_gear_seller(uuid, uuid) to authenticated;

-- A buyer whose offer was accepted keeps seeing the listing after it
-- closes, so the record of what they bought does not vanish.
create or replace function public.nffga_is_gear_winning_buyer(p_listing_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nffga_gear_offers o
    where o.listing_id = p_listing_id and o.buyer_id = p_user_id
      and o.status in ('accepted', 'completed')
  );
$$;
revoke all on function public.nffga_is_gear_winning_buyer(uuid, uuid) from public, anon;
grant execute on function public.nffga_is_gear_winning_buyer(uuid, uuid) to authenticated;


-- ── 5. RLS ───────────────────────────────────────────────────────────

alter table public.nffga_gear_listings enable row level security;
alter table public.nffga_gear_photos   enable row level security;
alter table public.nffga_gear_offers   enable row level security;

-- Nothing signed-out ever writes. (Supabase's default privileges grant
-- anon everything on new tables; RLS already stops it, this is belt and
-- braces.)
revoke insert, update, delete, truncate, references, trigger on public.nffga_gear_listings from anon;
revoke insert, update, delete, truncate, references, trigger on public.nffga_gear_photos   from anon;
revoke all on public.nffga_gear_offers from anon;
grant select on public.nffga_gear_listings to anon, authenticated;
grant select on public.nffga_gear_photos   to anon, authenticated;

-- Listings, public face: anyone, signed in or not, browses active and
-- pending listings.
drop policy if exists nffga_gear_listings_public_read on public.nffga_gear_listings;
create policy nffga_gear_listings_public_read on public.nffga_gear_listings
  for select to anon, authenticated
  using (status in ('active', 'pending'));

-- Listings, private face: the seller sees their own at any status (their
-- sold history); the winning buyer keeps seeing what they bought.
drop policy if exists nffga_gear_listings_own_read on public.nffga_gear_listings;
create policy nffga_gear_listings_own_read on public.nffga_gear_listings
  for select to authenticated
  using (
    seller_id = auth.uid()
    or public.nffga_is_gear_winning_buyer(id, auth.uid())
  );

drop policy if exists nffga_gear_listings_insert on public.nffga_gear_listings;
create policy nffga_gear_listings_insert on public.nffga_gear_listings
  for insert to authenticated
  with check (seller_id = auth.uid());

drop policy if exists nffga_gear_listings_update on public.nffga_gear_listings;
create policy nffga_gear_listings_update on public.nffga_gear_listings
  for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists nffga_gear_listings_delete on public.nffga_gear_listings;
create policy nffga_gear_listings_delete on public.nffga_gear_listings
  for delete to authenticated
  using (seller_id = auth.uid() and status in ('active', 'withdrawn'));

-- Guests browse; they never list. RESTRICTIVE, so it ANDs with the above.
drop policy if exists nffga_gear_listings_no_guests on public.nffga_gear_listings;
create policy nffga_gear_listings_no_guests on public.nffga_gear_listings
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());

-- Photos, public face: photos of a listing anyone may browse.
drop policy if exists nffga_gear_photos_public_read on public.nffga_gear_photos;
create policy nffga_gear_photos_public_read on public.nffga_gear_photos
  for select to anon, authenticated
  using (exists (
    select 1 from public.nffga_gear_listings l
    where l.id = listing_id and l.status in ('active', 'pending')
  ));

-- Photos, private face: they follow whatever listing the caller can see
-- (the listing's own read policies gate which listings resolve).
drop policy if exists nffga_gear_photos_own_read on public.nffga_gear_photos;
create policy nffga_gear_photos_own_read on public.nffga_gear_photos
  for select to authenticated
  using (exists (select 1 from public.nffga_gear_listings l where l.id = listing_id));

drop policy if exists nffga_gear_photos_write on public.nffga_gear_photos;
create policy nffga_gear_photos_write on public.nffga_gear_photos
  for all to authenticated
  using (public.nffga_is_gear_seller(listing_id, auth.uid()))
  with check (public.nffga_is_gear_seller(listing_id, auth.uid()));

-- Offers: the buyer and the seller see them; nobody else, never anon.
drop policy if exists nffga_gear_offers_read on public.nffga_gear_offers;
create policy nffga_gear_offers_read on public.nffga_gear_offers
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or public.nffga_is_gear_seller(listing_id, auth.uid())
  );

-- A buyer offers on an active listing they do not own.
drop policy if exists nffga_gear_offers_insert on public.nffga_gear_offers;
create policy nffga_gear_offers_insert on public.nffga_gear_offers
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and status = 'open'
    and exists (
      select 1 from public.nffga_gear_listings l
      where l.id = listing_id and l.status = 'active' and l.seller_id <> auth.uid()
    )
  );

-- A buyer may only withdraw. Accept / decline go through the RPCs below,
-- which run as the seller and are the only path that touches the listing.
drop policy if exists nffga_gear_offers_buyer_withdraw on public.nffga_gear_offers;
create policy nffga_gear_offers_buyer_withdraw on public.nffga_gear_offers
  for update to authenticated
  using (buyer_id = auth.uid() and status = 'open')
  with check (buyer_id = auth.uid() and status = 'withdrawn');

drop policy if exists nffga_gear_offers_no_guests on public.nffga_gear_offers;
create policy nffga_gear_offers_no_guests on public.nffga_gear_offers
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());


-- ── 6. The seller's moves ────────────────────────────────────────────

-- Accept one offer: it becomes accepted, every other open offer on the
-- listing is declined, the listing parks as pending. Seller only.
create or replace function public.nffga_accept_gear_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.nffga_gear_offers;
  l public.nffga_gear_listings;
begin
  select * into o from public.nffga_gear_offers where id = p_offer_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into l from public.nffga_gear_listings where id = o.listing_id for update;
  if l.seller_id is distinct from auth.uid() then return jsonb_build_object('ok', false, 'error', 'not_seller'); end if;
  if l.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'listing_not_active'); end if;
  if o.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'offer_not_open'); end if;

  update public.nffga_gear_offers set status = 'accepted', responded_at = now() where id = o.id;
  update public.nffga_gear_offers set status = 'declined', responded_at = now()
    where listing_id = l.id and status = 'open' and id <> o.id;
  update public.nffga_gear_listings set status = 'pending', accepted_offer_id = o.id where id = l.id;

  return jsonb_build_object('ok', true, 'listing_id', l.id, 'buyer_id', o.buyer_id);
end; $$;
revoke all on function public.nffga_accept_gear_offer(uuid) from public, anon;
grant execute on function public.nffga_accept_gear_offer(uuid) to authenticated;

-- Decline one open offer. Seller only.
create or replace function public.nffga_decline_gear_offer(p_offer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.nffga_gear_offers;
begin
  select o2.* into o from public.nffga_gear_offers o2
    join public.nffga_gear_listings l on l.id = o2.listing_id
    where o2.id = p_offer_id and l.seller_id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if o.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'offer_not_open'); end if;
  update public.nffga_gear_offers set status = 'declined', responded_at = now() where id = o.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_decline_gear_offer(uuid) from public, anon;
grant execute on function public.nffga_decline_gear_offer(uuid) to authenticated;

-- Close the deal. The listing goes sold / traded / given according to
-- the accepted offer's kind; the offer goes completed. Seller only.
create or replace function public.nffga_complete_gear_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.nffga_gear_listings;
  o public.nffga_gear_offers;
  final_status text;
begin
  select * into l from public.nffga_gear_listings where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if l.status <> 'pending' or l.accepted_offer_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_accepted_offer');
  end if;
  select * into o from public.nffga_gear_offers where id = l.accepted_offer_id;

  final_status := case
    when l.trade_type = 'giveaway' or o.kind = 'claim' then 'given'
    when o.kind = 'trade' then 'traded'
    else 'sold'
  end;

  update public.nffga_gear_offers set status = 'completed', responded_at = now() where id = o.id;
  update public.nffga_gear_listings set status = final_status, closed_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'status', final_status);
end; $$;
revoke all on function public.nffga_complete_gear_listing(uuid) from public, anon;
grant execute on function public.nffga_complete_gear_listing(uuid) to authenticated;

-- Back out of an accepted offer: the listing returns to active, the
-- offer is declined. Seller only (a buyer who wants out just says so
-- in Messages; the seller reopens).
create or replace function public.nffga_reopen_gear_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.nffga_gear_listings;
begin
  select * into l from public.nffga_gear_listings where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if l.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  if l.accepted_offer_id is not null then
    update public.nffga_gear_offers set status = 'declined', responded_at = now() where id = l.accepted_offer_id;
  end if;
  update public.nffga_gear_listings set status = 'active', accepted_offer_id = null where id = l.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_reopen_gear_listing(uuid) from public, anon;
grant execute on function public.nffga_reopen_gear_listing(uuid) to authenticated;


-- ── 7. Storage bucket: nffga-gear (public read) ──────────────────────
-- A public bucket serves objects by URL without any SELECT policy, so
-- reads need none. Writes: only inside your own top-level folder.

insert into storage.buckets (id, name, public)
values ('nffga-gear', 'nffga-gear', true)
on conflict (id) do nothing;

-- The storage API needs SELECT on your own objects to upsert or remove
-- them. Scoped to your own folder; public reads go by public URL.
drop policy if exists nffga_gear_objects_select on storage.objects;
create policy nffga_gear_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'nffga-gear' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists nffga_gear_objects_insert on storage.objects;
create policy nffga_gear_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nffga-gear'
    and not public.nffga_is_guest()
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists nffga_gear_objects_update on storage.objects;
create policy nffga_gear_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'nffga-gear' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'nffga-gear' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists nffga_gear_objects_delete on storage.objects;
create policy nffga_gear_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'nffga-gear' and split_part(name, '/', 1) = auth.uid()::text);

commit;

-- DONE.
