/**
 * invite-send — email an invitation into the app.
 *
 * POST { token, email } with the caller's JWT. The token is a seed
 * invite the caller created; only its sponsor can mail it, so nobody
 * can aim someone else's invitation. The email says who invites and
 * carries the one door: /sow/<token>.
 *
 * Graceful when RESEND_API_KEY is unset: answers 503 and the client
 * falls back to the device's own mail composer. Nothing is lost —
 * the token already exists and the link works from anywhere.
 */

import type { Context } from '@netlify/functions';
import {
  renderEmailHtml,
  renderEmailText,
  escapeHtml,
  emailEyebrow,
  emailHeading,
  emailButton,
} from '../../lib/email-shell';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';

export default async (req: Request, _ctx: Context) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const auth = req.headers.get('authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return new Response('unauthorized', { status: 401 });

  let token = '';
  let email = '';
  try {
    const body = await req.json();
    token = String(body?.token ?? '');
    email = String(body?.email ?? '').trim();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('bad request', { status: 400 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'email not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!who.ok) return new Response('unauthorized', { status: 401 });
  const callerId = (await who.json())?.id;
  if (!callerId) return new Response('unauthorized', { status: 401 });

  // The token must be the caller's own invitation.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_seed_invite`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token_in: token }),
  });
  if (!r.ok) return new Response('lookup failed', { status: 500 });
  const rows = (await r.json()) as any[];
  const invite = Array.isArray(rows) ? rows[0] : rows;
  if (!invite || invite.sponsor_id !== callerId) {
    return new Response('forbidden', { status: 403 });
  }

  const name = invite.sponsor_display_name || invite.sponsor_handle || 'Someone';
  const link = `https://heretoo.social/sow/${token}`;
  const subject = `${name} invites you.`;

  const bodyHtml =
    emailEyebrow('Invitation')
    + emailHeading(`${escapeHtml(name)} invites you.`)
    + emailButton(link, 'Come in');

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: renderEmailHtml({ subject, body: bodyHtml }),
      text: renderEmailText({ subject, text: `${name} invites you.\n\n${link}` }),
    }),
  });
  if (!send.ok) {
    // eslint-disable-next-line no-console
    console.error('[invite-send] resend error', send.status, await send.text());
    return new Response('send failed', { status: 502 });
  }

  return new Response('sent');
};
