/**
 * request-password-reset — HereToo's own forgot-password endpoint.
 *
 * Replaces supabase.auth.resetPasswordForEmail. We control the whole
 * flow now: generate the recovery token with the admin API, build the
 * link ourselves straight at /reset-password, and send it through Resend
 * in the branded shell. Supabase's Site-URL redirect is bypassed.
 *
 * Two rules govern this function:
 *
 *   1. It never reveals whether an account exists. Every path returns
 *      the same generic 200. A stranger typing your email learns
 *      nothing.
 *
 *   2. It fails soft. A missing key or an upstream error still returns
 *      the generic 200 to the caller; the real reason goes to
 *      console.warn only.
 *
 * It holds the service role key, so it does exactly one thing: mint a
 * recovery link and email it. No other database access.
 */

import type { Config } from '@netlify/functions';
import {
  renderEmailHtml,
  renderEmailText,
  emailEyebrow,
  emailHeading,
  emailParagraph,
  emailButton,
  emailNote,
} from '../../lib/email-shell';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';
const REPLY_TO = 'cameron@billing-therapy.com';

/** One body, returned no matter what happened, so the response never
 *  distinguishes a real account from a miss. */
function generic(): Response {
  return new Response(
    JSON.stringify({ ok: true, message: 'If that email has an account, a reset link is on its way.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function buildEmail(link: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your HereToo password';
  const body =
    emailEyebrow('Password reset') +
    emailHeading('Reset your password') +
    `<div style="margin-top:18px;">` +
    emailParagraph('Set a new password from the button below. This link works once and expires in one hour.') +
    emailButton(link, 'Set a new password') +
    emailNote('If you did not request a reset, ignore this email. Your password stays as it is.') +
    `</div>`;
  const text =
    `Reset your HereToo password.\n\n` +
    `Open this link to set a new password. It works once and expires in one hour.\n\n` +
    `${link}\n\n` +
    `If you did not request a reset, ignore this email.`;
  return {
    subject,
    html: renderEmailHtml({ subject, body }),
    text: renderEmailText({ subject, text }),
  };
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Parse the email. A bad body is indistinguishable from a miss.
  let email = '';
  try {
    const parsed = (await req.json()) as { email?: unknown };
    email = String(parsed?.email ?? '').trim().toLowerCase();
  } catch {
    return generic();
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return generic();
  }

  // Missing config: fail soft, warn, stay generic.
  if (!SUPABASE_URL || !SERVICE_ROLE || !RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[reset] missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY) — returning generic 200');
    return generic();
  }

  try {
    // 1. Mint a recovery token via the admin API. We want the
    //    hashed_token only; the link we build ourselves.
    const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'recovery', email }),
    });
    if (!genRes.ok) {
      // Unknown email lands here. Stay generic, warn with status only.
      // eslint-disable-next-line no-console
      console.warn('[reset] generate_link non-ok', genRes.status);
      return generic();
    }
    const gen = (await genRes.json()) as any;
    // GoTrue has moved this field between top-level and .properties
    // across versions; accept either.
    const hashedToken: string | undefined = gen?.hashed_token ?? gen?.properties?.hashed_token;
    if (!hashedToken) {
      // eslint-disable-next-line no-console
      console.warn('[reset] generate_link returned no hashed_token');
      return generic();
    }

    // 2. Build the link straight at our page. The reset-password screen
    //    consumes ?token_hash=...&type=recovery via verifyOtp.
    const link = `https://heretoo.social/reset-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

    // 3. Send it, branded, through Resend.
    const { subject, html, text } = buildEmail(link);
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, html, text, reply_to: REPLY_TO }),
    });
    if (!sendRes.ok) {
      // eslint-disable-next-line no-console
      console.warn('[reset] resend non-ok', sendRes.status);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[reset] unexpected error', (err as Error)?.message);
  }

  return generic();
};

export const config: Config = { path: '/api/request-password-reset' };
