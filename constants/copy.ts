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
     * The price explanation, under the number. EMPTY — the sentence that
     * was here was written by Claude and never cleared. The page shows no
     * explanation until you put one here.
     * {reach} = how many people are on HereToo right now.
     * {rate}  = dollars per hundred people (currently 20).
     */
    priceWhy: ``,

    /**
     * Shown instead of the number if the live count can't be reached.
     * EMPTY for the same reason. While it is empty that rare case shows
     * no price at all.
     */
    priceFallback: ``,

    /**
     * The body of the page. Each string is its own paragraph. Add or
     * remove paragraphs freely; the list can be any length.
     *
     * EMPTIED. Three paragraphs stood here that you never approved. The
     * page now runs as a bare form: heading, price, fields, button.
     */
    terms: [] as string[],

    /** The small labels above each field. */
    fieldBusiness: `Business`,
    fieldEmail: `Email`,
    fieldLink: `Link`,
    fieldPitch: `Pitch`,
    fieldTargeting: `Targeting`,

    /** Greyed-out hints inside the boxes. */
    placeholderLink: `https://`,
    placeholderAge: `Age`,
    placeholderGender: `Gender identity`,
    placeholderLocation: `Location`,

    /** The button, and what it says mid-send. */
    submit: `Apply`,
    submitting: `Sending`,

    /**
     * The whole page after a successful send. Trimmed to the bare
     * acknowledgement; the sentence that followed it was Claude's.
     */
    received: `Received.`,
  },
} as const;
