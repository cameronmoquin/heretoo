# HereToo — Project Brief

**For Claude (or any new collaborator).** Paste this whole document as context to bring a fresh model session up to speed on what HereToo is, who's building it, what works today, what's still ahead, the brand voice, and the tech stack. Self-contained — no other files needed to onboard.

**Last updated:** 2026-04-29

---

## 1. Why this exists

Cameron Moquin's brother is in the hospital. The family is spread across the country and needs a centralized place to share medical updates, photos, video, and stay close while it matters most. Existing tools fail at this:

- **Group chats** fragment by phone OS and surface nothing more than the last message.
- **Facebook** is older relatives only and the algorithm punishes private family content.
- **Instagram and TikTok** reward outrage and performance, not connection.

HereToo flips the assumption: **family is the unit, not the individual user.** You're inside family circles before you're a public profile, and the public common area only opens up once you've earned trust by being in at least one family graph.

---

## 2. What it is

A bridging social platform with two halves:

### Family circles (private, invite-only)
Photos, video, posts, chat, comments. The medical-update use case lives here. Each family has an 8-character invite code and a shareable link (`https://heretoo.social/join/<CODE>`). One tap from the link, two text fields, the new user is in.

### The common area (public feed at heretoo.social)
Anyone in at least one family can post here. The algorithm boosts posts from people in your transitive family network (≤3 hops out) before truly-public posts, so the people closest to you surface first. There's no outrage incentive built in.

### The connective tissue: the family graph
Joining a family auto-creates "connections" with everyone else in that family AND with everyone in any other families they belong to, up to 3 hops out. No friend requests, no paywall, no algorithmic gatekeeping. The block list is the only "no."

### Art, not ads (yet)
Public-domain artwork from major museums (Met, Art Institute of Chicago, Rijksmuseum) is slotted between posts as ambient gallery content. The same slot is reserved for future non-toxic, user-approved ads. A $5/mo subscription will eventually remove ads — but the art stays either way. Art is the point, not the monetization vector.

---

## 3. Ownership and stage

### Stage: lemonade stand
HereToo is currently operated by Cameron personally. No revenue, no entity, no employees. The codebase is at `github.com/cameronmoquin/heretoo`. The web product is live at `heretoo.social`. An Android preview APK is available via a shareable EAS link. iPhone distribution is pending Apple Developer Program enrollment.

### Ownership intent
Cameron will form HereToo LLC once the first ad sale lands or by a separately-agreed calendar deadline. The structure being drafted:

- **60% Cameron** (Class A — sole voting class, sole manager)
- **20% Brother 1** (Class B — non-voting profit share)
- **20% Brother 2** (Class B — non-voting profit share)

Dual-class structure mirrors Google / Meta / Snap at family scale: Cameron retains operational control unambiguously; the brothers participate fully in profit. The brothers are not expected to contribute labor — this is a profit-sharing arrangement to lift them from unhoused into stable comfort as HereToo grows.

LLC will default to partnership taxation (pass-through). When revenue justifies it (~$50k/yr), the LLC will elect S-corp tax treatment via IRS Form 2553. Not a C-corp unless an institutional investor ever requires it.

---

## 4. Brand and tone

### Logo
"HT" stylized as a family tree:
- Two outer verticals = the H's posts and a tree's twin trunks
- One thick crossbar shared by both letters
- A central stem rising **upward** from the crossbar = the T's vertical AND the tree growing skyward
- A small dot at the apex = the canopy bud
- Subtle root flares at the base of each trunk

Two trunks joining at a crossbar with a stem rising from them is the family-tree metaphor: parents → child. Reads as "HT" and as a tree silhouette. Original geometry, not derived from any existing brand vocabulary. Single-color, theme-reactive (drawn from `<View>` rectangles + a circle, no SVG dependency).

### Type
Inter (regular, medium, semibold, bold) for body. Section labels: uppercase with letter-spacing 1.2–1.4.

### Palette (post-2026-04-29 sweep)

**Dark mode** — warm graphite, not pitch black:
- Background `#1A1A24`
- Surface `#23232F`
- Surface light `#2C2C3A`
- Border `#3A3A4A`

**Light mode** — warm paper-tone, not stark white:
- Background `#EAE9EE`
- Surface `#F4F3F7`
- Surface light `#E1E0E6`
- Border `#C8C7D0`

**Accent (both themes):** electric blue with a hint of purple, `#4F6EFF` (dark) / `#3B5AE8` (light).

