# HereToo UI Audit and Unification Brief

*Panel audit: design tokens, component consistency, social/web trend, mobile UX and accessibility.
Grounded in the actual codebase (constants/design.ts, constants/colors.ts, constants/generations.ts,
constants/typography.ts, components/shared/, app/, components/feed/). Every claim below cites a real
file and value. This document is the brief the unification work follows.*

---

## 1. Verdict

HereToo has a real design system and does not use it. The tokens exist and are, for the most part,
well chosen: `constants/design.ts` ships a coherent `Spacing`, `Radius`, `Type`, `Heights`, and
`Shadow` set; `constants/colors.ts` ships a warm dark and warm light palette that swaps cleanly
through `setColorMode`; `constants/generations.ts` ships the skin engine that is supposed to reskin
the entire app per generation. The problem is not the tokens. The problem is that almost nothing
reaches them. The shared `<Button>` is rendered in three files (`app/(auth)/welcome.tsx`,
`app/(auth)/profile-setup.tsx`, `components/shared/ErrorBoundary.tsx`) while `TouchableOpacity`
appears 576 times across 48 files. `Type` is imported by six feed-adjacent files. `Heights` is
imported by one file. `Gen.displayFont` / `Gen.radius` are read by two components. There is a second,
fully dead type scale (`constants/typography.ts` `Typography`, zero usages) that still contradicts the
live one. The result is exactly the complaint: every screen invents its own buttons, headers, cards,
modals, kickers, and title sizes, so moving between sections feels like moving between apps.

The through-line is convergence, not invention. The salvage-punk paradigm in `docs/PARADIGM.md` is
sound, and where the system is actually applied (the inline feed rails: `NewsCard`, `LoftCard`,
`DropCard`) the app looks deliberate and on-brand. The fix is to make screens route through the tokens
and a small set of shared primitives, close the two or three real gaps in the scale that are forcing
people to free-type values (a 17px card-title step, a mid radius step, a hero display step), and wire
the shared atoms to `Gen.*` so the skin engine finally reskins the whole app instead of just the
canvas color and two glitch headers. Two things also cross from inconsistency into outright bugs and
should be treated as such: hardcoded `rgba(22,22,29)` surfaces and `Colors.brandIvory` headings render
near-invisible on the light and Millennial skins, and the shared Button paints white text on gold
(`#C9A14B`), which fails contrast at about 1.9:1. Those are not taste calls; they are broken states.

---

## 2. The Unified Design System

The canonical source is `constants/design.ts` plus `constants/colors.ts` plus `constants/generations.ts`.
No screen defines its own scale. Where the current tokens have gaps, the specific additions are called
out as ADD.

### 2.1 Type scale (single source: `design.ts` `Type`)

`constants/typography.ts` `Typography` is deleted. It has zero usages (confirmed by grep) and
contradicts `Type` on shared names (`body` 14 vs 16, `h1` 22/700 vs `title` 20/600). Keep only the
`Weight` map from that file, or re-export a `Weight` alias from `design.ts`, because
`components/shared/Button.tsx:4` imports `Weight` from it.

Canonical scale (existing values from `design.ts:44-63`, plus additions):

| Token | Size / line / weight / tracking | Role | Status |
|---|---|---|---|
| `Type.hero` | 44 / 48 / 800 / -0.5 | Give and memoir hero heads | ADD (replaces free-typed 50/38) |
| `Type.display` | 28 / 34 / 700 / -0.5 | Room mastheads, big empty states | exists |
| `Type.title` | 20 / 26 / 600 / -0.3 | Sub-page titles | exists |
| `Type.cardTitle` | 17 / 24 / 700 / -0.2 | Card heads, ledes, reader titles | ADD (de-facto style, no token today) |
| `Type.body` | 16 / 24 / 400 / 0 | Post bodies, primary content | exists |
| `Type.bodyBold` | 16 / 24 / 600 / 0 | Emphasized body | exists |
| `Type.ui` | 14 / 19 / 500 / 0 | Buttons, inputs, metadata | exists |
| `Type.uiBold` | 14 / 19 / 700 / 0 | Emphasized UI | exists |
| `Type.caption` | 12 / 16 / 500 / 0 | Helpers, microcopy | exists |
| `Type.eyebrow` | 11 / 14 / 700 / 1.4 uppercase | Small-caps kickers | exists |

