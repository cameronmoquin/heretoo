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

### H2 — The first draft of 098 was withdrawn unrun

An adversarial audit (114 agents, 8 attack dimensions, every claim put
through 3 refutation lenses) found 27 real defects in the first draft,
10 of them critical. It was never run. What it would have done:

  - REOPENED TWO PROVEN HOLES. It rebuilt posts_insert from 065 and
    loft_posts_insert from 036/044, but the LIVE policies are 083's and
    085's. Rebasing silently deleted 083's `not uid_is_guest()` ban and
    085's binding of loft pseudonym to the author's own handle — holes
    those files say they proved with live probes and closed.
    THE LESSON, now written into 098's header: never rewrite another
    migration's policy to add a condition. Add a RESTRICTIVE policy.
  - SELF-SETTABLE GATE. It stored the flag on profiles. profiles_update
    (001) has no with-check and no column list, and nothing has ever
    revoked the table-level UPDATE grant, so one PATCH of
    {"verified_human":true} opened every door.
  - SELF-SERVE VOUCH. It trusted accepted `connections` rows (conn_insert
    never looks at status) and active `family_members` rows (fm_owner_all
    is FOR ALL with USING only). Both were one request from outside.
  - EXIF DoS. `/\0+$/` over an attacker-sized NUL run: measured at
    13,237ms for one 200KB run, times up to 65,535 IFD entries.

The second draft fixes all of it: restrictive policies, the verdict in
its own unwritable table (human_verifications), the vouch anchored on
seed_invites.used_by (the one row a stranger cannot forge), guests
excluded, and the parser bounded to 64-byte values / 256 entries.

THE AUDIT WAS THEN RE-RUN AGAINST THE SECOND DRAFT and found six more,
all fixed (commit a5f9e60). Worth keeping because they are the defects
a rewrite introduces rather than inherits:

  - The selfie door never tested is_anonymous. 098 enforces "a guest
    never verifies" on the invite door only, so the OTHER door was the
    way around the invariant the file itself states.
  - COMMENTS WERE UNGATED. Gating who may author a public post while
    leaving the reply box beside it open is not a gate — a bot farm
    puts its real handle under every post in the square instead. Now
    restrictive, scoped to comments on public posts.
  - /verify's copy promised a cohort invite link would verify you,
    which 098 deliberately refuses. The screen contradicted the SQL.
  - Consuming an invite in-app did not refresh the store, so the
    composer refused Public to someone verified seconds earlier.
  - The default Public lens stopped paginating forever if one post in a
    page was community-flagged (rows are dropped after fetching, and a
    short page read as an exhausted stream); the offset also counted
    surviving rows, sliding the window back over rows already shown.
  - A blank-but-present DateTimeOriginal suppressed the IFD0 fallback,
    because `??` does not fall through on an empty string.

LESSON: re-audit the REWRITE. Five of these six existed only in the
second draft. A fix is new code and deserves the same suspicion as the
code it replaced.

A THIRD ROUND over those fixes found fourteen more (commit 8274bce).
The worst was not a hole but a FREEZE, and it is the subtlest thing in
this whole change:

  A restrictive UPDATE policy cannot gate a transition. Its WITH CHECK
  sees only the NEW row, so "becoming public" and "already public" look
  identical to it and it refuses both. An unverified author who posted
  publicly before the migration would have lost the comments toggle on
  their own post, and every heart on it would have ABORTED — because
  bump_heart_count (060) is plain plpgsql with no SECURITY DEFINER, so
  its UPDATE is checked against the hearter's rights, and a WITH CHECK
  violation raises rather than filtering, taking the reaction INSERT
  down with it. Transitions need a TRIGGER, which can see OLD and NEW.

Also closed that round: the comments gate was INSERT-only (post_id
could be PATCHed onto a public post); the vouch did not require the
token handoff (seed_self_rw has no column list, so a sponsor can write
used_by and stamp unlimited profiles — now the trigger stamps only the
caller); the comment composer had no client gate; and flagged rows
shortened pages, which is what pagination reads to decide a stream
ended.

A FOURTH ROUND found ONE defect and refuted seven — the convergence
that says to stop (27 → 6 → 14 → 1). The survivor was a laundering
route: comments_public_requires_human judges a comment against the
post's visibility AT INSERT TIME, so replies written while a post was
private were never asked for a verdict, and the transition trigger only
checked the actor doing the flip. One verified account could seat
unverified accounts in a cohort it owns, collect their replies on a
cohort post, then flip it public and land every one of those handles in
the square at once. The transition now also refuses a post carrying
replies from unverified authors.

FLAGGING — a decision worth keeping: gating the content_flags INSERT
was wrong and was reverted. Reporting abuse is a safety control and the
account most likely to need it is the new unverified one. The lever is
not the report, it is the automatic hide (3 flaggers remove a post for
everyone), so active_flagged_posts / active_flagged_comments now count
only VERIFIED flaggers. Anyone may report; a moderator sees all of it.
No flagging UI exists yet — when one is built, it needs no verified
gate.

- [ ] Cameron reviews all /verify + composer copy (H copy rule).
- [ ] DECISION FOR CAMERON: the legacy cutoff moved to 2026-08-05, the
      day open registration shipped. Accounts created in the six weeks
      since then are NOT grandfathered — they must use an invite or a
      selfie. The first draft's claim that "the platform was invite-only
      its whole life" was simply false.
- [ ] DECISION FOR CAMERON: a crew invite code does NOT verify anyone,
      because families_invite_lookup (001) is `for select using (true)`
      — every crew's standing code is readable by any signed-in account.
      Only a seed invite (/add) is a real vouch.
- [ ] PRE-EXISTING, NOT FROM THIS CHANGE: those world-readable crew
      invite codes are a hole in their own right. Cohort rooms are
      retired from the UI so nothing surfaces them today, but the codes
      are still live and readable. Fix when cohorts resurface.
- [ ] Verified badge display? (not built — decide if the feed should
      show a mark.)
