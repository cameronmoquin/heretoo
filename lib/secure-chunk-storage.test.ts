import { describe, it, expect, beforeEach } from 'vitest';
import { createChunkedSecureStorage } from './secure-chunk-storage';

/**
 * Fake SecureStore that enforces the real constraint: Android rejects values
 * over 2048 bytes. Without that ceiling a test would pass against a backend
 * far more forgiving than the device, which is exactly the bug being guarded
 * against.
 */
function fakeSecureStore(limit = 2048) {
  const map = new Map<string, string>();
  return {
    map,
    getItemAsync: async (k: string) => (map.has(k) ? map.get(k)! : null),
    setItemAsync: async (k: string, v: string) => {
      if (new TextEncoder().encode(v).length > limit) {
        throw new Error(`value too large for ${k}`);
      }
      map.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      map.delete(k);
    },
  };
}

const KEY = 'sb-heretoo-auth-token';

describe('createChunkedSecureStorage', () => {
  let backend: ReturnType<typeof fakeSecureStore>;
  let store: ReturnType<typeof createChunkedSecureStorage>;

  beforeEach(() => {
    backend = fakeSecureStore();
    store = createChunkedSecureStorage(backend);
  });

  it('round-trips a value that fits in one chunk', async () => {
    await store.setItem(KEY, 'small');
    expect(await store.getItem(KEY)).toBe('small');
    // Stored plainly, so a reader that knows nothing of chunking still works.
    expect(backend.map.get(KEY)).toBe('small');
  });

  it('round-trips a value far larger than the SecureStore limit', async () => {
    // ~6 KB, the shape of a real session: three times over the ceiling.
    const session = JSON.stringify({
      access_token: 'a'.repeat(2200),
      refresh_token: 'r'.repeat(900),
      user: { id: 'u'.repeat(64), metadata: 'm'.repeat(2800) },
    });
    expect(session.length).toBeGreaterThan(2048);

    await store.setItem(KEY, session);
    expect(await store.getItem(KEY)).toBe(session);
  });

  it('would have failed without chunking', async () => {
    // Proves the fake enforces the limit, so the test above means something.
    const big = 'x'.repeat(3000);
    await expect(backend.setItemAsync(KEY, big)).rejects.toThrow();
  });

  it('reads a legacy un-chunked value written by the old adapter', async () => {
    // Migration path: shipping this must not sign existing users out.
    backend.map.set(KEY, '{"access_token":"legacy"}');
    expect(await store.getItem(KEY)).toBe('{"access_token":"legacy"}');
  });

  it('re-saves a legacy value as chunks on next write', async () => {
    backend.map.set(KEY, 'legacy');
    const big = 'y'.repeat(5000);
    await store.setItem(KEY, big);
    expect(await store.getItem(KEY)).toBe(big);
    expect(backend.map.get(KEY)).toMatch(/^__chunks__:\d+$/);
  });

  it('cleans up leftover parts when a value shrinks', async () => {
    await store.setItem(KEY, 'z'.repeat(6000));
    const wide = [...backend.map.keys()].filter((k) => k.startsWith(`${KEY}.`)).length;
    expect(wide).toBeGreaterThan(1);

    await store.setItem(KEY, 'tiny');
    expect(await store.getItem(KEY)).toBe('tiny');
    // A stale part left behind would be reassembled into the next long value.
    const left = [...backend.map.keys()].filter((k) => k.startsWith(`${KEY}.`));
    expect(left).toEqual([]);
  });

  it('reports absent rather than truncated when a part is missing', async () => {
    await store.setItem(KEY, 'q'.repeat(5000));
    backend.map.delete(`${KEY}.1`);
    // Handing supabase-js half a JSON blob is worse than handing it nothing.
    expect(await store.getItem(KEY)).toBeNull();
  });

  it('removes every part', async () => {
    await store.setItem(KEY, 'w'.repeat(5000));
    await store.removeItem(KEY);
    expect(await store.getItem(KEY)).toBeNull();
    expect([...backend.map.keys()]).toEqual([]);
  });

  it('returns null for a key never written', async () => {
    expect(await store.getItem('nope')).toBeNull();
  });

  it('handles multi-byte characters without splitting them apart', async () => {
    // Display names carry emoji and accents; byte length and string length
    // diverge, and a naive slice could still round-trip only by luck.
    const value = JSON.stringify({ name: 'José 🌲'.repeat(400) });
    await store.setItem(KEY, value);
    expect(await store.getItem(KEY)).toBe(value);
  });
});
