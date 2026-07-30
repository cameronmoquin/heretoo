# Memoir + Shakespearean Insults — Redesign Brief

*For approval before any building. Grounded in the two diagnoses, in
`docs/PARADIGM.md` and `docs/UI_AUDIT.md`, and in the house-standard feed
rails (`components/feed/NewsCard.tsx`, `LoftCard.tsx`, `DropCard.tsx`).
The target is those three cards: recessed canvas surface, a hairline top
rule, a colored left edge per source, an uppercase eyebrow kicker, spare
type, no chrome-heavy header, no explainer copy. Every move below maps a
wrong pattern to a token in `constants/design.ts` / `constants/colors.ts`
or a shared component in `components/shared/`, so the build is mechanical.*

---

## 1. The one-line diagnosis

**Memoir.** It reads as a different app because it ships a second,
hand-coded design system parallel to the tokens: every one of its seven
screens defines its own sepia "vellum" palette in string literals, its
own type scale, its own pill buttons, and its own chrome header, and the
palette is chosen by an `elder`/`standard` boolean that defaults to sepia
and that `setGeneration` cannot touch, so an Alpha or Gen X user opens the
memoir and gets sepia-on-parchment while the rest of the app reskins.

**Shakespearean Insults.** It reads as a different app because it is one:
a web-only raw DOM/CSS widget (a slot-machine reel on a hardcoded First
Folio cream palette that imports zero tokens and renders identically under
every skin) bolted into a React Native route, with the native side reduced
to a one-line "opens on the web app" stub, so on the phone the room does
not exist.

---

## 2. What stays

A redesign that loses these has failed. The craft and the tone are the
reason both surfaces are worth keeping. Only the container changes.

### Memoir — keep

- **The colored left-edge card.** Already the memoir's own idiom in three
  places (`warnCard` borderLeft 4 at index.tsx:1018, `answerPanel`
  borderLeft 3 at timeline.tsx:1093, `draftCard` borderLeft 3 at
  index.tsx:1097). This is the exact feed-rail device. It becomes the
  memoir's card standard.
- **The timeline spine.** The continuous gutter line plus a circular node
  per event (timeline.tsx:1027-1038, 686-691) is purposeful, on-brand
  craft. Keep the structure, retokenize only its colors.
- **The book/preview manuscript craft.** Title page with a short accent
  rule (preview.tsx:302-310), a Contents block with dotted-leader rows
  (preview.tsx:331-341), chapter eyebrow plus centered rule
  (preview.tsx:344-356), italic photo-plate captions (preview.tsx:380-383).
  The manuscript is actually an artifact. Keep the layout, move the palette
  onto `Colors` and a Boomer-skin serif flourish.
- **The deadpan copy, every word.** "Nothing saved yet" (index.tsx:318),
  "The book is empty so far" (preview.tsx:79), "None of these companies pay
  HereToo" (print.tsx:146), "The AI never rewrites the prose"
  (index.tsx:690-691). Dead-on paradigm voice.
- **The refusal of anxiety architecture.** No progress bar, no "47 of 300"
  counter, framed as a conversation not a quest (index.tsx:6-8). Passes the
  "does it stay quiet" gate verbatim.
- **The authorship features.** TTS read-aloud, voice-to-text that never
  auto-commits, clean-up that only offers mechanical fixes the writer
  applies themselves (index.tsx:149-176, 585-598, 692-727). On-brand
  "nothing generated and passed off as written."
- **The anti-advertising print stance.** No favoritism, cheapest-to-most
  ordering, honest KDP-vs-local writeups (print.tsx:36-102).
- **The intent behind the reading-size toggle.** A genuinely larger,
  higher-contrast reading mode for the 65+ writer the memoir is built for.
  Keep the accessibility affordance. Re-express it as a scalar over `Type`
  (or a dedicated skin), not as a forked hardcoded palette that defeats the
  skin engine.

### Shakespearean Insults — keep

- **The forge and its citation.** The three-part forged insult attributes
  to a speaker and a play the same way the true lines do (web.tsx:126-131).
  Keep the forged line plus attribution, drop the reel around it.
- **The cited true-line clipping.** Quote, speaker, target, play, citation,
  gloss (web.tsx:176-183). This is already the closest thing on the screen
  to the house clipping. Restyle it onto a recessed dark card with a colored
  left edge.
