# HereToo — Dispatch Brief

**Point a remote/dispatched Claude at this file to continue HereToo.**
It is the standing instruction for an on-demand cloud agent (a claude.ai
routine, a web dispatch, or any fresh session). Self-contained: read the
two references it names and you are oriented.

---

## Your job

Make real, shippable progress on HereToo, then commit and push so it
deploys. Specifically:

1. **Orient.** Read `HERETOO_BRIEF.md` (what the product is, the voice,
   the stack) and `docs/heretoo-source-of-truth.md` (the year-plan
   bible — twelve milestones gated by the seven-question filter).
2. **Pick the highest-value next thing.** Prefer finishing a thread
   that is already in flight over starting something new. Check recent
   commits (`git log --oneline -20`) to see what just shipped.
3. **Build it.** Small, well-organized changes. Match the existing
   patterns (see Conventions below).
4. **Verify before you commit.** `npm run typecheck` must pass with zero
   errors. Where logic is non-trivial, write a throwaway `npx tsx`
   script to assert behavior, run it, then delete it.
5. **Commit to `master` and push.** HereToo auto-deploys from `master`
   via Netlify. Use a clear `type(scope): summary` commit message and
   end it with the Co-Authored-By trailer.

If you finish a thread and have budget, pick the next one. Leave the
tree clean. Never commit `.env`, secrets, or the `.claude/*.lock` files.

---

## Where things stand (update this section as you ship)

- **Live:** family circles, public Loft, DMs, cameras, news, games,
  trivia, P2P video, the "give" donation page, subscriptions.
- **Memoir / KDP (Milestone 13)** is the most recently active area:
  single-prompt Socratic interview with voice + co-writer, photos woven
  into chapters, an in-app **book preview** (`/memoir/preview`) and an
  **arrange** screen (`/memoir/arrange`, reorder + reassign entries),
  the print guide, and a Pandoc→LuaLaTeX→Ghostscript **render worker**
  (`render-worker/`) producing interior PDF + cover + EPUB.
- **Known open thread:** the render worker is built but **not yet
  deployed** on Render.com — "Make the book" needs the worker live with
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MEMOIR_RENDER_SECRET`
  set (the secret must match Netlify's). See `render-worker/README.md`.
  This step needs Cameron's accounts; don't attempt it autonomously —
  surface it as a recommendation instead.
- Candidate next features (memoir): a phone camera-capture flow for
  photos (currently web file-picker only); ordering of *photos* within a
  chapter (entries already reorder); strict PDF/X-1a hardening.
- Or step out of memoir and pull a fresh milestone from the
  source-of-truth doc.

---

## Conventions (do not break these)

- **Routes:** Expo Router, file-based under `app/`. A new screen
  `app/foo/bar.tsx` must also be registered as a `<Stack.Screen>` in
  `app/_layout.tsx`.
- **Theme:** `makeStyles()` factory called inside the component per
  render, plus `key={themeMode}` on the root, so the palette flips
  instantly. Don't hoist `StyleSheet.create` to module scope.
- **Memoir styling:** the "vellum / manuscript" elder mode — warm
  cream page card, sepia ink, `"Source Serif 4"` body + `"Syne"`
  display on web. Copy the token block from `app/memoir/preview.tsx`.
- **Book assembly:** `lib/memoir-book.ts` (`assembleBook`) is the single
  source of chapter order/grouping for the app; it **mirrors**
  `render-worker/src/assemble.js`. Change one, change both.
- **Schema changes:** add a new numbered, idempotent migration in
  `supabase/migrations/` (`create or replace`, `add column if not
  exists`, `drop policy if exists`). Never edit a shipped migration.
- **Cameras:** never import `react-native-vision-camera` in any file the
  web bundle reaches (use `.web.tsx` splits).
- **Voice:** plainspoken, warm, understated — "would Cameron's
  grandmother smile reading this?" Lead with family, never marketingese.

---

## How Cameron points a dispatch here

On claude.ai, create an **on-demand routine** against the
`cameronmoquin/heretoo` repo with this as the prompt:

> Read and follow `docs/DISPATCH.md` in this repo. Pick the highest-value
> next thing, build it, verify with `npm run typecheck`, then commit to
> `master` and push.

Run it whenever you want a push of progress; re-run any time.
