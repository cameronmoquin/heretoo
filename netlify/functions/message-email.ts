/**
 * message-email — "you have a message" mail.
 *
 * Realtime (migration 071) covers someone with the app open. This covers
 * everyone who does not. Polls every two minutes, one email per message,
 * marks only what actually sent.
 *
 * The filtering all lives in pending_message_notifications() (migration
 * 072), so this file decides nothing about who is owed mail — it renders
 * and sends. Not emailed: your own message, anything already read,
 * anything under a minute old, anyone with email off.
 *
 * A message body is NOT reproduced in the email. It says who wrote and
 * links to the thread. Mail is not a private channel, it lands in
 * Gmail's index and on a lock screen, and this app's whole argument is
 * that what people write here is theirs. The sender's name is the most
 * it will say.
 *
 * Graceful no-op if RESEND_API_KEY is unset — logs what it would have
 * sent and marks nothing, so nothing is lost.
 */

import type { Config } from '@netlify/functions';
import {
  renderEmailHtml,
  renderEmailText,
  escapeHtml,
  emailEyebrow,
  emailHeading,
  emailNote,
  emailButton,
} from '../../lib/email-shell';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';
const REPLY_TO = 'cameron@billing-therapy.com';
const MANAGE = { href: 'https://heretoo.social/profile/notifications', label: 'Manage email settings' };

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

type Pending = {
  message_id: string;
  thread_id: string;
  body: string | null;
  created_at: string;
  sender_name: string | null;
  sender_handle: string | null;
  recipient_id: string;
  recipient_email: string | null;
};

function renderEmail(p: Pending): { subject: string; html: string; text: string } {
  const who = escapeHtml(p.sender_name || p.sender_handle || 'Someone');
  const link = `https://heretoo.social/messages/${p.thread_id}`;

  const subject = `${p.sender_name || p.sender_handle || 'Someone'} sent you a message`;

  const bodyHtml =
    emailEyebrow('Messages')
    + emailHeading(`${who} wrote to you.`)
    + emailNote('It is waiting in your messages.')
    + emailButton(link, 'Read it');

  return {
    subject,
    html: renderEmailHtml({ subject, body: bodyHtml, footerAction: MANAGE }),
    text: renderEmailText({
      subject,
      text: `${p.sender_name || p.sender_handle || 'Someone'} wrote to you.\n\n${link}`,
      footerAction: MANAGE,
    }),
  };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[message-email] RESEND_API_KEY not set — would have emailed', to, subject);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text, reply_to: REPLY_TO }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error('[message-email] resend error', res.status, await res.text());
    return false;
  }
  return true;
}

export default async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pending_message_notifications`, {
    method: 'POST',
    headers: HEADERS,
    body: '{}',
  });
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.error('[message-email] pending lookup failed', r.status, await r.text());
    return new Response('lookup failed', { status: 500 });
  }

  const pending = (await r.json()) as Pending[];
  if (pending.length === 0) return new Response('nothing to send');

  // Only ids that actually sent get marked. A Resend failure leaves the
  // row unnotified so the next run retries it, rather than silently
  // eating the only notice someone was going to get.
  const sent: string[] = [];
  for (const p of pending) {
    if (!p.recipient_email) continue;
    const { subject, html, text } = renderEmail(p);
    if (await sendEmail(p.recipient_email, subject, html, text)) sent.push(p.message_id);
  }

  if (sent.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_messages_notified`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ ids: sent }),
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[message-email] ${sent.length}/${pending.length} sent`);
  return new Response(`sent ${sent.length}`);
};

export const config: Config = {
  // Two minutes. The RPC already withholds anything under a minute old,
  // so the practical delay is one to three minutes — fast enough to be
  // useful, slow enough that a live back-and-forth resolves itself in
  // the app and never generates mail at all.
  schedule: '*/2 * * * *',
};
