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

/** Build a simple HTML email body from the unread updates. */
function renderEmail(displayName: string, updates: any[]): { subject: string; html: string; text: string } {
  const greet = displayName ? displayName.split(' ')[0] : 'there';
  const subject =
    updates.length === 1
      ? `1 new family update on HereToo`
      : `${updates.length} new family updates on HereToo`;

  const items = updates
    .map((u) => {
      const family = (u.family_name ?? 'your family').replace(/[<>]/g, '');
      const author = (u.author_name ?? u.author_handle ?? 'someone').replace(/[<>]/g, '');
      const body = (u.body ?? '').replace(/[<>]/g, (c: string) => c === '<' ? '&lt;' : '&gt;').slice(0, 600);
      const link = `https://heretoo.social/feed/${u.post_id}`;
      return `
        <div style="margin: 16px 0; padding: 14px 16px; background: #F6F6F9; border-radius: 12px; border: 1px solid #E4E4EB;">
          <div style="font-size: 11px; color: #8A8A9A; text-transform: uppercase; letter-spacing: 1.4px; font-weight: 700;">${family}</div>
          <div style="font-size: 13px; color: #5A5A6E; margin-top: 4px;">From <strong>${author}</strong></div>
          <div style="font-size: 14px; color: #1A1A24; line-height: 1.5; margin-top: 8px;">${body}</div>
          <a href="${link}" style="display: inline-block; margin-top: 10px; font-size: 13px; color: #4A6CF0; font-weight: 600; text-decoration: none;">Read on HereToo →</a>
        </div>`;
    })
    .join('\n');

  const html = `
    <!doctype html>
    <html><body style="background:#FFFFFF; margin:0; padding:24px; font-family:-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif; color:#1A1A24;">
      <div style="max-width:560px; margin:0 auto;">
        <div style="font-size:22px; font-weight:700; color:#1A1A24; letter-spacing:-0.3px;">
          Hey ${greet},
        </div>
        <div style="font-size:14px; color:#5A5A6E; margin-top:8px; line-height:1.5;">
          ${updates.length === 1 ? "There's an update from your family you haven't read yet." : "There are family updates you haven't read yet."} Here's the digest.
        </div>
        ${items}
        <div style="font-size:12px; color:#8A8A9A; margin-top:24px; line-height:1.5;">
          You're getting this because you're a member of the family above on HereToo.
          <a href="https://heretoo.social/profile/notifications" style="color:#4A6CF0; text-decoration:none;">Manage email settings</a>.
        </div>
      </div>
    </body></html>`;

  const text = `Hey ${greet},

${updates.length === 1 ? "There's an update from your family you haven't read yet." : "There are family updates you haven't read yet."} Here's the digest:

${updates.map((u) => `• [${u.family_name ?? 'family'}] ${u.author_name ?? u.author_handle ?? 'someone'}: ${(u.body ?? '').slice(0, 200)}\n  https://heretoo.social/feed/${u.post_id}`).join('\n\n')}

Manage email settings: https://heretoo.social/profile/notifications`;

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
