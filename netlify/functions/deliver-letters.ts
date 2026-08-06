/**
 * Scheduled function — delivers Letters whose deliver_at has passed.
 *
 * Source of Truth, Milestone 5. Runs every five minutes; finds letters
 * with deliver_at <= now() and delivered_at is null, marks them
 * delivered, and (for resolved recipients) sends a single quiet
 * notification email to the recipient.
 *
 * Future-recipient letters (those with no resolved user_id on any
 * letter_recipients row) get delivered_at stamped but no email — the
 * author hands the claim URL to the recipient by hand.
 *
 * Tone discipline: ONE email per delivered letter. No follow-up
 * reminders, no "you have a letter waiting" reminders if unread.
 * The platform plants the candle once.
 */

import type { Config } from '@netlify/functions';
import {
  renderEmailHtml,
  renderEmailText,
  escapeHtml,
  emailEyebrow,
  emailHeading,
  emailNote,
  emailLink,
  EmailBrand,
} from '../../lib/email-shell';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';
const REPLY_TO = 'cameron@billing-therapy.com';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

/** Render the letter body itself in the email. The recipient may
 *  never visit the platform — especially for posthumous letters
 *  where the author has passed and the family is no longer engaged.
 *  The email IS the delivery; the platform link is the keepsake. */
async function sendArrivalEmail(
  to: string,
  authorName: string,
  letterId: string,
  body: string,
  writtenAt: string,
  careOfLabel: string | null = null,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[letter] RESEND_API_KEY not set — would have emailed', to);
    return false;
  }
  const link = `https://heretoo.social/letter/${letterId}`;
  const subject = careOfLabel
    ? `A letter from ${authorName}, care of ${careOfLabel}`
    : `A letter from ${authorName}`;

  // Format the body for HTML — preserve paragraph breaks, escape
  // the rest. The body_md may contain markdown asterisks for italics
  // but we render plain prose; people who use the Letter feature
  // are writing letters, not formatting documents.
  const paragraphHtml = escapeHtml(body ?? '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 18px 0;font-size:17px;line-height:1.7;color:${EmailBrand.ink};">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const writtenLine = (() => {
    try {
      return new Date(writtenAt).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return writtenAt; }
  })();

  const careOfHtml = careOfLabel
    ? `<div style="margin:16px 0;padding:12px 14px;background:rgba(201,161,75,0.10);border-left:2px solid ${EmailBrand.ink};font-size:13px;line-height:1.6;color:${EmailBrand.ink};">Addressed to <strong>${escapeHtml(careOfLabel)}</strong>. You are the trusted adult on file.</div>`
    : '';
  const bodyHtml =
    emailEyebrow('A letter has arrived') +
    emailHeading(`From ${escapeHtml(authorName)}`) +
    careOfHtml +
    emailNote(`Written ${writtenLine}`) +
    `<div style="margin-top:18px;">${paragraphHtml}</div>` +
    emailNote(`Read this letter on ${emailLink(link, 'heretoo.social')}, where it stays as a keepsake.`);
  const html = renderEmailHtml({ subject, body: bodyHtml });

  const careOfText = careOfLabel
    ? `\nAddressed to ${careOfLabel}. You are the trusted adult on file.\n`
    : '';
  const text = renderEmailText({
    subject,
    text: `A letter has arrived. From ${authorName}.${careOfText}\n\nWritten ${writtenLine}\n\n${body}\n\nRead it on heretoo.social: ${link}`,
  });

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
    console.error('[letter] resend error', res.status, await res.text());
    return false;
  }
  return true;
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Find letters due for delivery.
  const dueRes = await fetch(
    `${SUPABASE_URL}/rest/v1/letters?select=id,author_id,body_md,body_plain,created_at,deliver_at,author:profiles!author_id(handle,display_name)&deliver_at=lte.${new Date().toISOString()}&delivered_at=is.null&limit=200`,
    { headers: HEADERS },
  );
  const due = (await dueRes.json()) as any[];
  if (!Array.isArray(due) || due.length === 0) {
    return new Response(JSON.stringify({ delivered: 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  let delivered = 0;
  let emailed = 0;
  let failed = 0;

  for (const letter of due) {
    // Resolve recipients on this letter.
    const recipRes = await fetch(
      `${SUPABASE_URL}/rest/v1/letter_recipients?select=id,user_id,future_recipient_label,care_of_email&letter_id=eq.${letter.id}`,
      { headers: HEADERS },
    );
    const recipients = (await recipRes.json()) as Array<{
      id: string;
      user_id: string | null;
      future_recipient_label: string | null;
      care_of_email: string | null;
    }>;

    // Mark the letter delivered first — RLS makes future reads possible
    // for resolved recipients.
    const markRes = await fetch(
      `${SUPABASE_URL}/rest/v1/letters?id=eq.${letter.id}`,
      {
        method: 'PATCH',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({ delivered_at: new Date().toISOString() }),
      },
    );
    if (!markRes.ok) {
      failed += 1;
      continue;
    }
    delivered += 1;

    // Email each resolved recipient. Future-only recipients get no
    // email — the author hands the claim URL by other means.
    const authorName =
      letter.author?.display_name?.trim() || letter.author?.handle?.trim() || 'a friend';

    for (const r of recipients) {
      let to: string | null = null;
      let careOfLabel: string | null = null;

      if (r.user_id) {
        // Resolved recipient — look up their auth.users email.
        const userRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users/${r.user_id}`,
          { headers: HEADERS },
        );
        const u: any = await userRes.json();
        to = u?.email ?? null;
      } else if (r.care_of_email) {
        // Future recipient with a parent / guardian email on file —
        // letter to "my future grandchild" gets sent c/o the parent.
        to = r.care_of_email;
        careOfLabel = r.future_recipient_label ?? 'the recipient';
      }

      if (!to) continue;

      const body = (letter.body_plain || letter.body_md || '').toString();
      const ok = await sendArrivalEmail(
        to, authorName, letter.id, body, letter.created_at, careOfLabel,
      );
      if (ok) emailed += 1;
    }
  }

  return new Response(
    JSON.stringify({ delivered, emailed, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** Every five minutes. Letter delivery is rare and not time-critical
 *  to the second; five minutes is the right blink-rate for a letter. */
export const config: Config = {
  schedule: '*/5 * * * *',
};