- **The First Folio typographic voice as content.** Serif, small-caps
  section heads, drop-cap-as-provenance. Re-express through `Gen.displayFont`
  SERIF, the letterpress voice the skin engine already ships, instead of an
  externally loaded parchment card.
- **The epigraph with speaker/play attribution** (web.tsx:77-81).
  Provenance as content. Keep the cited epigraph, lose the decorative red
  drop-cap and fleurons as chrome.
- **The deadpan register.** Terse tier labels, no exclamation. `UI_AUDIT`
  "What Not To Do" names this reaction as on-brand.
- **The data-driven engine.** `lib/insultEngine` reading
  `data/bard-insults.json`, nothing LLM-generated (web.tsx:10-12). Keep
  wholesale.
- **The craft-correctness controls.** Meter, masculine/feminine ending,
  strict scansion (web.tsx:137-165). This is the "is the craft correct"
  gate. Keep the capability, rebuild the controls as house Chips.
- **The prefers-reduced-motion respect** (web.tsx:58-59, CSS 304-306). Keep
  the instinct even though most of the reel motion goes.

---

## 3. The redesign

Concrete, screen-level, token-by-token. The rule for both surfaces is the
same: delete the private design system, route color through `Colors`, size
through `Type`, corners through `Gen.radius`, fonts through
`Gen.displayFont`/`Gen.bodyFont`, CTAs through the shared `Button`, and
adopt the recessed colored-left-edge card as the surface. The parchment
craft survives as a Boomer-skin flourish inside the skin engine, appearing
when the skin asks for it, not as a hidden global default.

### 3A. Memoir — the subtractive fix (all seven screens)

The work is deletion, not addition. Every item below removes a private
literal and points the same element at a token that already exists.

**Palette. Delete the `elder`/`standard` fork.** Remove the duplicated
literal block (`pageCardBg:'#F2E8CC'`, `pageInk:'#2A1F18'`,
`pageInkSecondary:'#5A4A38'`, `pageAccent:'#8A5B1A'`, `pageBorder:'#CFC0A0'`,
`pageSurface:'#FBF4DE'`) from all seven files (index.tsx:786-804 and the
copies in arrange.tsx:257-263, preview.tsx:243-250, book.tsx:319-327,
photos.tsx:253-259, print.tsx:190-196, timeline.tsx:988-995). Map each
former `page*` token to a `Colors.*` role:

| Former literal | Role | Token |
|---|---|---|
| `pageCardBg` / `pageSurface` | card surface | `Colors.background` (recessed rail) |
| `pageInk` | heading + body ink | `Colors.textPrimary` |
| `pageInkSecondary` | secondary text | `Colors.textSecondary` |
| `pageAccent` | left edge + kicker | `Colors.primary` |
| `pageBorder` | hairline | `Colors.borderLight` |

Once these read `Colors`, `setGeneration`'s `Object.assign(Colors, palette)`
reskins the memoir for free, exactly as it does the feed rails.

**Two broken states, fixed by the same swap.** `chromeText: Colors.brandIvory`
(index.tsx:789) and `display = elder ? pageInk : Colors.brandIvory`
(book.tsx:326, used at book.tsx:411, and the same brandIvory chrome in
photos.tsx:248, print.tsx:186, arrange.tsx:42, preview.tsx:40,
timeline.tsx:131) go to `Colors.textPrimary`. `brandIvory` equals the light
`background` `#F4F1E8`, so headings vanish on Boomer/Millennial today. The
translucent `rgba(22,22,29,0.78)` on `endCard` (index.tsx:995) and
`warnCard` (index.tsx:1017) goes to `Colors.surface`, so the card tracks the
skin instead of painting near-black on parchment.

**Card surface. Adopt the recessed rail, kill the filled vellum card.**
Delete `pageCardWebExtras` (the glossy `0 24px 50px rgba(0,0,0,0.45)` shadow
plus the repeating-linear-gradient ruled-line texture at index.tsx:809-814)
and the filled `pageCard` (padding 36, borderWidth 1, radius 14 at
index.tsx:861-866) and its per-screen `pageCardWeb` copies. Replace with the
NewsCard treatment verbatim: `backgroundColor: Colors.background`,
`borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor:
Colors.borderLight`, an absolute 3px left rule in `Colors.primary`,
`paddingLeft: Spacing.md + 3`, `paddingRight: Spacing.md`, `paddingVertical:
Spacing.sm`. The memoir card sinks like a wire story instead of floating.

