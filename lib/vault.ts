/**
 * vault — client-side sealing for journal entries.
 *
 * The promise the journal makes is that a sealed entry cannot be read
 * by anyone. That includes us. The only way to keep that promise is to
 * do the crypto here, on the device, and hand the server nothing it
 * could ever turn back into words.
 *
 * The server stores five things: ciphertext, iv, salt, iteration count,
 * and a version number. It never sees the passphrase. It never sees the
 * derived key. It never sees the plaintext. There is no recovery path,
 * no reset link, no support ticket that gets the words back. Lose the
 * passphrase and the entry is gone while still sitting in the table.
 *
 * Shape:
 *   PBKDF2-SHA256, 210,000 iterations, random 16-byte salt  → 256-bit key
 *   AES-GCM, random 12-byte IV                              → ciphertext
 *
 * AES-GCM is authenticated, so a wrong passphrase and a tampered
 * ciphertext fail the same way. Both surface as WrongPassphraseError.
 * We do not distinguish them, because distinguishing them would tell an
 * attacker which half of the problem they solved.
 *
 * Zero dependencies on purpose. Base64 and UTF-8 are hand-rolled rather
 * than reaching for Buffer, btoa, or TextEncoder, so this behaves the
 * same under Node, a browser, and a Hermes bundle.
 *
 * Web Crypto is required. Browsers only expose crypto.subtle in a
 * secure context, and bare React Native does not ship it at all. When
 * it is absent we throw rather than falling back to something weaker.
 */

// ── Parameters ──────────────────────────────────────────────────────

/** Bumped only when the seal format changes. Old entries keep their
 *  own version number so they stay openable. */
export const VAULT_VERSION = 1;

/** OWASP floor for PBKDF2-SHA256 as of 2023. Stored per entry so this
 *  can rise later without stranding anything already sealed. */
export const DEFAULT_ITERATIONS = 210_000;

/** Refuse to open anything claiming fewer rounds than this. Stops a
 *  tampered row from talking us into a cheap derivation. */
export const MIN_ITERATIONS = 100_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

// ── Types ───────────────────────────────────────────────────────────

/** Exactly what goes over the wire and into the table. All binary
 *  fields are base64 so this survives JSON. */
export interface SealedEntry {
  ciphertext: string;
  iv: string;
  salt: string;
  iterations: number;
  v: number;
}

// ── Errors ──────────────────────────────────────────────────────────

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

/** crypto.subtle is missing. Insecure context, or a runtime that never
 *  had it. Nothing can be sealed or opened here. */
export class CryptoUnavailableError extends VaultError {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoUnavailable';
  }
}

/** The passphrase did not open the entry, or the stored bytes were
 *  altered. Same error for both, by design. */
export class WrongPassphraseError extends VaultError {
  constructor(message = 'That passphrase does not open this entry.') {
    super(message);
    this.name = 'WrongPassphrase';
  }
}

/** The sealed record is malformed. A missing field, a bad base64
 *  character, an unsupported version. */
export class SealedFormatError extends VaultError {
  constructor(message: string) {
    super(message);
    this.name = 'SealedFormat';
  }
}

/** instanceof breaks across bundle boundaries. Check the name too. */
export function isWrongPassphrase(err: unknown): boolean {
  return err instanceof WrongPassphraseError
    || (err instanceof Error && err.name === 'WrongPassphrase');
}

// ── Web Crypto access ───────────────────────────────────────────────

function getCrypto(): Crypto {
  const c: Crypto | undefined = (globalThis as any)?.crypto;
  if (!c || typeof c.getRandomValues !== 'function' || !c.subtle) {
    throw new CryptoUnavailableError(
      'Sealing needs the Web Crypto API. It is missing here. '
      + 'Browsers only provide it over HTTPS or on localhost. '
      + 'Open this page on a secure origin and try again.',
    );
  }
  return c;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  getCrypto().getRandomValues(out);
  return out;
}

// ── UTF-8 ───────────────────────────────────────────────────────────

