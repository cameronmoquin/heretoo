/**
 * Scheduled function — emails each user a digest of family-update
 * posts they haven't seen yet, fired at noon in their LOCAL timezone.
 *
 * How "12pm in each user's timezone" works without per-user crons:
 *   This function fires every hour on the hour (UTC). For each fire,
 *   it computes the current UTC time, then for every active user
 *   asks: "what hour is it in their timezone right now?" If it's
 *   exactly 12, they're due for a digest today.
 *
 *   Idempotency: daily_update_digests has UNIQUE (profile_id,
 *   local_date), so even if the cron drifts +/- a few minutes or
 *   we accidentally fire twice for the same hour, only one row gets
 *   inserted per user per local date.
 *
 *   Users without a timezone fall back to UTC, so they get the
 *   digest at 12:00 UTC.
 *
 * Email sending:
 *   - Resend (https://resend.com), key in RESEND_API_KEY env var
 *   - From: onboarding@resend.dev for now (Resend sandbox default).
 *     To send from a custom domain (e.g. notifications@heretoo.social)
 *     verify the domain in Resend dashboard, then change FROM_EMAIL
 *     below. The sandbox only delivers to the Resend account owner's
 *     email, which is fine for testing but blocks production rollout.
 *
 * Schedule: every hour on the :02 mark (avoids the :00 stampede that
 * every cron user hits). Netlify cron honors UTC.
 */

import type { Config } from '@netlify/functions';
import { Vocab } from '../../constants/vocab';
import {
  renderEmailHtml,
  renderEmailText,
  escapeHtml,
  emailHeading,
  emailNote,
  EmailBrand,
} from '../../lib/email-shell';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// heretoo.social is verified in Resend (DKIM + SPF DNS records live
// in Cloudflare). Mail goes out as HereToo <notifications@heretoo.social>.
// Replies go to cameron@billing-therapy.com — heretoo.social has no
// inbound mail host yet, but billing-therapy.com is already a working
// inbox for the project owner.
const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';
const REPLY_TO = 'cameron@billing-therapy.com';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

// ── helpers ─────────────────────────────────────────────────────────

/** What hour is it right now in the given IANA timezone? Returns 0–23
 *  or null if the timezone string is invalid. */