**Header. Drop the chrome bar for the headerless card.** Remove the full
header cluster (back chevron + uppercase kicker + Timeline/Past-entries/
Make-the-book pill row + "Aa" toggle) at index.tsx:332-370 and its per-screen
copies (arrange.tsx:103-113, preview.tsx:66-75, book.tsx:96-105,
photos.tsx:84-93, print.tsx:122-131, timeline.tsx:332-341). Navigation between
the seven memoir screens moves to the shared `ScreenHeader` (the same
back-chevron spec the rest of the app will use) plus the room's own nav,
matching how the feed rails carry no header and let an inline eyebrow
`metaRow` do the labeling (NewsCard.tsx:38-64). This removes the "two
palettes on one screen" effect where dark chrome sat over a sepia body card.

**Buttons. Adopt the shared `Button`.** `components/shared/Button.tsx` is
imported by zero memoir files today. Replace `saveBtn` (Radius.full +
hardcoded onAccent `'#FBF4DE'` at index.tsx:966-975), `makeBtn`
(book.tsx:393-395), `primaryBtn`/`dangerBtn` (timeline.tsx:1179-1191),
`emptyBtn`/`makeLink` (preview.tsx:297,397) with `<Button>`. The shared
Button floors at `Heights.touchTarget` 44 (Button.tsx:46), uses
`Colors.onPrimary` for the CTA ink (Button.tsx:62), and takes its corner
from `Radius.md`. This also fixes the sub-44 controls (`warnContinue`/
`warnSkip` at ~34px, index.tsx:1037/1046; `skipBtn` pv6 at index.tsx:928;
`aaBtn` pv6). Note the `Button` corner should follow `Gen.radius` so Alpha
gets radius 2 sharp and Boomer 14 soft; today it is fixed `Radius.md`. That
is an app-wide Button change flagged in the audit, not memoir-specific, so
it can land with the shared-Button repair rather than here.

**Type. Route to `Type.*`.** No memoir file imports `Type` (index.tsx:46
imports only `Spacing`, `Radius`). Map the free-typed sizes:

| Element | Current | Token |
|---|---|---|
| Question head | 26/38 (index.tsx:817, 906-908) | `Type.hero` (44/48) or `Type.display` (28/34) |
| Prose input | 18/30 (index.tsx:819) | `Type.body` (16/24) |
| End summary | 20/32 (index.tsx:1006) | `Type.body` / `Type.cardTitle` |
| Book stat value | 22/800 (book.tsx:386) | `Type.title` |
| Renders title | 18/800 (book.tsx:411) | `Type.cardTitle` |
| Book title | 34/42 (preview.tsx:307) | `Type.hero` |
| Chapter title | 26/34 (preview.tsx:350) | `Type.display` |
| Kickers | ls 2 (index.tsx:876), ls 2.4 (preview.tsx:347) | `Type.eyebrow` (ls 1.4) |

**Fonts. Route to `Gen.*`.** Replace the serif literal
`'"Source Serif 4", Georgia, serif'` (index.tsx:913,942,959,987 and across
all seven files) with `Gen.bodyFont`, and the display literal
`'"Syne", "Inter", sans-serif'` (index.tsx:878,1003,1027) with
`Gen.displayFont`. Boomer's `bodyFont` is already SERIF (generations.ts:200),
so the letterpress reading voice returns on the Boomer skin and only there.
Alpha gets MONO CRT, as it should.

**Radius. Route to `Gen.radius`.** Replace the hardcoded 14 (`pageCard`
index.tsx:865, `endCard` :994, `warnCard` :1016, and page 14 in
arrange/preview/book/photos/print) and the off-scale 6/8/10 (`input`
elder-6, `draftCard` 8, `draftInput` 6, `photoCard` 10) with `Gen.radius`
for controls and cards, `Radius.card` for structural corners that should not
resharpen. 14 is literally the Boomer radius (generations.ts:202) frozen for
all skins.

**Kicker. One tracking, one color.** `Type.eyebrow` (ls 1.4) plus
`Colors.primary`, replacing the per-screen drift (ls 2 at index.tsx:876, ls
2.4 at preview.tsx:347, ls 1.8 at arrange.tsx:308) and the hardcoded bronze
`'#8A5B1A'` at timeline.tsx:1005 and arrange.tsx:285.

