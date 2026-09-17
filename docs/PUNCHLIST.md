# HereToo — Punch List

*Reconciled against the codebase, not the stale brief. Strategy lens:
`docs/STRATEGY.md`. Last reviewed 2026-06-09.*

Grouped by what unblocks the most value. A — D — E roughly = do-first to
do-later. Items that need Cameron's accounts/credentials are marked
**(Cameron)** — an autonomous agent should surface these, not attempt
them.

---

## A — Memoir: PARKED (2026-09-16)

Cameron retired the room. Every door is gone — sidebar, More grid, and
the journal's send arrow (the journal now encrypts everything, so a
plaintext export to the memoir contradicted its promise anyway). Routes
and data stay; nothing points at them. The render-worker items below
are parked with it, as is A2 (the résumé) — both revive if the room
does. The platform's writing surface is the Journal now, and the feed
is turning educational (FSOT) — see the plan at the punch list's foot.

## A (parked) — Blocking the memoir payoff (the printed book)

The memoir is usable for *writing and reading* today, but "Make the
book" fails until the render pipeline is live. `memoir-render.ts` marks
every render `failed` with "Render worker not configured" until both
vars below are set.

- [ ] **(Cameron)** Deploy `render-worker/` on Render.com (see its
      README). First build is slow (TeX Live + fonts).
- [ ] **(Cameron)** Set `MEMOIR_RENDER_WORKER_URL` + `MEMOIR_RENDER_SECRET`
      on Netlify; set the same `MEMOIR_RENDER_SECRET` (+ Supabase vars)
      on Render. The secret must match on both sides.
- [ ] **(Cameron)** Verify migrations 042–051 are applied in prod and
      the `memoir-books` + `memoir-assets` storage buckets exist.
- [ ] Order one physical proof (~$4 KDP) to validate the interior PDF.
- [x] In-app book preview (`/memoir/preview`).
- [x] Arrange/reorder + reassign entries (`/memoir/arrange`).

## A2 (parked with the room) — Memoir: the résumé that falls out of it

Requested 2026-08-18. The memoir interview already collects the raw
material of a working life; a CV is a second rendering of the same
answers rather than a separate thing to fill in.

- [ ] **Résumé / CV writer driven by the memoir's own inputs.** Reads
      the structured interview (employers, dates, places, roles) and
      composes a CV from it, rather than asking again. Sits alongside
      the book as a second output of one corpus. Cameron writes any
      user-facing wording.
- [ ] **Tax-document upload as a shortcut into that résumé.** W-2s and
      1099s carry employer names and employment dates, which are the
      two fields people are worst at recalling. Parse those, ignore
      everything else.
- [ ] **Redaction guidance before upload, and it must be advice, not
      silence.** Recommend the user black out dollar amounts and any
      personal identifiers (SSN, full address, account numbers) — none
      of that is needed for a CV. Cameron writes the wording; the point
      is that the app must not accept a full unredacted tax form as if
      that were normal.
- [ ] Open question for Cameron: whether the uploaded document is ever
      stored at all, or parsed in the browser and discarded. Storing
      tax forms is a materially different security posture from storing
      photos, and the answer decides the design. Defaulting to
      never-stored costs nothing and is the safer starting point.

## A3 — Letters: REMOVED (2026-08-19)

Cameron: "i think we need to delete the 'letters' option fully." Done —
routes (app/letter/), hook, the deliver-letters cron worker, and both
nav entries are gone; /letter redirects 302 to the feed for links in
old emails. The letters tables keep their data; nothing reads them.
The print-and-mail research (Lob / PostGrid / Handwrytten, ~$0.90–5 per
letter) is preserved in git history at this heading if a physical-mail
successor is ever wanted.

## A4 — Video calls on the native build

Reported 2026-08-21: "video calling is not functioning — at least from
the Jude-a-phone." Not a bug — an architectural gap: the call screen is
WebRTC through browser APIs, and on native it deliberately renders a
placeholder tile (app/call/[id].tsx, Platform.OS !== 'web'). The phone
cannot call until the native build carries real WebRTC.

- [ ] Add react-native-webrtc + config plugin; new EAS build (JS-only
      OTA cannot deliver a native module).