Why `Type.cardTitle`: `DropCard.tsx:108-112` and `NewsCard.tsx:127-131` are byte-identical
`fontSize:17, lineHeight:24, fontWeight:'700', letterSpacing:-0.2`; `fontSize: 17` appears 15 times
across 12 files. The scale jumps body(16) to title(20) with nothing at 17, so the style is duplicated
inline. Add it once and point the four card families and the screen ledes at it.

Why `Type.hero`: `give/index.tsx:222` free-types 50, `:317` free-types 38, `memoir/index.tsx:817`
uses 26. `Type.display` caps at 28. Give and memoir have a real hero tier; name it.

Off-scale cleanup: snap the 11.5 fractional sizes (`PostCard.tsx:753,815,838`) to the caption/eyebrow
step. `design.ts:37` already forbids loose sizes; honor it.

### 2.2 Spacing (single source: `design.ts` `Spacing`)

Keep as-is: `xxs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32 / xxl 48`. No additions needed. Standardize
one content max-width token (screens currently split 560 in `journal.tsx:717` vs 720 in
`rooms/hunt/give/memoir`) and one scroll padding value (currently `Spacing.md` on journal/rooms vs
`Spacing.lg` on hunt/give/memoir). Recommend `maxWidth 720` and `Spacing.lg` as the canonical frame,
carried by the `Screen` wrapper (section 3).

### 2.3 Radius (single source: `design.ts` `Radius`, made skin-aware)

Current scale `xs 6 / sm 10 / md 16 / lg 20 / full 999` is bypassed 102 times across 52 files with raw
`borderRadius` numbers (8/10/12/14/16/18/20). The two real problems:

- ADD `Radius.card` = 12. People keep reaching for an 8-14px control/card step that does not exist, so
  they type it inline (the copy-pasted modal card hardcodes `borderRadius:14`, which is not even in the
  scale). Give it a name.
- Card, button, input, chip, and modal corners derive from `Gen.radius` (clamped to the scale), not a
  fixed `Radius.*`. `generations.ts:166-202` defines per-skin radius (alpha 2 sharp, genx 8, millennial
  12, boomer 14, genz 18) and it is the whole point of a skin. Today `Gen.radius` is consumed by one
  component (`GenerationSwitcher.tsx:75`, its own preview chip). Keep fixed `Radius.*` only for
  structural elements that should not resharpen with the skin. Fix the `design.ts:31` comment that reads
  "reads as polished SaaS"; that guidance is off-paradigm for a salvage-punk app.

### 2.4 Elevation (single source: `design.ts` `Shadow`)

Keep `Shadow.sm / md / lg` as-is. Modals use `Shadow.lg`. Resting cards use `Shadow.sm`. This token is
fine; it is just applied unevenly (the copy-pasted modal cards drop shadow entirely). The shared Modal
(section 3) makes it automatic.

### 2.5 Semantic color roles (single source: `colors.ts`, swapped by `setColorMode` and `setGeneration`)

The rule: no screen hardcodes a hex or rgba that has a token. Theming works by
`Object.assign(Colors, palette)` (`colors.ts:131`, `generations.ts:218`), so a literal never recolors.

Roles and their canonical tokens:

- Surfaces: `Colors.background` (canvas), `Colors.surface` (cards), `Colors.surfaceLight` (raised /
  wells). ADD `Colors.surfaceTranslucent` per palette only if a translucent card is genuinely needed,
  so it swaps with the theme instead of a hardcoded `rgba(22,22,29)`.
- Text: `Colors.textPrimary` / `textSecondary` / `textMuted`. Headings use `textPrimary`, never
  `brandIvory` (which equals the light `background` `#F4F1E8` and disappears in light mode).
- Primary action: `Colors.primary` (gold `#C9A14B` dark, `#9A7A2E` light). ADD `Colors.onPrimary` =
  near-black ink (`#0A0A0F`) on the gold skins, white where a skin's primary is dark. This is the fix
  for the white-on-gold contrast failure.
