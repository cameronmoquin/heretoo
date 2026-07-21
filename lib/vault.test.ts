import { describe, it, expect } from 'vitest';
import {
  sealEntry, openEntry, isWrongPassphrase,
  toBase64, fromBase64,
  WrongPassphraseError, SealedFormatError,
  VAULT_VERSION, DEFAULT_ITERATIONS, MIN_ITERATIONS,
  type SealedEntry,
} from './vault';

// PBKDF2 at 210k rounds is deliberately slow. Tests that only need a
// round trip use the floor so the suite stays quick; the tests that
// care about the real default assert on it directly.
const FAST = { iterations: MIN_ITERATIONS };

const PLAIN = 'The thing I have not said out loud.';
const PASS = 'correct horse battery staple';

describe('round trip', () => {
  it('opens with the passphrase it was sealed with', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    expect(await openEntry(sealed, PASS)).toBe(PLAIN);
  });

  it('survives unicode, newlines, and emoji', async () => {
    const messy = 'line one\nline two\n\ttabbed\né ü ñ 中文 🜃 👁️‍🗨️ 𝔊';
    const sealed = await sealEntry(messy, PASS, FAST);
    expect(await openEntry(sealed, PASS)).toBe(messy);
  });

  it('handles an empty body and a long body', async () => {
    const empty = await sealEntry('', PASS, FAST);
    expect(await openEntry(empty, PASS)).toBe('');

    const long = 'x'.repeat(200_000);
    const sealedLong = await sealEntry(long, PASS, FAST);
    expect(await openEntry(sealedLong, PASS)).toBe(long);
  });

  it('treats the passphrase as exact, including whitespace and case', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(openEntry(sealed, PASS + ' ')).rejects.toThrow(WrongPassphraseError);
    await expect(openEntry(sealed, PASS.toUpperCase())).rejects.toThrow(WrongPassphraseError);
  });
});

describe('wrong passphrase', () => {
  it('throws WrongPassphrase, and does not leak the plaintext', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(openEntry(sealed, 'not the passphrase')).rejects.toThrow(WrongPassphraseError);
  });

  it('names itself so callers can branch on it across bundles', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    const err = await openEntry(sealed, 'wrong').catch((e) => e);
    expect(err.name).toBe('WrongPassphrase');
    expect(isWrongPassphrase(err)).toBe(true);
  });

  it('rejects an empty passphrase rather than deriving from nothing', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(openEntry(sealed, '')).rejects.toThrow(WrongPassphraseError);
  });

  it('refuses to seal with an empty passphrase', async () => {
    await expect(sealEntry(PLAIN, '')).rejects.toThrow(/passphrase is required/i);
  });
});

describe('randomness', () => {
  it('two seals of identical plaintext share no ciphertext, iv, or salt', async () => {
    const a = await sealEntry(PLAIN, PASS, FAST);
    const b = await sealEntry(PLAIN, PASS, FAST);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
    // Both still open. Different bytes, same words.
    expect(await openEntry(a, PASS)).toBe(PLAIN);
    expect(await openEntry(b, PASS)).toBe(PLAIN);
  });

  it('produces no repeats across many seals', async () => {
    const seals: SealedEntry[] = [];
    for (let i = 0; i < 12; i++) seals.push(await sealEntry(PLAIN, PASS, FAST));
    expect(new Set(seals.map((s) => s.ciphertext)).size).toBe(seals.length);
    expect(new Set(seals.map((s) => s.iv)).size).toBe(seals.length);
    expect(new Set(seals.map((s) => s.salt)).size).toBe(seals.length);
  });

  it('uses a 16-byte salt and a 12-byte iv', async () => {
    const s = await sealEntry(PLAIN, PASS, FAST);
    expect(fromBase64(s.salt).length).toBe(16);
    expect(fromBase64(s.iv).length).toBe(12);
  });
});

