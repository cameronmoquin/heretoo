/**
 * /api/memoir-transcribe — speech to text for the memoir interview.
 *
 * The client records audio in the browser (MediaRecorder) and POSTs
 * the raw audio bytes as the request body, with the Content-Type set
 * to the recorded mime (audio/webm, audio/mp4, etc). We forward it to
 * a Whisper-compatible transcription API and return { text }.
 *
 * Provider is configurable so you can point at OpenAI Whisper, Groq
 * (whisper-large-v3, cheap + fast), or any OpenAI-compatible endpoint:
 *   TRANSCRIBE_API_URL   default https://api.openai.com/v1/audio/transcriptions
 *   TRANSCRIBE_API_KEY   (required to enable the feature)
 *   TRANSCRIBE_MODEL     default whisper-1
 *
 * Privacy: audio is forwarded once and not persisted by this endpoint.
 * Fail-soft: with no key we return 503 and the UI keeps the keyboard.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.TRANSCRIBE_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
const API_KEY = process.env.TRANSCRIBE_API_KEY;
const MODEL = process.env.TRANSCRIBE_MODEL || 'whisper-1';

const MAX_BYTES = 25 * 1024 * 1024; // Whisper's 25MB limit.

function extForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!API_KEY) {
    return json({ error: 'Voice transcription is not set up yet.' }, 503);
  }

  // Require a signed-in caller (cheap check; keeps the endpoint from
  // being an open transcription proxy).
  const auth = req.headers.get('authorization');
  if (!auth || !SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'Not signed in' }, 401);
  }
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (!u.ok) return json({ error: 'Not signed in' }, 401);
  } catch {
    return json({ error: 'Not signed in' }, 401);
  }

  const mime = req.headers.get('content-type') || 'audio/webm';
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return json({ error: 'No audio received' }, 400);
  if (buf.byteLength > MAX_BYTES) {
    return json({ error: 'Recording too long. Try a shorter take.' }, 413);
  }

  // Build the multipart form Whisper expects.
  const form = new FormData();
  const blob = new Blob([buf], { type: mime });
  form.append('file', blob, `memoir.${extForMime(mime)}`);
  form.append('model', MODEL);
  // A gentle hint nudges Whisper toward sentence-cased prose.
  form.append('prompt', 'A person telling a story from their life, in full sentences.');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text();
      // eslint-disable-next-line no-console
      console.error('[memoir-transcribe] provider', res.status, t.slice(0, 200));
      return json({ error: 'Transcription service error' }, 502);
    }
    const data = (await res.json()) as any;
    const text = (data?.text ?? '').trim();
    return json({ text }, 200);
  } catch (e: any) {
    return json({ error: `Transcription failed: ${e?.message ?? ''}`.slice(0, 200) }, 502);
  }
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = { path: '/api/memoir-transcribe' };
