/**
 * Speech-to-text proxy — transcribe browser-recorded audio via
 * ElevenLabs Scribe.
 *
 * The mic button on inputs records via MediaRecorder, POSTs the
 * resulting webm/ogg blob here, and gets back { text }. We then
 * insert that into the target input. Big accessibility win for
 * older users who'd rather speak than thumb-type.
 *
 * Same shape as tts.ts — server-side because the API key authorizes
 * billing and must never reach the browser bundle.
 *
 * Cost: Scribe is ~$0.10/minute. A typical voice note (5-30 sec) is
 * less than a cent.
 */

import type { Config } from '@netlify/functions';

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY!;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap — about 10 minutes of audio
const MODEL = 'scribe_v1';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!ELEVEN_KEY) {
    return new Response(JSON.stringify({ error: 'STT not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Browser sends raw audio bytes as the request body (not multipart).
  // Pass through to ElevenLabs as a multipart file upload.
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'No audio provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (buf.byteLength > MAX_BYTES) {
    return new Response(
      JSON.stringify({ error: 'Audio exceeds 10MB limit' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ElevenLabs expects multipart/form-data with `file` + `model_id`.
  // Build that on the server side. The MIME type is whatever the
  // browser captured (audio/webm on Chromium, audio/mp4 on Safari).
  const inputContentType = req.headers.get('content-type') || 'audio/webm';
  const blob = new Blob([buf], { type: inputContentType });
  const fd = new FormData();
  fd.append('file', blob, 'audio.webm');
  fd.append('model_id', MODEL);

  const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN_KEY },
    body: fd,
  });

  if (!elevenRes.ok) {
    const errText = await elevenRes.text();
    // eslint-disable-next-line no-console
    console.error('[stt] elevenlabs error', elevenRes.status, errText);
    return new Response(
      JSON.stringify({ error: 'Transcription service error', detail: errText.slice(0, 300) }),
      { status: elevenRes.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const json = await elevenRes.json();
  // ElevenLabs returns { text, words, language, ... }. We only need
  // `text` for the input box. Forward the others in case the client
  // ever wants them (e.g., word-level timing for highlighted playback).
  return new Response(
    JSON.stringify({
      text: json?.text ?? '',
      language: json?.language_code ?? null,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
};

export const config: Config = { path: '/api/stt' };