function localHour(tz: string | null): number | null {
  const zone = tz || 'UTC';
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: false,
    });
    const h = parseInt(f.format(new Date()), 10);
    return Number.isFinite(h) ? h : null;
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" in the given IANA timezone. Stable key for daily dedup. */
function localDate(tz: string | null): string {
  const zone = tz || 'UTC';
  try {
    const f = new Intl.DateTimeFormat('en-CA', {       // sv-CA / en-CA both yield ISO date
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return f.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const MANAGE = { href: 'https://heretoo.social/profile/notifications', label: 'Manage email settings' };

/** Build the branded digest from the unread updates. */
function renderEmail(displayName: string, updates: any[]): { subject: string; html: string; text: string } {
  const greet = displayName ? escapeHtml(displayName.split(' ')[0]) : 'there';
  const subject =
    updates.length === 1
      ? `1 new ${Vocab.group} update on HereToo`
      : `${updates.length} new ${Vocab.group} updates on HereToo`;

  const items = updates
    .map((u) => {
      const crew = escapeHtml(u.family_name ?? `your ${Vocab.group}`);
      const author = escapeHtml(u.author_name ?? u.author_handle ?? 'someone');
      const body = escapeHtml((u.body ?? '').slice(0, 600));
      const link = `https://heretoo.social/feed/${u.post_id}`;
      return `<div style="margin:14px 0;padding:14px 16px;background:${EmailBrand.inset};border:1px solid ${EmailBrand.insetBorder};border-radius:10px;">
        <div style="font-family:${EmailBrand.display};font-size:11px;color:${EmailBrand.ink};text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">${crew}</div>
        <div style="font-size:13px;color:${EmailBrand.muted};margin-top:4px;">From ${author}</div>
        <div style="font-size:15px;color:${EmailBrand.ink};line-height:1.6;margin-top:8px;">${body}</div>
        <a href="${link}" style="display:inline-block;margin-top:10px;font-size:13px;color:${EmailBrand.ink};font-weight:600;text-decoration:none;">Read on heretoo.social</a>
      </div>`;
    })
    .join('\n');

  const bodyHtml =
    emailHeading(`Hey ${greet}`) +
    emailNote(`Unread from your ${Vocab.group}.`) +
    `<div style="margin-top:8px;">${items}</div>`;
  const html = renderEmailHtml({ subject, body: bodyHtml, footerAction: MANAGE });

  const text = renderEmailText({
    subject,
    text: `Hey ${greet}.\n\nUnread from your ${Vocab.group}.\n\n${updates
      .map((u) => `[${u.family_name ?? Vocab.group}] ${u.author_name ?? u.author_handle ?? 'someone'}: ${(u.body ?? '').slice(0, 200)}\nhttps://heretoo.social/feed/${u.post_id}`)
      .join('\n\n')}`,
    footerAction: MANAGE,
  });

  return { subject, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[digest] RESEND_API_KEY not set — would have emailed', to, subject);
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
    console.error('[digest] resend error', res.status, await res.text());
    return false;
  }
  return true;
}

// ── main ────────────────────────────────────────────────────────────

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Fetch every active user with their notification prefs.
  const profilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,handle,display_name,timezone&limit=10000`,
    { headers: HEADERS },
  );
  const profiles = (await profilesRes.json()) as any[];

  // 2. Auth users for email lookup. Resending wants email addresses.
  // We get them via the admin API so notification_email override
  // doesn't matter for now — auth.email is the canonical contact.
  const authUsersRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=10000`,
    { headers: HEADERS },
  );
  const authJson = await authUsersRes.json();
  const emailById = new Map<string, string>();
  for (const u of authJson?.users ?? []) {
    if (u.id && u.email) emailById.set(u.id, u.email);
  }

  // 3. Notification prefs: which users WANT family-activity emails.
  const prefsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/notification_prefs?select=profile_id,email_enabled,email_family_activity,notification_email&limit=10000`,
    { headers: HEADERS },
  );
  const prefs = (await prefsRes.json()) as any[];
  const prefsByProfileId = new Map<string, any>();
  for (const p of prefs) prefsByProfileId.set(p.profile_id, p);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles) {
    const tz = profile.timezone || 'UTC';
    const hour = localHour(tz);
    if (hour !== 12) {
      skipped += 1;
      continue;
    }

    // Check user's prefs — must have email_enabled AND email_family_activity.
    // If no prefs row exists, we treat the defaults from migration 016
    // as opt-in (both default true). Bot accounts won't have prefs and
    // won't have an auth email anyway.
    const userPrefs = prefsByProfileId.get(profile.id);
    if (userPrefs && (userPrefs.email_enabled === false || userPrefs.email_family_activity === false)) {
      skipped += 1;
      continue;
    }

    // Already sent today in their timezone? Skip.
    const today = localDate(tz);
    const dedupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_update_digests?profile_id=eq.${profile.id}&local_date=eq.${today}&select=id`,
      { headers: HEADERS },
    );
    const dedupRows = (await dedupRes.json()) as any[];
    if (dedupRows.length > 0) {
      skipped += 1;
      continue;
    }

    // What's the cutoff for "since last digest"?  Most recent send,
    // or 7 days ago if never. Lets a brand-new user who joined a
    // family yesterday still get the catch-up.
    const lastRes = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_update_digests?profile_id=eq.${profile.id}&order=sent_at.desc&limit=1`,
      { headers: HEADERS },
    );
    const lastRows = (await lastRes.json()) as any[];
    const since = lastRows[0]?.sent_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Pull the unread updates via our RPC.
    const updatesRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unread_family_updates_for`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_profile_id: profile.id, p_since: since }),
    });
    const updates = (await updatesRes.json()) as any[];
    if (!updates || updates.length === 0) {
      // Mark a no-op send so we don't keep checking on the same day.
      await fetch(`${SUPABASE_URL}/rest/v1/daily_update_digests`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({ profile_id: profile.id, post_count: 0, local_date: today }),
      });
      skipped += 1;
      continue;
    }

    // Compose + send.
    const to = userPrefs?.notification_email || emailById.get(profile.id);
    if (!to) {
      // No email on file (probably a bot account); skip.
      skipped += 1;
      continue;
    }
    const { subject, html, text } = renderEmail(profile.display_name || profile.handle || '', updates);
    const ok = await sendEmail(to, subject, html, text);
    if (!ok) {
      failed += 1;
      continue;
    }

    // Record the send for dedup.
    await fetch(`${SUPABASE_URL}/rest/v1/daily_update_digests`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        profile_id: profile.id,
        post_count: updates.length,
        local_date: today,
      }),
    });
    sent += 1;
  }

  return new Response(
    JSON.stringify({ sent, skipped, failed, total_profiles: profiles.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/**
 * Hourly UTC cron at :02 minutes past the hour. The :02 instead of
 * :00 spreads load away from the cron stampede every service hits.
 * Per-user noon detection happens inside the function.
 */
export const config: Config = {
  schedule: '2 * * * *',
};
