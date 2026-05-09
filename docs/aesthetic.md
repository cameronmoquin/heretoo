# HereToo Aesthetic Codex (M10)

This is the working pointer to the canonical numbers. The full prose
rationale lives in `docs/heretoo-source-of-truth.md` (Milestone 10).
The runtime values live in `constants/codex.ts`. This file is a
short index for "where does X live?"

## Tokens at a glance

| Concern              | File                              | Notes                                              |
|----------------------|-----------------------------------|----------------------------------------------------|
| Type families        | `constants/codex.ts → Fonts`      | Syne / Inter / Source Serif 4 / IBM Plex Mono     |
| Type scale           | `constants/codex.ts → TypeScale`  | display, title, body, caption, kicker, letter     |
| Motion easing        | `constants/codex.ts → Motion`     | `cubic-bezier(0.2, 0.0, 0, 1)` — never bouncy     |
| Motion durations     | `constants/codex.ts → Motion`     | 200ms ui, 400ms room switch, 600ms letter open    |
| Voice calibration    | `constants/codex.ts → VoiceSettings` | stability 0.62 / similarity 0.78 / style 0.18 |
| Avatar shape         | `constants/codex.ts → Avatar`     | 16px radius squircle, sizes 48 / 96 / 128         |
| Brand-mark sizes     | `constants/codex.ts → BrandMark`  | favicon 32, pwa 1024, og 1200×630, email 600×100  |
| Theme palettes       | `constants/colors.ts`             | Dark default, light opt-in                         |

## Tone rules

- **Empty state.** Two sentences max. First: plain observation
  ("Quiet day."). Second: optional subdued action. Never apology,
  never "oops." The platform is never sorry it has nothing to show.
- **Error state.** Plain language. "Could not save that. Try again?"
  Never "Error 500" exposed to users. Never "Something went wrong"
  alone — always offer the next move. The `Copy.error()` helper in
  `codex.ts` enforces the pattern for new surfaces.

## Iconography note

The codex calls for **Lucide single-weight (1.5px stroke)**. The
current codebase uses **Ionicons**. The migration is deferred — when
we touch a screen for another reason, prefer Lucide's outline variant
of the closest match. `IconSpec.preferredSet === 'lucide'` is the
documented intent.

## Refusals

Never:
- Emoji in UI chrome (emoji in user content is fine).
- Gradient logos.
- Drop shadows on cards (use 1px hairline borders at low alpha).
- Gamification iconography (badges, streaks, fire-emoji equivalents).
- "Powered by" footers from third-party libraries.
- Spring animations or bounce hearts.