- [ ] Port the call screen's getUserMedia/RTCPeerConnection paths to
      the react-native-webrtc equivalents behind a Platform fork.
- [ ] Until then: calls work in any browser, including the phone's
      browser at heretoo.social — the installed PWA can call; the
      kiosk APK cannot.

## B — Confirm which keys are live in prod (Cameron / Netlify dashboard)

Each feature has a graceful "not configured" path, so an unset key just
means that capability is silently off. Confirm in the Netlify env UI:

- [ ] `ANTHROPIC_API_KEY` — Socratic interview follow-ups + co-writer
      polish + grammar editor + reframer. (Interview still works with
      canned follow-ups if unset.)
- [ ] `TRANSCRIBE_API_KEY` / `TRANSCRIBE_API_URL` / `TRANSCRIBE_MODEL` —
      voice typing in the memoir.
- [ ] `ELEVENLABS_API_KEY` — read-aloud (TTS) and STT.
- [ ] `RESEND_API_KEY` — email digests, letters, welcome mail.
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
      `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` —
      subscriptions + donation checkout.
- [ ] `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` — video upload/playback.
- [x] Document all of the above in `.env.example`.

## C — Strategy-aligned product work

Tied to `docs/STRATEGY.md`. These are where the disruption thesis turns
into product.

- **"Something's happening" — now lives in Subjects, not Updates.**
      Migration 028 (Milestone 3) retired the Updates *tab* in favor of
      **Subjects** (long-running family-story threads — "Tim's surgery").
      That's the live surface for the origin use case.
  - [x] **In-app realtime alert on Subject activity** — a "New" dot on
        the Subjects tab + per-subject, for subjects you follow, the
        moment a post lands (realtime, client-side last-seen, no
        migration). `lib/subjects-activity.ts`, `subjectsSeenStore`,
        `useSubjectsNewActivity`. The "win the moment" gap, in-app half.
  - [x] Cleaned up the orphaned `kind='update'` remnants in the family
        page (unused `useFamilyUpdates` fetch + dead `UpdateCard`).
  - [ ] **Email-per-update / per-subject-post** — instant email when a
        followed subject gets a post. Buildable now; can't be validated
        until the Resend domain is verified (below). push/SMS later.
  - [ ] **(Cameron)** Verify `heretoo.social` in Resend + switch
        `FROM_EMAIL` off the `onboarding@resend.dev` sandbox — until
        then NO family email (digest or otherwise) reaches anyone but
        the account owner. Blocks all email in production.
  - [ ] **Decide the fate of the composer's "Update" toggle** — it
        still produces `kind='update'` posts, which now render in no
        in-app surface (feed filters them out, Updates tab is gone).
        Either fold it into Subjects or remove it. (Left as-is; needs a
        product call.)
- [ ] **Platform-wide elder mode** — extend the memoir's large-serif /
      read-aloud / Aa accessibility to the whole app. The grandmother is
      the acquisition engine; most of the app isn't grandma-optimized.
- [ ] **Calm audit (a cut, not an add)** — keep family the default
      landing surface; make Loft/news clearly secondary/opt-in;
      reconsider whether the national-news room belongs at all (it's the
      most calm-violating, least-family surface in the app).
- [ ] **North-star metric** — instrument PostHog around "a family
      reaches N active members across 2+ generations," not DAU/session
      time.
- [ ] **Invite-funnel polish + printed welcome card** — distribution is
      the family graph; every invite is a warm kinship referral.
      Optimize "one tap to get grandma in."

## D — Distribution (Cameron)

- [ ] Apple Developer Program enrollment ($99/yr) + TestFlight build
      (iPhone family).
- [ ] Google Play internal testing track ($25 one-time) for a permanent
      Android install link beyond the 14-day EAS preview.

## E — Polish (verify still open)

- [ ] Pull-to-refresh on family feeds.
- [ ] Loading skeletons instead of spinners.
- [x] Image lightbox — on post detail (existing) and now on feed cards
      too (tap a photo in `PostCard` → full-screen, swipe through all).
- [ ] Inline comment preview on feed cards.
- [ ] Search (posts / people by handle / families by name).
- [ ] Phone-camera photo capture for the memoir (currently web
      file-picker only).

## F — FSOT: the feed turns incidentally educational (2026-09-16)

