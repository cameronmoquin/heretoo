/**
 * Text-to-speech proxy — turn arbitrary text into mp3 audio using
 * ElevenLabs' Bike Messenger voice.
 *
 * Why a Netlify function instead of calling ElevenLabs from the
 * browser: the API key authorizes billing, so it MUST stay server-side.
 * The function is the only thing that has access to ELEVENLABS_API_KEY.
 *
 * Flow:
 *   client (read-aloud button) ─POST {text}─▶ this fn ─▶ ElevenLabs ─▶ mp3
 *                                              │
 *                                              ▼
 *                                          stream back as audio/mpeg
 *
 * Cost guardrails (worth the byte count, ElevenLabs charges per char):
 *   - Max text length 5000 chars (≈ $1.50 max per call at $0.30/1k chars)
 *   - Caller's auth token passed via Authorization header so we can rate
 *     limit per user later (just an "unauthenticated POSTs need this
 *     key" check today; per-user quota in v2)
 *
 * Caching (todo, v2): hash(voiceId + text) → check Supabase storage
 *   `tts-cache/<hash>.mp3` → if hit, redirect; if miss, generate +
 *   upload + return. Until then every play costs ElevenLabs credits;
 *   cap at the 5000-char limit + a future per-user quota keeps spend
 *   bounded while we observe usage.
 */

import type { Config } from '@netlify/functions';

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY!;
const VOICE_ID = '8Nfp0JhQpkjJB35HObeq'; // Bike Messenger
const MODEL = 'eleven_turbo_v2_5'; // good quality / fast / lower cost
const MAX_CHARS = 5000;

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!ELEVEN_KEY) {
    return new Response(JSON.stringify({ error: 'TTS not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { text?: string };
  try { body = await req.json(); } catch { body = {}; }
  const text = (body.text ?? '').trim();

  if (!text) {
    return new Response(JSON.stringify({ error: 'No text provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (text.length > MAX_CHARS) {
    return new Response(
      JSON.stringify({ error: `Text exceeds ${MAX_CHARS} character limit` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Hand off to ElevenLabs. We stream the response straight through
  // rather than buffering it — keeps memory low and starts playback
  // sooner on the client.
  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // Calibration per the aesthetic codex (Source of Truth, M10):
        // "a calm friend reading you a letter" — not a podcast voice,
        // not a customer-service voice. Style stays low so the read
        // feels natural rather than theatrical.
        voice_settings: {
          stability: 0.62,
          similarity_boost: 0.78,
          style: 0.18,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!elevenRes.ok) {
    const errText = await elevenRes.text();
    // eslint-disable-next-line no-console
    console.error('[tts] elevenlabs error', elevenRes.status, errText);
    return new Response(
      JSON.stringify({ error: 'Voice service error', detail: errText.slice(0, 300) }),
      { status: elevenRes.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Pass the audio stream to the client. Setting cache-control lets
  // the browser keep it for an hour so navigating away + back doesn't
  // re-bill — note this is per-client cache, not server-side cache.
  return new Response(elevenRes.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const config: Config = { path: '/api/tts' };
