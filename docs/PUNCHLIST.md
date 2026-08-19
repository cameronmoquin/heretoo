# HereToo — Punch List

*Reconciled against the codebase, not the stale brief. Strategy lens:
`docs/STRATEGY.md`. Last reviewed 2026-06-09.*

Grouped by what unblocks the most value. A — D — E roughly = do-first to
do-later. Items that need Cameron's accounts/credentials are marked
**(Cameron)** — an autonomous agent should surface these, not attempt
them.

---

## A — Blocking the memoir payoff (the printed book)

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

## A2 — Memoir: the résumé that falls out of it

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
