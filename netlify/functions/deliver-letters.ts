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
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[letter] RESEND_API_KEY not set — would have emailed', to);
    return false;
  }
  const link = `https://heretoo.social/letter/${letterId}`;
  const subject = `A letter from ${authorName}`;

  // Format the body for HTML — preserve paragraph breaks, escape
  // the rest. The body_md may contain markdown asterisks for italics
  // but we render plain prose; people who use the Letter feature
  // are writing letters, not formatting documents.
  const escapedBody = (body ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphHtml = escapedBody
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 18px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const writtenLine = (() => {
    try {
      return new Date(writtenAt).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return writtenAt; }
  })();

  const html = `
    <!doctype html>
    <html><body style="background:#0A0A0F;margin:0;padding:32px 16px;font-family:'Source Serif 4',Georgia,serif;color:#F4F1E8;">
      <div style="max-width:580px;margin:0 auto;background:#16161D;border:1px solid rgba(201,161,75,0.55);border-radius:12px;padding:32px 28px;">
        <div style="font-size:11px;font-weight:700;color:#C9A14B;text-transform:uppercase;letter-spacing:2px;font-family:'Syne','Inter',sans-serif;">
          A letter has arrived
        </div>
        <div style="font-size:28px;font-weight:800;color:#F4F1E8;letter-spacing:-0.6px;margin-top:8px;font-family:'Syne','Inter',sans-serif;line-height:1.15;">
          From ${authorName}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin:14px 0 22px;">
          <span style="display:inline-block;width:48px;height:1px;background:#C9A14B;opacity:0.55;"></span>
          <span style="color:#C9A14B;font-size:11px;">✦</span>
          <span style="display:inline-block;width:48px;height:1px;background:#C9A14B;opacity:0.55;"></span>
        </div>
        <div style="font-size:11px;color:#8A8377;text-transform:uppercase;letter-spacing:1.6px;font-family:'Syne','Inter',sans-serif;">
          Written ${writtenLine}
        </div>
        <div style="margin-top:22px;font-size:17px;line-height:1.7;color:#F4F1E8;">
          ${paragraphHtml}
        </div>
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(201,161,75,0.25);font-size:12px;line-height:1.6;color:#8A8377;">
          You can also <a href="${link}" style="color:#C9A14B;text-decoration:none;">read this letter on heretoo.social</a>, where it stays as a keepsake.
        </div>
      </div>
    </body></html>`;
  const text = `A letter has arrived — from ${authorName}.\n\nWritten ${writtenLine}\n\n${body}\n\n---\nRead it on heretoo.social: ${link}`;

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
      `${SUPABASE_URL}/rest/v1/letter_recipients?select=id,user_id,future_recipient_label&letter_id=eq.${letter.id}`,
      { headers: HEADERS },
    );
    const recipients = (await recipRes.json()) as Array<{
      id: string; user_id: string | null; future_recipient_label: string | null;
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
      if (!r.user_id) continue;
      // Look up the recipient's auth.users email via admin API.
      const userRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${r.user_id}`,
        { headers: HEADERS },
      );
      const u: any = await userRes.json();
      const to = u?.email;
      if (!to) continue;
      const body = (letter.body_plain || letter.body_md || '').toString();
      const ok = await sendArrivalEmail(
        to, authorName, letter.id, body, letter.created_at,
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