**The reading-size affordance.** Keep it, re-expressed. Two clean options,
owner's call:
1. **Scalar over `Type`** — a `readingScale` multiplier (1.0 / 1.25) applied
   to `Type.body`/`Type.hero` sizes at the memoir root, so larger reading
   text is a size change only, not a palette fork. Simplest, keeps the skin.
2. **Route through the skin** — treat "larger, warmer, higher-contrast" as
   the Boomer skin already does (serif, warm parchment, radius 14), and let
   the 65+ writer pick Boomer. No new mechanism, but couples reading size to
   generation, which may not be wanted.
Recommend option 1: the accessibility need is font size and contrast, and
`Colors.textPrimary` on `Colors.background` already clears contrast on every
skin. Keep the "Aa" affordance as a size scalar; delete the palette it used
to switch.

**The timeline spine and the book pages** keep their structure. Only their
colors move onto `Colors` (spine line and node to `Colors.border` /
`Colors.primary`; title-page rule, dotted leaders, chapter rule, italic
captions to `Colors.textSecondary` / `Colors.primary`). The manuscript stays
a manuscript; it just reskins.

### 3B. Shakespearean Insults — rebuild the container as a house screen

The content survives; the container is replaced. This is a rewrite of the
container, not a token swap, because the current file is DOM/CSS, not React
Native.

**Medium. One cross-platform RN screen.** Delete the raw DOM tree
(`<div className="bard-root">` … at web.tsx:72-201), the injected `BARD_CSS`
block (web.tsx:209-307), and `ensureAssets()`'s `<style>` and Google Fonts
`<link>` injection (web.tsx:26-38). Replace both `ShakespeareanInsults.web.tsx`
and the native stub `ShakespeareanInsults.tsx` with a single file of RN
`View`/`Text`/`Pressable` + `StyleSheet.create`, the same primitive set as
NewsCard/DropCard. The native stub ("The playhouse opens on the web app.")
is deleted; the room now exists on the phone, which is the primary target.

**Palette. Import `Colors`, delete the cream.** Remove the private CSS vars
(`--bard-ink:#1c1408`, `--bard-paper:#efe6cf`, `--bard-oak:#5b3a1e`,
`--bard-plaster:#e7ddc4`, `--bard-madder:#9a2b1e`, `--bard-gilt:#b3893f` at
web.tsx:211-213). The screen sits on `Colors.background`, cards on
`Colors.background` (recessed) with a `Colors.primary` left edge, ink in
`Colors.textPrimary`/`textSecondary`. It reskins with `setGeneration` and
themes with `setColorMode` like every other room.

**Shape. Replace the reel with cards.** Delete the slot-machine reel markup
(web.tsx:104-116), the `@keyframes bard-settle` spin, and the beveled inset
tiles (CSS 267-283). The forged insult renders as a single recessed card:
an eyebrow kicker ("FORGED" or "STRIKE"), the three-word line as the card
title (`Type.cardTitle` or `Type.display`), and the speaker/play attribution
as a caption below. No animation. The card is the content, same as NewsCard.
Keep the `prefers-reduced-motion` instinct; there is little motion left to
gate.

**The true-line clipping.** Restyle onto its own recessed dark card with a
colored left edge: eyebrow kicker ("TRUE LINE"), the quote as the title, then
speaker / target / play / citation / gloss as tokened caption rows. This is
the on-paradigm cited-quote block; it survives almost verbatim in content,
only the container changes.

**Header. Strip the marquee.** Delete the centered `<h1>` masthead
(web.tsx:76, CSS 227-231), the red drop-cap (CSS 235-238), the fleuron
glyphs ❦/❧ (web.tsx:84,169), and the tier-description explainer sentence
(web.tsx:99, CSS 243). The room gets the shared `ScreenHeader` frame like
every other room and no in-body title. The epigraph stays as a cited block
(quote + speaker/play in tokened caption type), without the decorative
drop-cap. This is "a bar with no sign."

**Buttons. Shared `Button` for actions.** Delete `.bard-tier`/`.bard-btn`/
`.bard-btn.primary` (CSS 248-253, ~32px tall, no Radius, no Heights). Strike,
Summon, and Cascade become `<Button>` (Colors.primary fill, Colors.onPrimary
ink, 44 floor, Gen.radius corner).