**Brand reserves:** ivory `#F0EEE8`, gold `#E8C97A`, dark `#0A0A0F`.

### Voice
- **Plainspoken, warm, slightly understated.** Never marketingese.
- **Specific, not abstract.** "7-second videos with both cameras at once, comments that actually nest" beats "rich media features."
- **Acknowledge the problem honestly.** People know existing platforms are exhausting. Don't pretend they don't. "Built because group chats and Facebook weren't doing it" is honest and lands.
- **Family is the lead.** Not "social network" — "family-first social." The common area is the spillover from family, not the headline.
- **Pricing copy:** "Free, with ads that won't insult you. Or $5/month to skip them. The art stays either way."

### What HereToo is NOT
Outrage farm. Dating app. Attention-economy hellscape. AI-slop generator. BeReal clone. The "Two-Way" dual-camera capture is named that on purpose — BeReal is trademarked.

---

## 5. What works today

### Auth and onboarding
- Email + password sign-up and sign-in (Supabase Auth)
- Apple Sign-In on iOS
- **Express signup on invite links**: click `/join/<CODE>` → see family preview (cover, name, description) → enter email + password → handle is auto-generated from the email's local-part → land in the family. No handle/display-name picker forced up-front.
- Auto-created profile + notification prefs row via DB trigger. Handle uniqueness handled with a numeric suffix loop.