describe('tampering', () => {
  const flipLast = (b64: string) => {
    const bytes = fromBase64(b64);
    bytes[bytes.length - 1] ^= 0xff;
    return toBase64(bytes);
  };

  it('fails when the ciphertext is altered', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    const tampered = { ...sealed, ciphertext: flipLast(sealed.ciphertext) };
    await expect(openEntry(tampered, PASS)).rejects.toThrow(WrongPassphraseError);
  });

  it('fails when a byte in the middle of the ciphertext is altered', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    const bytes = fromBase64(sealed.ciphertext);
    bytes[Math.floor(bytes.length / 2)] ^= 0x01;
    await expect(
      openEntry({ ...sealed, ciphertext: toBase64(bytes) }, PASS),
    ).rejects.toThrow(WrongPassphraseError);
  });

  it('fails when the iv is altered', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(
      openEntry({ ...sealed, iv: flipLast(sealed.iv) }, PASS),
    ).rejects.toThrow(WrongPassphraseError);
  });

  it('fails when the salt is altered', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(
      openEntry({ ...sealed, salt: flipLast(sealed.salt) }, PASS),
    ).rejects.toThrow(WrongPassphraseError);
  });

  it('fails when the iteration count is changed under it', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(
      openEntry({ ...sealed, iterations: sealed.iterations + 1 }, PASS),
    ).rejects.toThrow(WrongPassphraseError);
  });
});

describe('sealed record shape', () => {
  it('carries the version and a real iteration count', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    expect(sealed.v).toBe(VAULT_VERSION);
    expect(sealed.iterations).toBeGreaterThanOrEqual(MIN_ITERATIONS);
  });

  it('defaults to 210000 rounds', async () => {
    const sealed = await sealEntry('short', PASS);
    expect(sealed.iterations).toBe(DEFAULT_ITERATIONS);
    expect(DEFAULT_ITERATIONS).toBeGreaterThanOrEqual(210_000);
    expect(await openEntry(sealed, PASS)).toBe('short');
  });

  it('never floors below the minimum, even when asked', async () => {
    const sealed = await sealEntry(PLAIN, PASS, { iterations: 1 });
    expect(sealed.iterations).toBe(MIN_ITERATIONS);
  });

  it('holds only base64 strings and numbers, no plaintext', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    const json = JSON.stringify(sealed);
    expect(json).not.toContain(PLAIN);
    expect(json).not.toContain(PASS);
    expect(Object.keys(sealed).sort()).toEqual(
      ['ciphertext', 'iterations', 'iv', 'salt', 'v'],
    );
    for (const f of [sealed.ciphertext, sealed.iv, sealed.salt]) {
      expect(f).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    }
  });

  it('rejects a malformed record before touching the key', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(openEntry({ ...sealed, ciphertext: '' }, PASS))
      .rejects.toThrow(SealedFormatError);
    await expect(openEntry({ ...sealed, iv: '' }, PASS))
      .rejects.toThrow(SealedFormatError);
    await expect(openEntry({ ...sealed, salt: '' }, PASS))
      .rejects.toThrow(SealedFormatError);
    await expect(openEntry({ ...sealed, iterations: 10 }, PASS))
      .rejects.toThrow(SealedFormatError);
    await expect(openEntry({ ...sealed, v: 99 }, PASS))
      .rejects.toThrow(SealedFormatError);
    await expect(openEntry(null as any, PASS))
      .rejects.toThrow(SealedFormatError);
  });

  it('rejects base64 with characters outside the alphabet', async () => {
    const sealed = await sealEntry(PLAIN, PASS, FAST);
    await expect(openEntry({ ...sealed, ciphertext: '!!!!' }, PASS))
      .rejects.toThrow(SealedFormatError);
  });
});

describe('base64 helpers', () => {
  it('round-trips every byte value at every length remainder', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 255, 256, 257]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 7 + 13) % 256;
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('matches known vectors', () => {
    const enc = (s: string) => toBase64(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg==');
    expect(enc('fo')).toBe('Zm8=');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('foob')).toBe('Zm9vYg==');
    expect(enc('fooba')).toBe('Zm9vYmE=');
    expect(enc('foobar')).toBe('Zm9vYmFy');
  });
});
