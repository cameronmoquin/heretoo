/**
 * SecureStore adapter that survives values over 2 KB.
 *
 * expo-secure-store warns above 2048 bytes on Android and the write can fail.
 * A Supabase session — access JWT + refresh token + the user object and its
 * metadata — routinely lands near or past that, and when it fails it fails
 * *silently*: setItemAsync rejects, supabase-js swallows it, and the app looks
 * fine until the next cold start signs the user out.
 *
 * That is tolerable on a phone whose owner can retype a password. It is not
 * tolerable on the Jude-a-phone, where being signed in is the whole point and
 * the user cannot sign back in.
 *
 * Layout. The base key holds either:
 *   - a plain value, when it fits (and for anything written by the previous
 *     un-chunked adapter — that is the migration path, read below), or
 *   - "__chunks__:N", with the parts under `${key}.0` … `${key}.N-1`.
 *
 * Reading a legacy plain value therefore Just Works: it does not carry the
 * marker, so it is returned as-is. The next write re-saves it chunked. No
 * migration step, no flag day, and an existing signed-in build does not get
 * logged out by shipping this.
 */

const MARKER = '__chunks__:';

/**
 * 1536, not 2048. The limit applies to the encrypted payload rather than the
 * plaintext, and base64 plus the cipher overhead expand it — leaving headroom
 * is cheaper than discovering the boundary on a provisioned device.
 */
const CHUNK_SIZE = 1536;

type Backend = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/**
 * UTF-8 byte length of a single code point, without TextEncoder — Hermes has
 * it, but this is small enough not to depend on it.
 */
function codePointBytes(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

function byteLength(value: string): number {
  let n = 0;
  for (const ch of value) n += codePointBytes(ch.codePointAt(0)!);
  return n;
}

/**
 * Split on code-point boundaries under a BYTE budget.
 *
 * The limit SecureStore enforces is on bytes; slicing by string index is a
 * different unit. 'José 🌲' is 7 characters and 12 bytes, so a 1536-character
 * slice can reach 6 KB — three times over the ceiling. Iterating code points
 * also keeps surrogate pairs intact, which a raw .slice() would tear in half.
 */
function splitByBytes(value: string, maxBytes: number): string[] {
  const out: string[] = [];
  let chunk = '';
  let bytes = 0;

  for (const ch of value) {
    const b = codePointBytes(ch.codePointAt(0)!);
    if (bytes + b > maxBytes) {
      out.push(chunk);
      chunk = ch;
      bytes = b;
    } else {
      chunk += ch;
      bytes += b;
    }
  }
  if (chunk) out.push(chunk);
  return out;
}

export function createChunkedSecureStorage(SecureStore: Backend) {
  /** Remove any chunk parts left from a previous, longer value. */
  const clearChunks = async (key: string, upTo: number) => {
    for (let i = 0; i < upTo; i++) {
      try {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      } catch {
        // Absent is the desired end state.
      }
    }
  };

  const readChunkCount = (raw: string | null): number | null => {
    if (!raw || !raw.startsWith(MARKER)) return null;
    const n = parseInt(raw.slice(MARKER.length), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    async getItem(key: string): Promise<string | null> {
      const head = await SecureStore.getItemAsync(key);
      const count = readChunkCount(head);
      if (count === null) return head; // plain value, or legacy, or absent

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        // A missing part means a torn write. Returning a truncated JSON blob
        // would hand supabase-js something it cannot parse; report absent so
        // it treats the session as gone and refreshes cleanly.
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      // Byte length, not string length — a JWT is ASCII but user metadata
      // carries names and emoji, and the limit is on bytes.
      const previous = readChunkCount(await SecureStore.getItemAsync(key)) ?? 0;

      if (byteLength(value) <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        await clearChunks(key, previous);
        return;
      }

      const parts = splitByBytes(value, CHUNK_SIZE);

      // Parts first, header last. If this is interrupted the header still
      // points at the old count, which getItem detects as a torn read rather
      // than reassembling a mix of old and new parts.
      for (let i = 0; i < parts.length; i++) {
        await SecureStore.setItemAsync(`${key}.${i}`, parts[i]);
      }
      await SecureStore.setItemAsync(key, `${MARKER}${parts.length}`);

      if (previous > parts.length) {
        for (let i = parts.length; i < previous; i++) {
          try {
            await SecureStore.deleteItemAsync(`${key}.${i}`);
          } catch {
            // Absent is fine.
          }
        }
      }
    },

    async removeItem(key: string): Promise<void> {
      const count = readChunkCount(await SecureStore.getItemAsync(key)) ?? 0;
      await clearChunks(key, count);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Absent is fine.
      }
    },
  };
}
