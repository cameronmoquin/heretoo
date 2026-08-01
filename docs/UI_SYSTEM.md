# HereToo UI System

The single source of truth for how the product looks. One appearance, everywhere,
always. No generation skins. No wallpaper.

Supersedes the aesthetic sections of `docs/PARADIGM.md` and the skin guidance in
`docs/UI_AUDIT.md`. The paradigm still governs behavior and content: no ads, no
metrics, no For You ranking sold as truth, no explainer copy, earned discovery.
Only the surface changed.

---

## 1. The decision

The reference is the calm end of modern social: one centered column, hairline
rules instead of boxed cards, large whitespace, round avatars, muted outline
action icons, rounded media. Legibility over character.

What that retires:

- The generation skin engine (`constants/generations.ts`, `stores/generationStore.ts`,
  `setGeneration`, every `Gen.*` read). Alpha glitch, Y2K, VHS, xerox zine,
  letterpress: gone.
- Wallpaper entirely (`components/shared/WallpaperBackground.tsx`,
  `stores/wallpaperStore.ts`, the crew wallpaper vote, `useFamilyWallpaper`).
- The CRT scanline overlay and glitch type.
- Boxed cards with colored left rails, eyebrow kickers, and gold.

Light and dark stay. That is a viewer preference, not a skin, and the reference
product has both.

---

## 2. Palette

Monochrome with one warm red reserved for the heart. Nothing else is colored.
An accent that appears everywhere stops meaning anything.

### Light

| Token | Value | Use |
|---|---|---|
| `background` | `#FFFFFF` | the canvas, flat |
| `surface` | `#FFFFFF` | rows sit on the canvas, no fill |
| `surfaceAlt` | `#F7F7F7` | inputs, subtle wells |
| `border` | `#E5E5E5` | hairline rules and dividers |
| `textPrimary` | `#0A0A0A` | body and headings |
| `textSecondary` | `#6B6B6B` | timestamps, secondary labels |
| `textMuted` | `#767676` | counts, placeholders. 4.54:1, clears AA |
| `primary` | `#0A0A0A` | primary buttons, active nav |
| `onPrimary` | `#FFFFFF` | ink on a primary fill |
| `heart` | `#FF3040` | the heart, and nothing else |
| `error` | `#D93025` | failures only |

### Dark

| Token | Value |
|---|---|
| `background` | `#101010` |
| `surface` | `#101010` |
| `surfaceAlt` | `#1C1C1C` |
| `border` | `#2A2A2A` |
| `textPrimary` | `#F5F5F5` |
| `textSecondary` | `#A0A0A0` |
| `textMuted` | `#8A8A8A` |
| `primary` | `#F5F5F5` |
| `onPrimary` | `#0A0A0A` |
| `heart` | `#FF3040` |
| `error` | `#F2564D` |

`Colors` stays a mutable object mutated by `setColorMode`. Every component must
read it at render time through a `makeStyles()` factory called inside the
component. A module-level `StyleSheet.create` captures a stale palette and will
not update. That rule is what makes a palette edit apply everywhere at once.

---

## 3. Type

One family. Inter, already loaded. Drop Syne and Source Serif 4 and their font
loading, along with every `fontFamily` override.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `hero` | 28 / 34 | 700 | rare, auth masthead |
| `display` | 24 / 30 | 700 | page titles ("For you") |
| `title` | 20 / 26 | 600 | section heads |
| `cardTitle` | 15 / 20 | 600 | author name |
| `body` | 15 / 21 | 400 | post body, reading text |
| `ui` | 14 / 19 | 500 | buttons, labels |
| `caption` | 13 / 18 | 400 | timestamps, counts |

Tight scale on purpose. Seven steps cover the product.

---

## 4. Space, radius, elevation

- Spacing scale unchanged: `xxs 4, xs 8, sm 12, md 16, lg 24, xl 32`.
- Column: one centered feed, `maxWidth 640`, horizontal padding `16`.
- Row rhythm: post padding `16` vertical, `16` horizontal.
- Radius: `media 12`, `control 8`, `pill 999` (avatars, chips only). Rows are
  square. No card corners, because there are no cards.
- Elevation: none. No shadows anywhere except the floating compose button.
  Separation is a hairline, not a shadow.

---

## 5. Components

**Row, not card.** A post is a full-width row with a `1px` bottom border in
`border`. No fill, no outline, no radius, no left rail, no kicker.

**Avatar.** 40px circle. 32px in dense contexts.

**Header.** Page title in `display`, left aligned, with an optional single
overflow control on the right. No back chevron where a tab owns the screen.

**Action row.** Outline icons at 22px in `textSecondary`, count beside each in
`caption`. Heart fills `heart` when active. No counts rendered as social proof
beyond the raw number, and no engagement tallies added anywhere new.

**Button.** Primary is a `primary` fill with `onPrimary` ink, radius `control`,
min height 44. Secondary is a `border` outline with `textPrimary` ink. Ghost is
text only. Never a gradient.

**Input.** `surfaceAlt` fill, no visible border until focus, radius `control`,
min height 44.

**Chip.** Pill, `surfaceAlt` default, `primary` fill with `onPrimary` when
selected. Used for filters.

**Compose.** Floating circular button bottom right on wide viewports. On mobile
it lives in the tab bar.

Retired components: `RailCard`, `Eyebrow`, `GlitchText`, `ScanlineOverlay`,
`WallpaperBackground`. `RailCard` and `Eyebrow` were built days ago for the
previous direction; they go with it.

---

## 6. What does not change

- No ads. No metrics dashboards. No algorithmic For You presented as neutral.
- No explainer copy, no onboarding tour, no empty-state marketing. Empty states
  stay terse fragments.
- Every control keeps its `accessibilityLabel`. Contrast must clear WCAG AA;
  the retired gold failed it at 1.9:1 on white and that must not recur.
- Vocabulary is unchanged: a group is a crew, a post is a drop.

---

## 7. Execution order

1. Land the in-flight unification work. It moves every screen to render-time
   token reads, which is the mechanism that makes step 3 a small change.
2. Rewrite the tokens: palette above, type above, radius and elevation above.
3. Strip the skin engine and wallpaper. Remove `Gen.*` reads, the generation
   store and its picker, the wallpaper store, background, vote, and the scanline
   and glitch components.
4. Convert the feed from cards to rows, then the remaining screens.
5. Re-measure: change one color token and confirm every screen moves.