- Heart: `Colors.heart` (`#C73E3A` dark / `#A8302C` light). Delete the private `HEART_RED = '#E0245E'`
  in `PostCard.tsx:36`.
- Accents already tokened and correct: `agree`, `disagree`, `bridge`, `share`, `important`, `error`,
  `warning`, `success`, `info`, plus `clusters.*`.

### 2.6 Generation personality tokens (single source: `generations.ts` `Gen`)

`Gen.displayFont` (MONO/SYNE/SERIF/INTER), `Gen.bodyFont`, `Gen.radius`, `Gen.displayTransform`,
`Gen.displayLetterSpacing` must reach the whole tree. Today they reach `GlitchText.tsx:41` and
`GenerationSwitcher.tsx:63,75` and nothing else, while inline `fontFamily` literals appear 110 times
across 33 files. Route all display/masthead text through `Gen.displayFont` + `Gen.displayTransform`,
body through `Gen.bodyFont`, and corners through `Gen.radius`. This is what makes the skin engine real.

---

## 3. The Component Contract

Every screen renders these and only these for the shared atoms. Names marked EXISTS are in
`components/shared/`; CREATE means new; CONSOLIDATE means one exists but needs promotion/repair.

| Component | Status | Canonical spec |
|---|---|---|
| `Button` | EXISTS, repair + adopt | `components/shared/Button.tsx`. Fix primary foreground to `Colors.onPrimary` (dark ink on gold), not `#FFF` (`Button.tsx:52`). Size maps to `Heights` with a 44px floor: sm to `Heights.button` (40), md to `Heights.input` (44), lg to `Heights.buttonLg` (48), each with `minHeight` so padding math cannot drop below the token. Text uses `Type.ui`. Corner from `Gen.radius`. Forward `title` as `accessibilityLabel`, set `accessibilityRole="button"`. This is the only way to render a CTA. Delete every local `saveBtn`/`primaryBtn`/`btnPrimary`/`ctaBtn`/`submitBtn`. |
| `Screen` | CREATE | Page frame: `Colors.background`, one max-width token (720), scroll padding `Spacing.lg`, bottom reservation = `MOBILE_TAB_BAR_HEIGHT + env(safe-area-inset-bottom) + gap`. Replaces ad-hoc frames (`journal.tsx:697,717` vs `rooms/hunt/give/memoir`). |
| `ScreenHeader` | CREATE | `<ScreenHeader title back onBack right titleSlot>`. Height `Heights.topHeader` (52). One back-chevron spec (size 20, `hitSlop`, `accessibilityLabel`). Title via `Type.title` (or `titleSlot` for GlitchText mastheads). Replaces 41 bespoke headers. |
| `Card` | CREATE | Recessed surface, `Colors.surface`, corner from `Gen.radius` (clamped), `Shadow.sm`, `Spacing.md` interior. Codify the feed rail treatment (recessed canvas + hairline top rule + colored left-edge + eyebrow) as the house card standard; keep the per-source rail colors. |
| `Modal` / `Sheet` | CONSOLIDATE (`ConfirmSheet` exists) | Backdrop `rgba(0,0,0,0.55)` + centered card, corner `Radius.lg`, `Shadow.lg`, `Spacing.lg` padding. One silhouette. Route ConfirmSheet, flag/boost/line pickers, avatar chooser, and all settings modals through it. Replaces the copy-pasted `modalCard{borderRadius:14}` in 8+ files. |
| `Input` / `Field` | CREATE | `<Field label hint error>` + `<Input>`: `Colors.surfaceLight` bg, `Colors.border`, `Radius.card`, `Heights.input` (44), `Type.body`, Colors tokens only. Replaces 8+ near-identical copies and bans hardcoded hex (`welcome.tsx:319`). |
| `Chip` / `SegmentedControl` | CREATE | `<Chip selected onPress>` at `Heights.pill`, one selected treatment (primary border + `primaryFaint` tint), `minHeight` 40-44 with `hitSlop`. `<SegmentedControl>` for the give-amount selector. Replaces bespoke pills (radius split 999 vs 16). |
| `EmptyState` | CREATE | `<EmptyState icon title body action>`: one icon badge (tokened circle in `primaryFaint`), title via `Type.title`, optional CTA via shared `Button`. Replaces improvised empties (icon 32 vs 64, title 13/15/20). Keep the deadpan "Empty." voice. |
| `ScreenLoader` / `Spinner` | CONSOLIDATE (`LoadingPulse` exists) | `<ScreenLoader>` centers `LoadingPulse` on `Colors.background`; small inline `<Spinner>`. `LoadingPulse` is imported once (`app/_layout.tsx`); 111 raw `ActivityIndicator` across 45 files each hand-placed. Route full-screen loads through `ScreenLoader`. |
| `Eyebrow` | CREATE | `<Eyebrow>` bound to `Type.eyebrow`, one letter-spacing (1.4), accent rule: `primary` for live/actionable sections, `textMuted` for passive labels. Replaces ~20 hand-set kickers with tracking ranging 0.5/1.4/1.6/2/2.4. |
| `IconTile` | CREATE | `<IconTile size>`: `primaryFaint` bg, corner from token. Replaces hardcoded radius 6/7 icon boxes (`family/index.tsx:122`, `network:134`, `profile:366,391`). |
| `Avatar` / `StatureAvatar` | CONSOLIDATE | One initials-avatar with one background rule. Delete inline avatar Views (`network:133`, `profile:366`) and the dead `avatar`/`avatarText` styles in `PostCard.tsx:729-736`. |
| `MobileTabBar` | EXISTS, repair | Single bottom-nav source of truth. Delete the dead 4-slot `CustomTabBar` + `NAV` + stale docstrings in `app/(tabs)/_layout.tsx`. Add `paddingBottom: env(safe-area-inset-bottom)`. Give every slot `accessibilityRole="button"` + label + `accessibilityState.selected`. Inactive labels use `Colors.textSecondary`, not `textMuted`. |

