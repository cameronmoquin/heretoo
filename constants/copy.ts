/**
 * copy.ts — the words. Cameron's file.
 *
 * ────────────────────────────────────────────────────────────────────
 * THIS FILE IS THE AUTHOR'S. Claude does not write in it.
 *
 * Every user-facing sentence the app says lives here so it can be
 * edited without touching code. Change the text between the backticks,
 * say the word, and it deploys. Nothing else needs to move.
 * ────────────────────────────────────────────────────────────────────
 *
 * HOW TO EDIT
 *   - Text sits between backticks: `like this`
 *   - Apostrophes and quotes are safe inside backticks. Don't panic.
 *   - Line breaks inside the backticks appear in the app as written.
 *   - A blank string ``  hides that line entirely.
 *   - {reach} and {rate} are filled in by the app with live numbers.
 *     Leave them spelled exactly that way or delete them.
 *   - Don't remove a key or rename it. Empty it instead.
 *
 * The comment above each block says where it appears on screen.
 */

export const Copy = {
  advertise: {
    /** The page's own heading. */
    title: `Advertising`,

    /** Under the big price number. */
    priceUnit: `a month`,

    /**
     * The price explanation, under the number.
     * {reach} = how many people are on HereToo right now.
     * {rate}  = dollars per hundred people (currently 20).
     */
    priceWhy: `There are {reach} people here today. The rate is ${'$'}{rate} for every hundred of them. When more arrive the price rises, and you are never charged for growth that has not happened yet.`,

    /** Shown instead of the number if the live count can't be reached. */
    priceFallback: `${'$'}{rate} for every hundred people here, per month.`,

    /**
     * The body of the page. Each string is its own paragraph. Add or
     * remove paragraphs freely; the list can be any length, including
     * empty (`terms: []` shows no prose at all).
     */
    terms: [
      `Small businesses only. A jeweler, an Etsy shop, the ice-cream stand, not a corporation. Every ad is placed by hand and held to the same artistic standard as the gallery it hangs in. Most applications will be declined, and the standard is not negotiable.`,
      `Targeting is three declared facts: age, gender identity, and location. Nothing else. No tracking, no pixels, no dashboard, no data going back to you. You are buying a place on the wall, the way the town paper sold one.`,
      `Approval comes before payment, billing is by Stripe, and nothing is owed for applying.`,
    ],

    /** The small labels above each field. */
    fieldBusiness: `Business`,
    fieldEmail: `Email`,
    fieldLink: `Where we can see your work`,
    fieldPitch: `The pitch`,
    fieldTargeting: `Who it's for (each optional)`,

    /** Greyed-out hints inside the boxes. */
    placeholderLink: `https://`,
    placeholderAge: `Age`,
    placeholderGender: `Gender identity`,
    placeholderLocation: `Location`,

    /** The button, and what it says mid-send. */
    submit: `Apply`,
    submitting: `Sending`,

    /** The whole page after a successful send. */
    received: `Received. If it passes the standard, you'll hear from us.`,
  },
} as const;