function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i) as number;
    if (cp > 0xffff) i++; // surrogate pair, second half consumed
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
    } else if ((b0 & 0xe0) === 0xc0) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if ((b0 & 0xf0) === 0xe0) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      cp = ((b0 & 0x07) << 18)
        | ((bytes[i++] & 0x3f) << 12)
        | ((bytes[i++] & 0x3f) << 6)
        | (bytes[i++] & 0x3f);
    }
    if (cp > 0xffff) {
      const n = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (n >> 10), 0xdc00 + (n & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}

// ── Base64 ──────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const B64_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < B64.length; i++) m[B64[i]] = i;
  return m;
})();

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 0x3f];
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_INDEX[clean[i]];
    if (v === undefined) {
      throw new SealedFormatError('This sealed entry is corrupted. Bad base64.');
    }
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

// ── Key derivation ──────────────────────────────────────────────────

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = getCrypto().subtle;
  const material = await subtle.importKey(
    'raw',
    // Copy into a fresh buffer so the view is a plain ArrayBuffer.
    utf8Encode(passphrase).slice().buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.slice().buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: KEY_BITS },
    // Not extractable. The key never leaves this call stack.
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Seal plaintext under a passphrase. Every call generates a fresh salt
 * and IV, so sealing the same words twice produces two records that
 * share nothing.
 *
 * The returned object is safe to hand to the server. It is the whole
 * record and it is opaque without the passphrase.
 */
export async function sealEntry(
  plaintext: string,
  passphrase: string,
  opts?: { iterations?: number },
): Promise<SealedEntry> {
  const subtle = getCrypto().subtle;

  if (typeof plaintext !== 'string') {
    throw new VaultError('Nothing to seal.');
  }
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new VaultError('A passphrase is required to seal an entry.');
  }

  const iterations = Math.max(MIN_ITERATIONS, opts?.iterations ?? DEFAULT_ITERATIONS);
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, iterations);

  const buf = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
    key,
    utf8Encode(plaintext).slice().buffer as ArrayBuffer,
  );

  return {
    ciphertext: toBase64(new Uint8Array(buf)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    iterations,
    v: VAULT_VERSION,
  };
}

/**
 * Open a sealed entry. Returns the plaintext in memory. Nothing is
 * cached and nothing is written anywhere.
 *
 * Throws WrongPassphraseError when the passphrase is wrong or the
 * stored bytes were altered. Throws SealedFormatError when the record
 * itself is malformed.
 */
export async function openEntry(
  sealed: SealedEntry,
  passphrase: string,
): Promise<string> {
  const subtle = getCrypto().subtle;

  if (!sealed || typeof sealed !== 'object') {
    throw new SealedFormatError('This sealed entry is missing.');
  }
  const { ciphertext, iv, salt, iterations, v } = sealed;

  if (typeof ciphertext !== 'string' || ciphertext.length === 0
    || typeof iv !== 'string' || iv.length === 0
    || typeof salt !== 'string' || salt.length === 0) {
    throw new SealedFormatError('This sealed entry is incomplete.');
  }
  if (typeof iterations !== 'number' || !Number.isFinite(iterations)
    || iterations < MIN_ITERATIONS) {
    throw new SealedFormatError('This sealed entry has a bad iteration count.');
  }
  if (v !== VAULT_VERSION) {
    throw new SealedFormatError(
      `This entry was sealed with format v${v}. This build reads v${VAULT_VERSION}.`,
    );
  }
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new WrongPassphraseError();
  }

  const saltBytes = fromBase64(salt);
  const ivBytes = fromBase64(iv);
  const cipherBytes = fromBase64(ciphertext);

  if (saltBytes.length === 0 || ivBytes.length === 0 || cipherBytes.length === 0) {
    throw new SealedFormatError('This sealed entry is corrupted.');
  }

  const key = await deriveKey(passphrase, saltBytes, iterations);

  let buf: ArrayBuffer;
  try {
    buf = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes.slice().buffer as ArrayBuffer },
      key,
      cipherBytes.slice().buffer as ArrayBuffer,
    );
  } catch {
    // AES-GCM auth failure. Wrong passphrase or tampered bytes. We do
    // not say which.
    throw new WrongPassphraseError();
  }

  return utf8Decode(new Uint8Array(buf));
}

/** True when this runtime can seal and open. Lets the UI hide the
 *  seal option instead of offering something that will throw. */
export function vaultAvailable(): boolean {
  try {
    getCrypto();
    return true;
  } catch {
    return false;
  }
}