Cameron's ruling: HereToo becomes an FSOT training platform. Historical
figures Washington → G.W. Bush post first-person facts (all clearly
labeled educational bots — his explicit choice, including living
figures) about US foreign affairs, wars, and diplomacy; users reply and
the figure answers FROM A KNOWLEDGE BANK, never inventing — same law as
the PCR narratives. Source: the fsot-trainer question bank (9 topic
jsonl files; explanations are the vetted facts) plus per-figure
dossiers. The static /fsot study section (another session's work) is
the sibling surface.

- [ ] Migration: `fsot_facts` (or import fsot_questions wholesale) into
      HereToo's Supabase + one bot profile per figure.
- [ ] `post-historical.ts` scheduled worker replacing post-shakespeare:
      picks a figure + a bank fact, writes a public post in persona.
- [ ] Reply worker (playhouse-replies pattern): answers comments in
      persona, context = dossier + the bank rows near the topic;
      refuses gracefully off-bank.
- [ ] Figure dossiers: era, offices, voice notes; facts only from the
      bank. Cameron approves the voice rules before the first post.
- [ ] Retire or keep post-shakespeare + the insults room: Cameron's call.

## G — Cohorts: rooms removed, graph internal (2026-09-17)

Cameron: the cohorts section carried scraps of long-abandoned versions
of the platform (crew chat, subjects panels, rename and wallpaper
votes, statures). All of it is gone from the surface: app/family/*,
components/family, components/subjects, PlantTreeModal, the profile's
cohort section and cohort quick actions, the mutual-cohorts block on
/u/[handle]. /family* 302s to the feed.

THE WIRING SURVIVES WHOLE, deliberately: families / family_members /
statures tables, every RLS policy, family_network_reach (the 3-hop
network that defines connections and DM gating), the feed's Cohort
lens, the composer's cohort destination for existing members, and
/sow — messenger invites ride it. No migration ran; nothing in the
database moved. The cohort is an internal structure until the new
method for growing the network is designed.

- [ ] Design the new growth model (replaces cohort create/join/sow
      sponsorship as the way in).
- [ ] Then: either resurface cohorts under the new model or migrate the
      graph to whatever replaces it.

## H — Verified humans, public-first feed (2026-09-17)

The anonymity doctrine is REVERSED per Cameron: the public feed now
requires a verified identity, and the feed opens to the Public lens.
Multi-cohort membership needed no work — family_members was always
many-to-many; only the removed UI hid it.

The gate (migration 098): profiles.verified_human, stamped three ways.
LEGACY — every account existing before 2026-09-18 (invite-era, bots
included). INVITE — DB triggers on connections(accepted) and
family_members(active) stamp the newcomer when the counterpart/crew is
already verified, so every invite door present and future vouches, and
two unverified accounts cannot vouch each other. SELFIE —
/api/verify-selfie reads the EXIF timestamp of an uploaded selfie IN
MEMORY and discards the bytes; within 24h of the application passes
(±14h slack when the camera wrote no timezone). NOTHING IS STORED —
no bucket, no file; the ledger (verification_attempts) holds verdicts
and timestamps only, and feeds a 5/hour rate limit. The selfie is not
a profile picture; users add one separately.

RLS: posts_insert public branch, posts_author_update (closes the
insert-private-then-flip-public bypass), and loft_posts_insert all
demand verified_human. Reading is ungated — unverified accounts browse
everything. Service-role writers (faculty) bypass RLS as always.

Composer: Public is a NAMED posts row now — media, tags, 2000 chars,
signed byline; unverified sees "verify now" → /verify. The loft write
path retired from the composer (write door verified-only at RLS);
legacy loft cards still render in the Public lens. Walk-in signups
(no invite) land on /verify; they can skip in and browse.

Honest limits, told to Cameron: EXIF is forgeable and some phone
upload paths strip it — this is a bot speed bump, not a wall. The
selfie door is web-only (native points to the browser or an invite).

- [ ] Cameron reviews all /verify + composer copy (H copy rule).
- [ ] Verified badge display? (not built — decide if the feed should
      show a mark.)
- [ ] Public lens pagination rides the mixed ranked query; if public
      volume outgrows it, give the lens its own public-only query.