**Tier + meter controls. House Chips.** The tier picker and the Meter /
Ending controls become the shared `Chip`/`SegmentedControl` (`UI_AUDIT` §3),
replacing the madder-red selected tier and the OS-native `<select>`
dropdowns (web.tsx:137-158). The Strict and Cascade `<input type=checkbox>`
(web.tsx:162,190) become house toggle Chips. No browser-default form chrome.

**Type. Route to `Type.*`.** Title 2.4rem → `Type.display`/`Type.hero`; word
1.5rem → `Type.cardTitle`; h2 1.3rem → `Type.title`; clip-text 1.25rem →
`Type.cardTitle`; the hand-set uppercase `word-src`/`clip-cite`
(letterSpacing .08em/.06em, CSS 274-277/301) → `Type.eyebrow`.

**Fonts. `Gen.displayFont` SERIF, no runtime fetch.** Delete the IM Fell
English `<link>` (web.tsx:26-31) and every `font-family:"IM Fell English"`
literal (CSS 215,228,246,265). Display text routes through `Gen.displayFont`;
on the Boomer skin that is SERIF (the letterpress voice), which is the First
Folio ambition expressed correctly. This also restores the self-contained,
crawler-hostile posture the paradigm asks for (no external font fetch).

**Spacing / Radius / background.** Raw pixel padding (root `24px 16px 80px`,
frame `28px 22px`, gaps 8/12) goes to `Spacing.*`; corners to `Gen.radius`.
Delete the `radial-gradient` + scanline background (CSS 217-220), the
double-frame border/outline (CSS 223-224), and the clipping drop-shadow (CSS
297). Flat recessed canvas, single hairline top rule, one colored left edge.

**Frame.** `app/shakespearean-insults.tsx` gets the house `Screen` +
`ScreenHeader` instead of the transparent SafeAreaView with
`backgroundColor:'transparent'` (app/shakespearean-insults.tsx:16). The
`headerShown:false` registration in app/_layout.tsx:153 can stay if
`ScreenHeader` supplies the frame, or flip to the house header; either way
the user lands in a room, not on a bare parchment panel.

---

## 4. What it will look like

### Memoir — before / after

**Before.** A dark branded top bar (back chevron, uppercase kicker, a row
of Timeline / Past-entries / Make-the-book pills, an "Aa" toggle) sits over
a single floating sepia card with a glossy drop shadow and faint ruled-line
texture, serif questions at 26px, fully-rounded cream buttons. Two palettes
on one screen. Switch your skin to Alpha or Gen X and nothing here changes:
still sepia on parchment, and on the light skins the headings and some cards
go invisible or invert to near-black.

**After.** No top bar. The question and the writing area sit on the app's
own recessed canvas behind a 3px gold left rule and a hairline top rule, the
same card the news and drop rails use. An uppercase eyebrow labels the
section. Buttons are the house CTA: dark ink on gold, 44px tall, corners as
sharp or soft as the skin asks. Switch to Alpha and the whole room turns CRT
cyan with mono type and sharp corners; switch to Boomer and it is warm
parchment with a serif reading voice and soft corners, because the
letterpress look now lives in the skin instead of being hardcoded for
everyone. The timeline spine and the book/manuscript pages look the same in
structure, just recolored to match. The larger-reading affordance still
works, now as a text-size scale that reads at full contrast on any skin.

### Shakespearean Insults — before / after

**Before.** A bright cream First Folio panel floating on the app's near-black
canvas, with a centered decorative title, a red drop-cap epigraph, fleuron
dividers, a slot-machine reel of three beveled tiles that spin and settle, OS
dropdowns and checkboxes, small plaster/oak buttons, and a gradient/scanline
background. On the phone it is a one-line note saying to open the web app.
Under every skin it looks identical.

**After.** A house room. The forged insult is a recessed card behind a
colored left edge: a "FORGED" eyebrow, the three-word line as the head, the
speaker and play as a caption underneath. The true line is its own cited card
with quote, attribution, and gloss. The epigraph is a plain cited block. Tier
and meter are house Chips, Strike and Summon are the gold house Button. It
runs on both web and phone from one file. Switch skins and it reskins with
the app; on Boomer the serif First Folio voice returns, correctly, as the
skin's display font rather than a fetched webfont on a cream island.

