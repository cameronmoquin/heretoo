/**
 * POST /api/verify-selfie — the second door into verified_human.
 *
 * A new account without an invite proves a person is present by
 * uploading a selfie whose CAMERA TIMESTAMP sits within 24 hours of
 * the application. This function is the judge, and it is built around
 * one promise: THE IMAGE IS NEVER STORED. The client sends only the
 * head of the file (EXIF lives in the first APP1 segment of a JPEG),
 * the timestamp is read in memory, the verdict is written to
 * verification_attempts — verdict, reason, timestamp, no pixels — and
 * the bytes die with the request.
 *
 * WHAT THIS GATE IS. A speed bump for bots and drive-bys, not a wall
 * against a determined forger — EXIF is editable by anyone who knows
 * it exists. The floor it sets is "someone operated a camera today,"
 * which is exactly the floor asked for. Anyone it wrongly refuses
 * (phones and share paths that strip metadata) still has the other
 * door: an invite from a current user.
 *
 * TIMEZONES. EXIF DateTimeOriginal is local time with no zone unless
 * OffsetTimeOriginal (0x9011) is present. With an offset the window is
 * a clean 24 hours. Without one the timestamp is read as UTC and the
 * window widens by 14 hours — the farthest a real clock can sit from
 * UTC — so no honest photo fails on geography. A forger gains nothing:
 * they could have written any timestamp anyway.
 *
 * AUTH. Bearer token of the signed-in user; the admin client resolves
 * it to a user id. The verified_human stamp itself is service-role —
 * no RLS path lets a client write its own flag.
 *
 * RATE LIMIT. 5 attempts per hour per account, counted from the
 * attempts ledger. A bot hammering timestamps gets an hour-long door.
 */

import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TZ_SLACK_MS = 14 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_HOUR = 5;
/** The client slices the file to 1MB; refuse anything bigger so the
 *  function can never become an accidental photo upload endpoint. */
const MAX_BYTES = 1_200_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_ROLE) return json(500, { error: 'Server not configured' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Who is applying ─────────────────────────────────────────────────
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!bearer) return json(401, { error: 'Not signed in' });
  const { data: userData, error: userErr } = await admin.auth.getUser(bearer);
  const uid = userData?.user?.id;
  if (userErr || !uid) return json(401, { error: 'Not signed in' });

  // Already through either door: idempotent yes.
  const { data: prof } = await admin
    .from('profiles')
    .select('verified_human')
    .eq('id', uid)
    .single();
  if (prof?.verified_human) return json(200, { ok: true, already: true });

  // ── Rate limit ──────────────────────────────────────────────────────
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('verification_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    return json(429, { ok: false, reason: 'rate_limited' });
  }

  // ── The bytes (head of the file only) ───────────────────────────────
  let b64 = '';
  try {
    const body = await req.json();
    b64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
  } catch {
    return json(400, { error: 'Bad request body' });
  }
  if (!b64) return json(400, { error: 'No image' });

  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, 'base64');
  } catch {
    return json(400, { error: 'Bad image encoding' });
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return json(400, { error: 'Image head missing or too large' });
  }

  // ── Judge ───────────────────────────────────────────────────────────
  const verdictOf = (): { verdict: 'pass' | 'fail'; reason: string; taken: Date | null } => {
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) {
      return { verdict: 'fail', reason: 'not_jpeg', taken: null };
    }
    const exif = readExifDate(bytes);
    if (!exif) return { verdict: 'fail', reason: 'no_timestamp', taken: null };
    const window = WINDOW_MS + (exif.offsetKnown ? 0 : TZ_SLACK_MS);
    const delta = Math.abs(Date.now() - exif.taken.getTime());
    if (delta > window) return { verdict: 'fail', reason: 'out_of_window', taken: exif.taken };
    return { verdict: 'pass', reason: exif.offsetKnown ? 'exif_within_24h' : 'exif_within_24h_tz_slack', taken: exif.taken };
  };

  const { verdict, reason, taken } = verdictOf();

  // ── Ledger, then stamp. Never the pixels. ───────────────────────────
  await admin.from('verification_attempts').insert({
    user_id: uid,
    verdict,
    reason,
    exif_taken_at: taken ? taken.toISOString() : null,
  });

  if (verdict === 'pass') {
    const { error: stampErr } = await admin
      .from('profiles')
      .update({ verified_human: true, verified_via: 'selfie', verified_at: new Date().toISOString() })
      .eq('id', uid)
      .eq('verified_human', false);
    if (stampErr) return json(500, { error: 'Could not record verification' });
    return json(200, { ok: true });
  }

  return json(200, { ok: false, reason });
};

