# NFFGA build contract (2026-10-04)

The shared agreement between the people and agents building NFFGA's first
public version. If you change a name here, change it everywhere.

## The product rule

Anyone who scans the NFFGA QR code lands on the home page and can look around
with **no sign-in**: tournaments, the gear trade, the clubhouse board, member
profiles. **Posting, offering, registering and messaging need an account.**
Creating one is email + password + a display name, nothing more.

Admins (super admin Cameron, managing admin Tim O'Reilly) sign in the same way
and reach `/admin`. Admin seats are claimed only by emailed link — see
`supabase/migrations/102_nffga_admins.sql`, already live.

## The database

Project `avepftawrkwytlohobjh` (EMSPCR). **Shared** with EMSPCR and Car56: one
`auth.users`, EMSPCR owns `public.profiles`, `handle_new_user()`, and a
sign-up allowlist trigger. NFFGA therefore:

- prefixes **every** table, view, function, trigger, policy and bucket with
  `nffga_` / `nffga-`,
- references `auth.users(id)` directly — never `public.profiles`, never
  HereToo's `families`,
- never `create or replace`s a function it did not create,
- is the ONLY thing NFFGA migrations may touch, with one sanctioned exception:
  the sign-up gate (migration 106).

HereToo's migrations 001–101 are **not** applied and will not be for this
version. Nothing NFFGA ships may depend on them.

Public (signed-out) reads go through the `anon` role. Every table that the home
page shows has an explicit `to anon, authenticated` SELECT policy limited to
public rows.

### Tables

| Table | Purpose | anon can read |
|---|---|---|
| `nffga_profiles` | one row per member: `user_id` pk, `display_name`, `department`, `rank_title`, `city`, `state`, `handicap`, `bio`, `avatar_path`, `created_at`, `updated_at` | yes |
| `nffga_posts` | clubhouse board: `id`, `author_id`, `body`, `photo_path`, `kind` ('post'\|'announcement'), `created_at`, `deleted_at` | yes, not deleted |
| `nffga_comments` | `id`, `post_id`, `author_id`, `body`, `created_at`, `deleted_at` | yes, not deleted |
| `nffga_gear_listings` | see 103: title, description, category, brand, model, condition, handedness, specs jsonb, trade_type, price_cents, trade_for, shipping, location_text, status, seller_id, created_at | yes, status active/pending |
| `nffga_gear_photos` | `id`, `listing_id`, `path` (bucket `nffga-gear`), `position` | yes, with its listing |
| `nffga_gear_offers` | buyer offers; seller RPCs accept/decline/complete/reopen | no |
| `nffga_tournaments` | see 104: the full logistics sheet | yes, status not draft |
| `nffga_tournament_*` | staff, teams, registrations, waiver signatures (append-only), tee times, scores | roster + leaderboard views only |
| `nffga_threads`, `nffga_thread_members`, `nffga_messages` | direct messages, optionally about a gear listing | no |

### RPCs the app calls

| RPC | Who | Returns |
|---|---|---|
| `nffga_ensure_profile(p_display_name text)` | signed in | the caller's `nffga_profiles` row, created if missing |
| `nffga_start_thread(p_other uuid, p_body text, p_gear_listing_id uuid default null)` | signed in | `{ ok, thread_id }` — reuses an existing 1:1 thread about the same listing |
| `nffga_accept_gear_offer`, `nffga_decline_gear_offer`, `nffga_complete_gear_listing`, `nffga_reopen_gear_listing` | seller | `{ ok, ... }` |
| `nffga_register_for_tournament(p_tournament_id, p_details jsonb, p_signed_name, p_user_agent)` | signed in | `{ ok, registration_id, status }` |
| `nffga_withdraw_from_tournament`, `nffga_sign_tournament_waiver`, `nffga_check_in_player` | as in 104 | |
| `claim_admin_seat`, `designate_admin`, ... | as in 102 (already live, unprefixed — leave them) | |

Storage buckets: `nffga-gear` (public read, write own folder), `nffga-media`
(public read; posts and tournament covers; write own folder or tournament
managers).

### Sign-up

`supabase.auth.signUp({ email, password, options: { data: { app: 'nffga', display_name } } })`.
The `app: 'nffga'` key is what EMSPCR's allowlist gate (106) lets through. The
project auto-confirms email, so a session comes back immediately; the client
then calls `nffga_ensure_profile`.

## The app

Expo Router, web first. All NFFGA data access lives in `lib/nffga/*` and uses
the types in `lib/nffga/types.ts`. Screens use the existing tokens in
`constants/colors.ts` and `constants/design.ts` and the components in
`components/shared` (Button, Eyebrow, Logo). Monochrome; no new colours.

HereToo's screens (`(tabs)`, `messages`, `hunt`, `network`, `rooms`, `u`,
`join`, `add`, `welcome/[token]`, `shelf`) are NOT part of this version and must
not be linked from NFFGA navigation. Leave the files; just do not route to them.

### Routes

| Route | Owner | Signed out |
|---|---|---|
| `/` | shell | home: hero, upcoming tournaments, latest gear, latest board posts |
| `/tournaments`, `/tournaments/[id]` | events agent | browse, read everything; Register asks to sign in |
| `/tournaments/[id]/register` | events agent | redirects to sign in |
| `/gear`, `/gear/[id]` | events agent | browse; Make offer / Message seller ask to sign in |
| `/gear/new`, `/gear/[id]/edit` | events agent | redirects to sign in |
| `/board`, `/board/[id]` | community agent | read; compose asks to sign in |
| `/inbox`, `/inbox/[threadId]` | community agent | redirects to sign in |
| `/members/[id]` | community agent | public profile |
| `/account` | community agent | redirects to sign in |
| `/signin`, `/join` | shell | sign in / create account; `?next=` returns afterwards |
| `/admin` | already built | |

### File ownership (do not edit files you do not own)

- **shell**: `app/index.tsx`, `app/_layout.tsx`, `app/signin.tsx`, `app/join.tsx`,
  `app/(auth)/welcome.tsx`, `components/nffga/SiteHeader.tsx`,
  `components/nffga/SiteFooter.tsx`, `components/nffga/HomeScreen.tsx`,
  `components/nffga/RequireAccount.tsx`, `lib/nffga/auth.ts`,
  `lib/nffga/useSession.ts`.
- **events agent**: `app/tournaments/**`, `app/gear/**`,
  `components/nffga/tournaments/**`, `components/nffga/gear/**`,
  `lib/nffga/tournaments.ts`, `lib/nffga/gear.ts`,
  and the home sections `components/nffga/home/TournamentsSection.tsx`,
  `components/nffga/home/GearSection.tsx`.
- **community agent**: `app/board/**`, `app/inbox/**`, `app/members/**`,
  `app/account.tsx`, `components/nffga/board/**`, `components/nffga/inbox/**`,
  `lib/nffga/board.ts`, `lib/nffga/messages.ts`, `lib/nffga/profile.ts`,
  and `components/nffga/home/BoardSection.tsx`.
- **database agent**: `supabase/migrations/103_*`..`106_*` only.
- `lib/nffga/types.ts` and this file: change only by agreement; add, don't rename.

### Helpers every screen may use (from the shell)

```ts
import { useSession } from '../lib/nffga/useSession';     // { session, userId, loading }
import { RequireAccount } from '../components/nffga/RequireAccount';
// <RequireAccount reason="to post">...</RequireAccount> renders children when
// signed in, otherwise a short prompt with Sign in / Create account buttons
// that return to the current route.
import { signInHref } from '../lib/nffga/auth';           // signInHref('/gear/123') -> '/signin?next=%2Fgear%2F123'
```