---

## 4. The Inconsistency Inventory

Deduplicated across the four lenses, severity-ranked. Each row is a checklist item with file evidence.

| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | HIGH | Two type scales, one dead, contradicting | `design.ts:41-64` `Type` vs `typography.ts:39-87` `Typography`; `Typography.*` = 0 usages; `Type` in 6 files; `body` 16 vs 14, `title` 20/600 vs `h1` 22/700 | Delete `Typography`, keep `Weight`, make `Type` canonical |
| 2 | HIGH | Hardcoded `rgba(22,22,29)` surfaces do not recolor | `give/index.tsx:233,293`; `give/transparency.tsx:197`; `memoir/index.tsx:995,1017` | Replace with `Colors.surface`; add `surfaceTranslucent` if needed |
| 3 | HIGH | `brandIvory` headings near-invisible in light mode | `give/index.tsx:222-224,316-318` vs light `background` `#F4F1E8` (`colors.ts:89`) | Use `Colors.textPrimary` |
| 4 | HIGH | Shared Button dead and mis-colored (white on gold, ~1.9:1) | `<Button>` rendered in 3 files; `Button.tsx:41,52` bg `Colors.primary` + `color:'#FFF'`; correct hand-rolls use `#0A0A0F` (`give:281`, `journal:930`) | One Button, `Colors.onPrimary`, adopt everywhere |
| 5 | HIGH | ~22 hand-rolled primary CTAs, 4 radii, 2 foreground colors | `settings:400` (r999), `family:143` (r999), `ConfirmSheet:96` (r999), `FlagModal:610` (r10); pill vs rounded-rect split | Delete all locals, route to Button |
| 6 | HIGH | Skin personality tokens never reach screens | `Gen.displayFont/radius/displayTransform` read only in `GlitchText:41`, `GenerationSwitcher:63,75`; inline `fontFamily` = 110 across 33 files | Route display/body font + radius through `Gen.*` |
| 7 | HIGH | No shared ScreenHeader; 41 bespoke headers | back icon 20 (`hunt:54`,`give:98`) vs 22 (`chat:60`,`settings:180`); title 16/18/20/22/28; `Heights.topHeader` unused | Create `ScreenHeader` |
| 8 | HIGH | No shared Modal; copy-pasted `borderRadius:14` (off-scale) | `settings:410`, `profile:417`, `family/[id]:640`, `FeedComposer:967`; backdrop 0.5/0.55/0.7 | Create `Modal`, `Radius.lg`, one backdrop |
| 9 | HIGH | Button touch targets below 44px | `Button.tsx:47-49` sm 7 (~28px), md 10 (~36px); `Heights` imported in 1 file (`reset-password:428`) | Map size to `Heights`, `minHeight` floor 44 |
| 10 | HIGH | MobileTabBar no safe-area inset | `MobileTabBar.tsx:167-180` paddingVertical 6, height 64, no `env(safe-area-inset-bottom)`; only `public/wayfinder.html:43` handles it | Add `paddingBottom: env(safe-area-inset-bottom)` |
| 11 | HIGH | Two contradictory bottom-navs; docstring lies | dead `CustomTabBar` `app/(tabs)/_layout.tsx:98` (4 slots, never mounted) vs live `MobileTabBar` (5 slots) | Delete `CustomTabBar` + `NAV` + docstring |
| 12 | HIGH | accessibilityLabel absent on nav + icon-only controls | only `MobileTabBar:108` labeled; `Button.tsx:23` no role/label; back buttons `hunt:53`,`give:97`,`chat/[threadId]:156` unlabeled | Add roles + labels |
| 13 | MED | Heart hardcoded to Twitter red `#E0245E` | `PostCard.tsx:36,185,188`; stale "indigo" comment `:33-35`; `Colors.heart` used correctly in `rooms:140` | Delete `HEART_RED`, use `Colors.heart` |
| 14 | MED | Radius bypassed 102x / 52 files; missing card step | raw `borderRadius` 8-20 = 102 hits; `PostCard:719` uses `Radius.md` but FlagModal `:537,547,565` hardcodes | Add `Radius.card` 12; tokenize; lint numeric radius |
| 15 | MED | Eyebrow token re-invented with drifting tracking | `Type.eyebrow` ls1.4 used by 1-2 files; hand-set 0.5/1.6/2/2.4 (`give:218,240`, `hunt:127,139`, `memoir:876`); `DropCard:96-99` overrides weight 700 to 800 | Create `Eyebrow`, one tracking |
| 16 | MED | LoadingPulse used once; 111 raw ActivityIndicators | `LoadingPulse` only in `_layout.tsx`; ad-hoc margins `network:53`,`family:40`,`settings:51` | Create `ScreenLoader` |
| 17 | MED | No EmptyState; improvised icon/title/CTA | `family:135-146` (64px, 20/600, CTA) vs `network:124-125` (32px, 15/600, none) vs `profile:375` (13, none) | Create `EmptyState` |
| 18 | MED | No Chip; radius split 999 vs 16 | `give:243` (r16), `network:146` (r999), `profile:404` (r999) | Create `Chip` / `SegmentedControl` |
| 19 | MED | Input/Field duplicated 8+ files; one abandons tokens | `settings:382`, `profile-setup:199`, `notifications:299`, `family/new:85`; `welcome:319` hardcodes hex; `Heights.input` unused | Create `Field`/`Input` |
| 20 | MED | Six screen-title scales; `Type.title` unused | `hunt:130` (22/800), `network:119` (18/700), `family:115` (28/700), `give/transparency:190` (28/800), `rooms:107` (22/800), `memoir:983` (18) | Route titles through `Type.title`/`display` |
| 21 | MED | Breakpoint 768 vs 1024 creates 769-1023 nav dead-zone | `feed/index.tsx:59` `>768`, `LeftSidebar:41` 1024; top header hides before sidebar appears | Export one breakpoint (1024) |
| 22 | MED | `textMuted` at 11-12px fails AA on dark skins | `MobileTabBar:182` 11px `textMuted` `#7A7568` on `#16161D` ~3.9:1; alpha `#6E76A8` on `#120E22` ~4.3:1 | Use `textSecondary` for text under 14px |
| 23 | MED | Ad-hoc bottom-space reservation | correct `chat:33`,`feed/[postId]:52` use const; hardcoded 100 (`hunt:124`,`memoir:814`,`profile:328`), 110 (`rooms:105`) | One exported value incl. safe-area |
| 24 | LOW | `Heights` effectively unused | only `reset-password:427-428`; buttons set own paddingVertical | Drive sizing from `Heights` via shared atoms |
| 25 | LOW | Off-scale fractional + one-off display sizes | `PostCard:753,815,838` (11.5); `give:222` (50), `:317` (38); `memoir:817` (26) | Snap 11.5 to caption; add `Type.hero` |
| 26 | LOW | Icon-tile radius 6/7 hardcoded; competing avatars | `family:122`,`network:134`,`profile:366,391`; dead `PostCard:729-736` avatar styles | Create `IconTile`; one Avatar |
| 27 | LOW | Feed header icons + chips under 44px | `feed/index.tsx:166-170` 36x36 no hitSlop; `:179` chip pv7 + 13px ~31px in horizontal ScrollView | `minHeight` 44 + hitSlop |
| 28 | LOW | Literal `999` vs `Radius.full`; off-scale 2/6/7/8/14 | `FeedComposer` mixes both plus raw `817,940,957,967,978` | Forbid literal radii |