---

## 5. Risk and scope

Be honest about what the owner is approving. Grouped by blast radius.

**Safe, invisible on the current default (low risk).**
- Memoir palette/font/radius/type swaps that route literals to tokens
  *when the active skin is Boomer*. Boomer's palette equals today's `light`
  and its `bodyFont` is SERIF, so a Boomer user sees close to the same warm
  look. The visible change is that non-Boomer users finally get their skin.
- Deleting the dead `elder`/`standard` palette fork once its colors are on
  tokens. No behavior change beyond reskinning.

**Visible layout change, needs sign-off.**
- Memoir loses its chrome header bar and its filled shadowed vellum card in
  favor of the recessed rail. This is the single biggest visual change and
  the core of the complaint. The owner is approving that the memoir stops
  looking like a floating sepia book and starts looking like the feed.
- Every memoir CTA changes from a cream pill to the gold house Button (dark
  ink, 44px). Different color and shape.
- Insults loses the reel, the masthead, the drop-cap, the fleurons, and the
  cream panel entirely. The owner is approving that the First Folio look
  survives only as the Boomer serif skin, not as a standalone parchment
  widget.

**Behavior change, not just looks — flag hard.**
- **Insults goes cross-platform.** Today native is a dead stub; after, the
  room renders real content on the phone. This is new behavior on the
  primary target and the biggest functional win, but it means the RN
  rebuild has to reproduce the engine's output faithfully (the
  `lib/insultEngine` + `data/bard-insults.json` calls are kept, so the
  content logic does not change, only the rendering).
- **The reading-size toggle changes mechanism.** Today "Aa" switches a whole
  palette; after, it scales text size only. Larger-reading users keep a
  larger, high-contrast read, but the sepia-specific look goes away for them
  unless they also pick Boomer. Worth confirming with the 65+ use case in
  mind.
- **The shared-Button corner following `Gen.radius`** (so Alpha CTAs go
  sharp) is an app-wide Button repair, not memoir-only. If it lands with
  this work it changes every existing Button consumer. Can be deferred to
  the audit's Phase 2 instead.

**Not in scope here.** Building the shared `ScreenHeader`, `Card`, `Chip`,
`SegmentedControl`, `Screen`, and the Button repair are `UI_AUDIT` Phase 2
work. This brief assumes those atoms exist (or are built first) and the
memoir/insults rebuild consumes them. If they do not exist yet, add "build
the atoms" as step 0.

---

## 6. Build order

Lowest risk first. Each numbered step is independently shippable and
reviewable.

1. **Atoms first (if not already built).** Ensure `Button` (repaired),
   `ScreenHeader`, `Card`, `Chip`/`SegmentedControl`, `Screen` exist in
   `components/shared/`. Per `UI_AUDIT` Phase 2. No memoir/insults edits yet.
2. **Memoir bug fixes only.** Swap `brandIvory` headings to
   `Colors.textPrimary` and the `rgba(22,22,29)` cards to `Colors.surface`
   across the seven files. This alone stops the invisible/inverted states on
   light skins and is defensible as a straight bug fix.
3. **Memoir palette de-fork.** Delete the `elder`/`standard` literal blocks,
   route the `page*` roles to `Colors.*`. The memoir now reskins. Still on
   the old card shape, so the visible change is limited to color following
   the skin.
4. **Memoir type + font + radius to tokens.** Route to `Type.*`,
   `Gen.bodyFont`/`Gen.displayFont`, `Gen.radius`. Sizes and fonts now track
   the scale and the skin.
5. **Memoir card + header swap.** Replace the vellum card with the recessed
   rail, drop the chrome header for `ScreenHeader`, adopt the shared
   `Button`. This is the visible layout change; ship for approval.
6. **Memoir reading-size affordance.** Re-express "Aa" as a `Type` scalar,
   delete the palette it switched.
7. **Insults RN rebuild.** New cross-platform file: recessed cards, house
   Chips, shared Button, `Colors`/`Type`/`Spacing`/`Gen` throughout, engine
   calls unchanged. Delete the DOM/CSS web file and the native stub. Largest
   single piece; ship last, review carefully, and verify the engine output
   matches the old widget line-for-line before deleting the old file.
