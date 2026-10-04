/**
 * contact — the Contact Us endpoint (POST /api/contact).
 *
 * Stores the message in nffga_contact_messages (migration 110) with the
 * service role — clients have no insert path — then emails every site
 * admin a "check your account" notice through Resend. The email never
 * carries the message itself: admins read it on /admin → Messages.
 *
 * Rules, as in request-password-reset.ts:
 *   - It fails soft and never crashes. Real reasons go to console.warn;
 *     the caller gets a short, plain response.
 *   - A filled honeypot field is dropped silently with the normal
 *     success response, so a bot learns nothing.
 *   - At most 3 messages per hashed IP per hour (counted from the table).
 *     The raw IP is never stored, only a salted SHA-256 of it.
 *   - No RESEND_API_KEY: the message is still stored, and a warning is
 *     logged. Admins will see it the next time they open the dashboard.
 *
 * Holds the service role key, so it does exactly this and nothing else.
 */

import type { Config } from '@netlify/functions';
import { createHash } from 'node:crypto';
import {
  renderEmailHtml,
  renderEmailText,
  emailEyebrow,
  emailHeading,
  emailParagraph,
  emailButton,
  emailNote,
} from '../../lib/email-shell';
import { SITE_URL, SITE_NAME, EMAIL_FROM, EMAIL_NOREPLY } from '../../constants/site';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const IP_SALT = process.env.CONTACT_IP_SALT || 'nffga-contact-v1';

const MAX_PER_HOUR = 3;
const LIMITS = { name: 120, email: 254, subject: 200, body: 5000 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const sent = () => json(200, { ok: true, message: 'Thanks. Your message was sent.' });

function warn(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.warn('[contact]', ...args);
}

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-nf-client-connection-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0].trim() ||
    h.get('client-ip') ||
    'unknown'
  );
}

function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex');
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_ROLE as string,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** The signed-in sender's user id, if they sent a valid access token. */
async function senderId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE as string, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string };
    return typeof u?.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

async function recentCount(ipHash: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/nffga_contact_messages?select=id&ip_hash=eq.${ipHash}` +
    `&created_at=gte.${encodeURIComponent(since)}&limit=${MAX_PER_HOUR + 1}`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) {
    warn('rate count non-ok', res.status);
    return 0; // fail open on the counter; the insert itself still has to work
  }
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function adminEmails(): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/nffga_site_admin_emails`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: '{}',
  });
  if (!res.ok) {
    warn('admin emails non-ok', res.status);
    return [];
  }
  const rows = (await res.json()) as { email?: string }[];
  return Array.from(new Set((rows ?? []).map((r) => String(r?.email ?? '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))));
}

function buildEmail(): { subject: string; html: string; text: string } {
  const subject = `New message on ${SITE_NAME}`;
  const link = `${SITE_URL}/admin`;
  const body =
    emailEyebrow('Contact us') +
    emailHeading('You have a new message') +
    `<div style="margin-top:18px;">` +
    emailParagraph(`A new message arrived through the Contact Us page on the ${SITE_NAME} website. Sign in to your account to read it.`) +
    emailButton(link, 'Open the admin dashboard') +
    emailNote('You are receiving this because you are a site admin. The message itself is only shown on the site.') +
    `</div>`;
  const text =
    `You have a new message on ${SITE_NAME}.\n\n` +
    `A new message arrived through the Contact Us page. Sign in to your account to read it:\n\n` +
    `${link}\n\n` +
    `You are receiving this because you are a site admin.`;
  return { subject, html: renderEmailHtml({ subject, body }), text: renderEmailText({ subject, text }) };
}

async function notifyAdmins(): Promise<void> {
  if (!RESEND_API_KEY) {
    warn('RESEND_API_KEY missing — message stored, no notification sent');
    return;
  }
  const to = await adminEmails();
  if (to.length === 0) {
    warn('no site admin emails to notify');
    return;
  }
  const { subject, html, text } = buildEmail();
  // One email per admin, so no admin's address is shown to another.
  await Promise.all(to.map(async (addr) => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: EMAIL_FROM, to: addr, subject, html, text, reply_to: EMAIL_NOREPLY }),
      });
      if (!res.ok) warn('resend non-ok', res.status);
    } catch (e) {
      warn('resend error', (e as Error)?.message);
    }
  }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '').replace(/\r\n/g, '\n').trim();

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let input: Record<string, unknown> = {};
  try {
    input = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'Fill in your name, email and message.' });
  }

  // Honeypot: people never see this field. Drop silently.
  if (str(input.website) || str(input.company_url)) {
    warn('honeypot hit — dropped');
    return sent();
  }

  const name = str(input.name);
  const email = str(input.email).toLowerCase();
  const subject = str(input.subject);
  const body = str(input.message ?? input.body);

  if (!name || !email || !body) return json(400, { ok: false, error: 'Fill in your name, email and message.' });
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email) return json(400, { ok: false, error: 'Enter a valid email address.' });
  if (name.length > LIMITS.name) return json(400, { ok: false, error: `Keep your name under ${LIMITS.name} characters.` });
  if (subject.length > LIMITS.subject) return json(400, { ok: false, error: `Keep the subject under ${LIMITS.subject} characters.` });
  if (body.length > LIMITS.body) return json(400, { ok: false, error: `Keep the message under ${LIMITS.body} characters.` });

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    warn('missing env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — message not stored');
    return json(503, { ok: false, error: 'Messages cannot be sent right now. Try again later.' });
  }

  try {
    const ipHash = hashIp(clientIp(req));
    if ((await recentCount(ipHash)) >= MAX_PER_HOUR) {
      warn('rate limited');
      return json(429, { ok: false, error: 'Too many messages from here in the last hour. Try again later.' });
    }

    const userId = await senderId(req);
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/nffga_contact_messages`, {
      method: 'POST',
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ name, email, subject: subject || null, body, ip_hash: ipHash, user_id: userId }),
    });
    if (!ins.ok) {
      warn('insert non-ok', ins.status, (await ins.text().catch(() => '')).slice(0, 300));
      return json(503, { ok: false, error: 'Your message could not be sent right now. Try again later.' });
    }

    // Stored: from here on the sender has succeeded, whatever the mail does.
    await notifyAdmins().catch((e) => warn('notify error', (e as Error)?.message));
  } catch (err) {
    warn('unexpected error', (err as Error)?.message);
    return json(503, { ok: false, error: 'Your message could not be sent right now. Try again later.' });
  }

  return sent();
};

export const config: Config = { path: '/api/contact' };