---

## 5. The Unification Plan (low-risk first)

The owner hates surprises. Phases 1 and 2 are safe: they change token internals and shared components
without visibly redesigning any screen, and they fix outright bugs. Phase 3 is the screen-by-screen
migration, batched for review, and it is where visible change happens, so it needs sign-off per batch.

### Phase 1 — Token layer (no screen edits, propagates automatically)

Safe because these change values the screens already read, or add tokens nothing yet depends on.

1. Delete `constants/typography.ts` `Typography` StyleSheet; keep `Weight` (re-export from `design.ts`
   or leave the file with only `Weight`/`Fonts`). `Button.tsx:4` keeps working. Zero visual change
   (Typography had zero usages).
2. Add tokens: `Type.cardTitle` (17/24/700/-0.2), `Type.hero` (44/48/800/-0.5), `Radius.card` (12),
   `Colors.onPrimary` (dark ink `#0A0A0F` on gold skins, white where primary is dark) in both `dark`
   and `light` and every generation palette. Additive only, nothing changes until consumed.
3. Fix the `design.ts:31` "polished SaaS" comment to name the salvage aesthetic. Comment-only.

### Phase 2 — Shared component repair (fixes bugs, propagates to current consumers only)

Low blast radius because these components are barely used today, so repairing them cannot regress
30 screens. Two of these are bug fixes the owner should be told about because they visibly correct a
broken state.

