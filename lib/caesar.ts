/**
 * Caesar shift cipher.
 *
 * Letters rotate, everything else passes through untouched — punctuation,
 * digits, spaces, emoji. Keeping non-letters intact is deliberate: a kid
 * decoding a message needs the word shapes and sentence breaks to check their
 * work against, and mangling them turns a puzzle into noise.
 *
 * This is a toy, not security. It is a 2000-year-old cipher with 25 possible
 * keys and `crack()` below breaks it exhaustively in a millisecond. Never use
 * it for anything that matters.
 */

const A = 65;
const Z = 90;
const a = 97;
const z = 122;

/** Normalise any integer shift into 0..25, including negatives. */
function normalise(shift: number): number {
  if (!Number.isFinite(shift)) return 0;
  return (((Math.trunc(shift) % 26) + 26) % 26);
}

export function encode(text: string, shift: number): string {
  const s = normalise(shift);
  if (s === 0) return text;

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= A && code <= Z) {
      out += String.fromCharCode(((code - A + s) % 26) + A);
    } else if (code >= a && code <= z) {
      out += String.fromCharCode(((code - a + s) % 26) + a);
    } else {
      // Surrogate pairs pass through as their two halves, which recombine
      // untouched because neither half falls in the letter ranges.
      out += text[i];
    }
  }
  return out;
}

export function decode(text: string, shift: number): string {
  return encode(text, -shift);
}

/**
 * Every possible decoding, for when you have a message and not the key.
 *
 * Returned shift is the one to pass to decode() to get that line, so a kid can
 * scan for the row that reads like English and then learn the key from it
 * rather than being handed the answer.
 */
export function crack(text: string): Array<{ shift: number; text: string }> {
  const out: Array<{ shift: number; text: string }> = [];
  for (let shift = 1; shift < 26; shift++) {
    out.push({ shift, text: decode(text, shift) });
  }
  return out;
}
