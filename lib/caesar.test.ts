import { describe, it, expect } from 'vitest';
import { encode, decode, crack } from './caesar';

describe('caesar', () => {
  it('shifts letters by the key', () => {
    expect(encode('abc', 1)).toBe('bcd');
    expect(encode('xyz', 3)).toBe('abc');
  });

  it('preserves case', () => {
    expect(encode('HeLLo', 1)).toBe('IfMMp');
  });

  it('leaves non-letters alone', () => {
    // The word shapes are what a kid checks their decoding against.
    expect(encode("Meet at 5 o'clock!", 3)).toBe("Phhw dw 5 r'forfn!");
  });

  it('round-trips', () => {
    const msg = 'The tree by the fence. Bring the map.';
    expect(decode(encode(msg, 7), 7)).toBe(msg);
  });

  it('treats shift 0 and 26 as identity', () => {
    expect(encode('unchanged', 0)).toBe('unchanged');
    expect(encode('unchanged', 26)).toBe('unchanged');
  });

  it('handles negative and oversized shifts', () => {
    expect(encode('abc', -1)).toBe('zab');
    expect(encode('abc', 27)).toBe('bcd');
    expect(encode('abc', -27)).toBe('zab');
    expect(encode('abc', 53)).toBe('bcd');
  });

  it('survives a non-finite shift rather than emitting NaN characters', () => {
    expect(encode('abc', NaN)).toBe('abc');
    expect(encode('abc', Infinity)).toBe('abc');
  });

  it('passes emoji and accents through intact', () => {
    // Surrogate pairs must not be torn apart by per-code-unit iteration.
    const msg = 'José 🌲 says hi';
    expect(decode(encode(msg, 5), 5)).toBe(msg);
    expect(encode(msg, 5)).toContain('🌲');
    expect(encode(msg, 5)).toContain('é');
  });

  it('handles an empty string', () => {
    expect(encode('', 4)).toBe('');
  });

  it('crack returns all 25 shifts with the real one among them', () => {
    const secret = encode('meet me at the oak tree', 11);
    const rows = crack(secret);
    expect(rows).toHaveLength(25);

    const hit = rows.find((r) => r.text === 'meet me at the oak tree');
    expect(hit).toBeDefined();
    // The shift reported is the one to hand decode(), not the encoding key's
    // complement — otherwise the lesson it teaches is wrong.
    expect(hit!.shift).toBe(11);
    expect(decode(secret, hit!.shift)).toBe('meet me at the oak tree');
  });
});