4. Repair `Button.tsx`: primary foreground to `Colors.onPrimary` (FIXES white-on-gold contrast),
   size to `Heights` with 44px `minHeight` floor, text via `Type.ui`, corner via `Gen.radius`, add
   `accessibilityRole="button"` + forward `title` as label. Only affects the 3 files that render it.
   VISIBLE: the three auth CTAs get dark ink and 44px height. Flag for approval.
5. Delete dead `HEART_RED` in `PostCard.tsx:36`, use `Colors.heart`. VISIBLE: feed heart shifts from
   pink-red `#E0245E` to warm brand red `#C73E3A`. This is an intended de-Twitter-ing per PARADIGM;
   flag for approval since it touches the most-seen screen.
6. Delete dead `CustomTabBar` + `NAV` + stale docstrings in `app/(tabs)/_layout.tsx`. No render change
   (it was never mounted); removes the trap that would reintroduce divergence.
7. Add `paddingBottom: env(safe-area-inset-bottom)` to `MobileTabBar` and fold into
   `MOBILE_TAB_BAR_HEIGHT`; switch inactive labels to `Colors.textSecondary`; add per-slot
   `accessibilityRole`/label/`selected`. VISIBLE on notched PWA (icons clear the home indicator) and
   slightly lighter inactive labels. Flag for approval.
8. Export one breakpoint constant (1024) and consume it in `feed/index.tsx`, `app/(tabs)/_layout.tsx`,
   `LeftSidebar`, `MobileTabBar`. Fixes the 769-1023 nav dead-zone. Low visual risk.