### Family circles
- Create a family (name, description, cover photo, public/private flag)
- Invite by 8-char code or shareable `/join/<CODE>` link
- Mobile native share sheet on phones, clipboard fallback on desktop
- Anon-readable family preview RPC (`find_family_by_invite_code`) so the link works for never-signed-in visitors
- Join via code or link
- Leave (owners can't leave — they must delete instead)
- Family detail page with tabs: Feed, About
- Member list

### Public feed (the common area)
- For You + Connections tabs (For You = chronological public; Connections = family-network-weighted with closer hops first)
- Network stats banner ("X people in your network · Y families connected") tappable to families list
- Inline `New Post` composer pinned to the top of the feed (and inside every family page — same component, different scope prop)
- Posts: text up to 2000 chars, photos (HEIC→JPEG normalized), 7-second videos via Mux, Two-Way capture, One-Way capture, @-tag any of your network connections
- Hearts with optimistic UI
- Boosts ("forwarding") with caller-chosen scope: public / connections / specific family
- **Infinite-depth comment threads** (replies-to-replies-to-replies) with visual indent capped at 4 levels
- Per-post `comments_disabled` toggle (owner-only)
- Owner can delete own posts and own comments
- Art slot every 6 posts (~500 artworks seeded from Met + AIC)

### Cameras
- **One-Way** — single-camera live capture with a flip toggle (back ↔ front), in-app shutter, JPEG output. Works on mobile web (sequential getUserMedia) and native (Vision Camera).
- **Two-Way** — dual-camera capture. Native iOS/Android via `react-native-vision-camera` runs both cameras simultaneously through `AVCaptureMultiCamSession` (iOS XS+) or Camera2 logical multi-cam (Android flagships). Mobile web does sequential capture (back → flip → front → composite) on **one shutter tap** so the user never has to tap twice. Desktop browsers see "Two-Way is a phone thing" stub.
- 7-second video cap enforced client-side and server-side via Mux.
- Compositing on web uses canvas; on native uses `react-native-view-shot` to capture an offscreen View tree.

### Direct messages
- 1:1 chat threads with realtime delivery (Supabase `postgres_changes` subscriptions per thread)
- Thread list with last-message preview + relative timestamps
- Contact picker (`/chat/new`) showing your network plus an out-of-network search by `@handle`
- **>3-hop approval gate**: DMing someone outside your family network creates a `pending` thread. Initiator may send one intro message; recipient sees Accept/Decline UI before further messages can flow. Enforced both at RLS layer and in UI.

### Profile hub (mobile bottom-nav center)
- Avatar, display name, handle, bio, edit button
- Network stats card (people / families connected / your families)
- Families list with tap-through
- Quick actions: Messages, Write a post, Join with code, Theme toggle, Sign out

### Mobile navigation
- Bottom nav: **Feed | Profile** (Upload tab dropped — composer is inline)
- Feed header has icons for Messages, Families, Theme toggle, Sign out
- Family pages have a "← HereToo" back button

### Theme
- Dark / light toggle, Zustand-persisted
- Per-render `makeStyles()` factory pattern so palette flips instantly without reload
- `key={themeMode}` on root view forces clean remount

### Web platform
- Service worker (network-first HTML, cache-first fingerprinted assets, stale-while-revalidate on Supabase REST GETs)
- PWA install prompt with Android Chrome + iOS Safari handling
- "Add to Home Screen" hint on iOS

### Native platform
- EAS build profiles: development, development-device, preview, production
- Android preview APK distributable via shareable EAS install link (no Play Store needed)
- iOS simulator dev build available; iOS device build pending Apple Developer Program enrollment ($99/yr)

### Backend (Supabase Postgres)
Comprehensive RLS:
- Posts gated by visibility: `family` requires membership, `connections` requires being in the author's 3-hop reach, `public`/`connections` require the author to be in at least one family (the anti-spam earned-trust gate)
- Family invite lookup: SECURITY DEFINER RPC, anon-callable
- Block list bidirectional, blocked users excluded from network reach
- Direct messages: `pending` thread allows the initiator only one intro message
- Comments: `comments_disabled` post flag blocks new inserts at the policy level

Helpers:
- Recursive CTE `family_network_reach(viewer, max_depth)` returns all profiles reachable in N hops (default 3), excluding blocked
- `my_network_stats()` for the banner numbers
- Denormalized counters on posts (heart_count, boost_count, comment_count) kept honest by triggers
- Auto-create profile + notification prefs on auth.users insert
- Auto-add owner as active family_member on families insert
- Auto-handle generation from email local-part with uniqueness loop
- All migrations idempotent (`drop policy if exists`, `create or replace function`, `add column if not exists`)

### Video
- Mux video upload via Netlify Function (server-only credentials, JWT-gated)
- `mp4_support: 'standard'` so browsers can play MP4 directly
- Thumbnails via `https://image.mux.com/{playbackId}/thumbnail.jpg`

---

## 6. What's still to do

### Distribution
- Apple Developer Program enrollment ($99/yr) and TestFlight build for iPhone family
- Google Play Internal Testing track ($25 one-time) for permanent Android install link beyond the 14-day EAS preview
- Eventually: full Play Store + App Store public listings

### Roadmap features
- **Medical-updates tab** — dedicated section type within a family for the original use case (currently lives in the regular feed)
- **Email digest** via Resend for family who don't open the app — deferred per Cameron
- **SMS notifications** via Twilio for high-priority family events — deferred
- **Realtime feed updates** so new posts appear in For You / Connections without manual refresh (already done for chat)
- **Inline comment preview** on feed cards instead of comments only on detail page
- **Subscription system** — $5/mo to remove ads (`profiles.ad_free_until`, Stripe Checkout)
- **Ad approval flow** — `art_works.source='ad'` rows need `approved_at` + `approved_by` admin gate before rendering
- **Settings expansion** — notification preferences, blocked users management, account deletion, data export
- **Search** — find posts, find people by handle, find families by name (partial @handle search exists in chat picker)
- **Profile pages for other users** — currently only own profile is rendered

### Polish
- Mux player controls UI consistency between feed cards and post detail
- Image lightbox on post detail
- Pull-to-refresh on family page feed
- Loading skeletons instead of spinners
- Push notifications for new family posts, new chat messages, new comments

### Long-shot
- Voice notes in chat
- Polls in family circles
- Shared calendar / events
- Family tree visualization (the literal graph)
- Apple Photos / Google Photos batch import

---

## 7. Tech stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | React Native + Expo SDK 54 + Expo Router | Single codebase for iOS / Android / web with file-based routing |
| State (server) | TanStack Query | Optimistic updates, cache invalidation, retries |
| State (client) | Zustand | Tiny, persisted, no provider noise |
| Auth + DB + Storage + Realtime | Supabase | Postgres + RLS in one |
| Video | Mux | Server-side direct-upload URL via Netlify Function |
| Native cameras | react-native-vision-camera v4 + react-native-view-shot | Multi-cam on iPhone XS+ / Camera2 logical multi-cam on Android, view-shot for compositing |
| Hosting (web) | Netlify | Auto-deploys from `master` |
| Native builds | EAS | Cloud builds + shareable install links |
| Icons | Ionicons via @expo/vector-icons | One pack, broad coverage |
| Type checking | TypeScript strict | Catches the dumb stuff before it ships |

---

## 8. Repository

- **Code:** `github.com/cameronmoquin/heretoo`, branch `master`
- **Local dev:** `C:\Documents\HereToo\`
- **Web production:** https://heretoo.social (auto-deploys from `master`)
- **Expo project:** https://expo.dev/accounts/cameronmoquin/projects/heretoo
- **Supabase:** managed via dashboard; service-role key + URL stored in `.env` (gitignored) and Netlify env vars

### Key directories
```
app/                    Expo Router routes (file-based)
  (auth)/               Welcome, profile-setup
  (tabs)/               Bottom-nav tabs (feed, profile)
  family/               /family/, /family/[id], /family/join, /family/new
  join/                 /join/[code] — shareable invite landing
  chat/                 /chat/, /chat/new, /chat/[threadId]
components/
  feed/                 PostCard, FeedList, FeedComposer, ArtSlot
  upload/               OneWayCapture, TwoWayCapture (web + native variants)
  shared/               Logo, Avatar, Button, ErrorBoundary, ...
hooks/                  Data hooks: useFeed, useChat, useFamily, useComments, useUpload, useArtFeed, ...
lib/                    supabase, mux, alert, dev-mode, ...
stores/                 authStore, feedStore, themeStore (Zustand)
constants/              colors (mutable for theme swap), design (spacing, radius)
supabase/migrations/    001_foundation through 008_invite_lookup_anon (idempotent)
netlify/functions/      mux-upload-create
public/                 sw.js, manifest, icons
scripts/                ingest-art.mjs (museum ingestion)
```

### Migrations (in order, all idempotent)
1. **001_foundation.sql** — profiles, families, family_members, message_threads, messages, posts, post_media, art_works, RLS, auto-create-profile trigger
2. **002_engagement.sql** — post_reactions, post_boosts, comments, post_views, denormalized counters
3. **003_family_network.sql** — profile_blocks, recursive `family_network_reach`, updated posts visibility, `get_connections_feed`, `my_network_stats`
4. **004_family_invite_codes.sql** — adds `families.invite_code` column
5. **005_public_posting_requires_family.sql** — RLS gate: public/connections posting requires active family membership
6. **006_infinite_comments.sql** — drops 1-level constraint, adds `posts.comments_disabled`
7. **007_thread_approval.sql** — `message_threads.status` (open/pending/declined), `viewer_is_in_network` helper, tightened messages_send policy
8. **008_invite_lookup_anon.sql** — `find_family_by_invite_code` RPC callable by anon, auto-handle generation in `handle_new_user`

---

## 9. How to talk about HereToo (marketing copy guidance)

- **Lead with the family.** Not "social network" — "family-first social." The common area is the spillover from family, not the headline.
- **Plainspoken, no superlatives.** "Stay close to the people you love" beats "Revolutionize your social experience." Avoid: "AI-powered," "next-gen," "engagement-driven."
- **Use the family-tree metaphor when it lands naturally.** Don't beat people over the head. The logo carries it; copy doesn't have to.
- **Acknowledge the problem.** People know existing platforms exhaust them. "Built because group chats and Facebook weren't doing it" is honest and lands.
- **Be specific.** "7-second videos, photos with both cameras at once, comments that actually nest" beats "rich media features."
- **Pricing:** "Free, with ads that won't insult you. Or $5 a month to skip them. The art stays either way."
- **The brother who started it** (the literal reason this exists) can be mentioned in personal/founder-voice copy but probably not in app store listings — keep that for the user-facing about page or a manifesto.

---

## 10. Quick orientation for new collaborators

If you're a new Claude or human collaborator:

1. **The product is real and live.** It's not a spec; pulling from `master` and running `npx expo start --web` should give you a working app pointed at production Supabase.
2. **The codebase is small but well-organized.** Routes are file-based via Expo Router. Hooks are the data layer. Components are mostly under 300 lines.
3. **Migrations are idempotent.** Re-running any of them is safe. New work that needs schema changes goes in a new numbered migration.
4. **Theme palette is mutable** at runtime via `setColorMode()`. Components use the `Colors` import as a static; root view's `key={themeMode}` forces clean re-mount when it flips.
5. **`StyleSheet.create()` runs once per render** (called inside a `makeStyles()` function inside the component) so palette changes propagate immediately. If you copy-paste a component and forget this pattern, theme toggling breaks.
6. **Cameras are platform-split** via Metro's `.web.tsx` extension resolution. Vision Camera (native) only ships in native bundles. Don't import vision-camera in any file the web bundle reaches.
7. **The brand voice matters.** When writing UI copy, error messages, or marketing, follow Section 4. When in doubt: would Cameron's grandmother smile reading this? If not, redo.

---

*This brief is a living document. Update it when the product changes.*