/**
 * Pull DateTimeOriginal (and its zone offset, when the camera wrote
 * one) out of a JPEG's EXIF. Hand-rolled TIFF/IFD walk — the segment
 * format is small and stable, and a dependency here would be the only
 * one this function has. Returns null for anything it cannot read;
 * malformed bytes must produce a verdict, never a crash.
 * Exported for the unit test alone.
 */
export function readExifDate(buf: Buffer): { taken: Date; offsetKnown: boolean } | null {
  try {
    // Walk JPEG segments to APP1/"Exif\0\0".
    let p = 2;
    let tiff = -1;
    while (p + 4 <= buf.length) {
      if (buf[p] !== 0xff) break;
      const marker = buf[p + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { p += 2; continue; }
      if (p + 4 > buf.length) break;
      const len = buf.readUInt16BE(p + 2);
      if (len < 2) break;
      if (marker === 0xe1 && p + 4 + 6 <= buf.length
        && buf.toString('ascii', p + 4, p + 10) === 'Exif\0\0') {
        tiff = p + 10;
        break;
      }
      if (marker === 0xda) break; // image data starts; no EXIF ahead
      p += 2 + len;
    }
    if (tiff < 0 || tiff + 8 > buf.length) return null;

    const little = buf.toString('ascii', tiff, tiff + 2) === 'II';
    const u16 = (o: number) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    const u32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    if (u16(tiff + 2) !== 0x002a) return null;

    /** Read one IFD; return the ASCII value of wanted tags + subIFD ptr. */
    const readIfd = (ifdOff: number, wanted: number[]) => {
      const out = new Map<number, string>();
      let exifPtr = 0;
      const abs = tiff + ifdOff;
      if (abs + 2 > buf.length) return { out, exifPtr };
      const n = u16(abs);
      for (let i = 0; i < n; i++) {
        const e = abs + 2 + i * 12;
        if (e + 12 > buf.length) break;
        const tag = u16(e);
        const type = u16(e + 2);
        const cnt = u32(e + 4);
        if (tag === 0x8769) { exifPtr = u32(e + 8); continue; }
        if (!wanted.includes(tag) || type !== 2) continue; // ASCII only
        const valOff = cnt <= 4 ? e + 8 : tiff + u32(e + 8);
        if (valOff + cnt > buf.length) continue;
        out.set(tag, buf.toString('ascii', valOff, valOff + cnt).replace(/\0+$/, '').trim());
      }
      return { out, exifPtr };
    };

    const ifd0 = readIfd(u32(tiff + 4), [0x0132]);
    let dateStr: string | undefined;
    let offsetStr: string | undefined;
    if (ifd0.exifPtr > 0) {
      const sub = readIfd(ifd0.exifPtr, [0x9003, 0x9011]).out;
      dateStr = sub.get(0x9003);
      offsetStr = sub.get(0x9011);
    }
    dateStr = dateStr ?? ifd0.out.get(0x0132);
    if (!dateStr) return null;

    // "YYYY:MM:DD HH:MM:SS"
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(dateStr);
    if (!m) return null;
    const offsetKnown = !!offsetStr && /^[+-]\d{2}:\d{2}$/.test(offsetStr);
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offsetKnown ? offsetStr : 'Z'}`;
    const taken = new Date(iso);
    if (Number.isNaN(taken.getTime())) return null;
    return { taken, offsetKnown };
  } catch {
    return null;
  }
}

export const config: Config = { path: '/api/verify-selfie' };