9. Build the new shared atoms into `components/shared/`: `Screen`, `ScreenHeader`, `Card`, `Modal`
   (consolidate `ConfirmSheet`), `Field`/`Input`, `Chip`/`SegmentedControl`, `EmptyState`,
   `ScreenLoader` (wrap `LoadingPulse`), `Eyebrow`, `IconTile`. All wired to tokens and `Gen.*`. These
   ship unused, so nothing changes until Phase 3 adopts them.

### Phase 3 — Screen conformance (batched, each batch reviewable)

Migrate screens onto the shared atoms and delete the local styles. Group so each PR is one coherent
review. Every batch is a visible change, so each ships to the owner for approval before merge.

- Batch A, feed: `PostCard`, `FeedComposer`, `NewsCard`, `LoftCard`, `DropCard`, `feed/index.tsx`.
  Pin all four card families to `Type.cardTitle`, keep the colored-rail system, adopt `Button`,
  `Eyebrow`, `Chip`. This is the most-seen surface; review first and carefully.
- Batch B, rooms and discovery: `rooms.tsx`, `hunt/index.tsx`, `network/index.tsx`.
  Adopt `ScreenHeader`, `Screen`, `Eyebrow`, `Button`.
- Batch C, give and memoir: `give/*`, `memoir/*`. Adopt `Screen`, `ScreenHeader`, `Button`, `Card`;
  route hero heads to `Type.hero`; replace `rgba(22,22,29)` with `Colors.surface` and `brandIvory`
  heads with `textPrimary` (FIXES the invisible-in-light-mode headings).
- Batch D, family and profile: `family/*`, `profile/*`, `settings`, `notifications`. Adopt `Field`,
  `Input`, `EmptyState`, `Modal`, `Button`, `IconTile`, `Avatar`.
- Batch E, journal, chat, letter, auth, remainder. Adopt the full set; delete every remaining local
  header/button/modal/input style.

After each batch, run a lint rule banning numeric `borderRadius`, inline `fontFamily`, hardcoded hex in
input styles, and `backgroundColor: Colors.primary` inside a `TouchableOpacity`/`Pressable`. The lint
is what keeps the app converged after the migration.

---

## 6. What Not To Do

Guardrails so unification does not sand off the paradigm. `docs/PARADIGM.md` governs: the bar with no
sign, salvage-punk analog, anti-advertising, no explainer copy, discovery is earned.

- Do not adopt the Twitter/Instagram heart red. `#E0245E` and its "same hue they converged on" comment
  (`PostCard.tsx:33-35`) are the exact convention this product rejects. `Colors.heart` is the warm
  brand red; use it. Not looking like Twitter is the point.
- Do not add engagement gimmicks: no emoji-reaction bars, streaks, algorithmic For You, like-counters
  as social proof, bouncy spring micro-interactions, or "polished SaaS" pill-everywhere styling. The
  "fire a Shakespeare line" reaction and the deadpan "Empty." state are the on-brand tone; keep them.
- Do not flatten the skins into one look while unifying. The goal is the opposite: make `Gen.*` reach
  the whole tree so Alpha gets mono type and radius-2 sharp corners and Boomer gets serif and soft
  corners. Unification means one system that reskins completely, not one fixed appearance.
- Do not standardize on the generic rounded pill for buttons. Given the anti-SaaS ethos, drive corners
  from `Gen.radius` (flat/sharp on Alpha, soft on Boomer) rather than defaulting every CTA to r999.
- Do not add onboarding tours, explainer tooltips, empty-state marketing copy, or a pitch page. No
  funnel. Empty states stay terse.
- Do not touch the feed rail treatment except to tokenize its type. The recessed canvas + hairline top
  rule + per-source colored left-edge + eyebrow kicker (`NewsCard`, `LoftCard`, `DropCard`) is the
  best-executed, most on-paradigm UI in the app. Make it the house card standard; do not redesign it.
- Do not keep tokens that lie about being used. If `Heights` is not adopted as the height source, delete
  it rather than leaving a decorative token. The whole point of this work is that the tokens are true.
