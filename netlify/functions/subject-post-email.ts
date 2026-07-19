/**
 * Scheduled function — the "something is happening" email.
 *
 * When a post lands on a Subject someone follows (with notify_on_post),
 * this emails that follower right away — not the once-a-day digest, but
 * the instant signal for the origin use case: "Tim's surgery just got an
 * update." The in-app half of this (the "New" dot on Subjects) already
 * ships; this reaches the family member who isn't looking at the app.
 *
 * It stays disciplined about the calm: it only fires for Subjects the
 * user chose to follow, it honors a per-user pref
 * (notification_prefs.email_subject_activity), it never emails the author
 * their own post, and the subject_post_notifications ledger guarantees
 * exactly one email per post per person — even across the several
 * Subjects a post might be tagged into, and even if this worker re-runs.
 *
 * All the filtering lives in the pending_subject_post_notifications() RPC
 * (migration 055); this function is just fan-out + send + record.
 *
 * Email sending mirrors daily-update-digest.ts: Resend, from the verified
 * heretoo.social domain, graceful no-op if RESEND_API_KEY is unset.
 *
 * Schedule: every 5 minutes. The RPC's 2-hour lookback plus the dedup
 * ledger make the exact cadence forgiving — a missed run just gets picked
 * up by the next, and nothing double-sends.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// heretoo.social is verified in Resend (DKIM + SPF in Cloudflare), same
// as the daily digest. Replies route to a working project inbox.
const FROM_EMAIL = 'HereToo <notifications@heretoo.social>';
const REPLY_TO = 'cameron@billing-therapy.com';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

type Pending = {
  post_id: string;
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  family_id: string;
  family_name: string | null;
  author_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  body: string | null;
  post_created_at: string;
  follower_id: string;
  notification_email: string | null;
};

// ── helpers ─────────────────────────────────────────────────────────

/** Minimal HTML entity escaping for values we drop into the template. */
function esc(input: string): string {
  return input.replace(/[<>&]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;',
  );
}

/** One instant email about one post on one followed Subject. */
function renderEmail(
  displayName: string,
  p: Pending,
): { subject: string; html: string; text: string } {
  const greet = displayName ? esc(displayName.split(' ')[0]) : 'there';
  const subjectName = esc(p.subject_name || 'a family story');
  const family = esc(p.family_name || 'your family');
  const author = esc(p.author_name || p.author_handle || 'Someone');
  const body = esc((p.body ?? '').slice(0, 600));
  const link = `https://heretoo.social/subjects/${p.subject_id}`;
  const postLink = `https://heretoo.social/feed/${p.post_id}`;

  const subject = `New on "${p.subject_name}" — ${author} posted`;

  const html = `
    <!doctype html>
    <html><body style="background:#FFFFFF; margin:0; padding:24px; font-family:-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif; color:#1A1A24;">
      <div style="max-width:560px; margin:0 auto;">
        <div style="font-size:11px; color:#8A8A9A; text-transform:uppercase; letter-spacing:1.4px; font-weight:700;">${family} · following</div>
        <div style="font-size:22px; font-weight:700; color:#1A1A24; letter-spacing:-0.3px; margin-top:6px;">
          Something new on “${subjectName}”
        </div>
        <div style="font-size:14px; color:#5A5A6E; margin-top:8px; line-height:1.5;">
          Hey ${greet}, <strong>${author}</strong> just added to a story you're following.
        </div>
        <div style="margin:18px 0; padding:16px 18px; background:#F6F6F9; border-radius:12px; border:1px solid #E4E4EB;">
          <div style="font-size:15px; color:#1A1A24; line-height:1.6;">${body || '<em style="color:#8A8A9A;">A new photo or moment was shared.</em>'}</div>
          <a href="${postLink}" style="display:inline-block; margin-top:12px; font-size:13px; color:#4A6CF0; font-weight:600; text-decoration:none;">Read on HereToo →</a>
        </div>
        <a href="${link}" style="display:inline-block; font-size:13px; color:#5A5A6E; text-decoration:none;">See the whole story of “${subjectName}” →</a>
        <div style="font-size:12px; color:#8A8A9A; margin-top:24px; line-height:1.5;">
          You're getting this because you follow “${subjectName}.”
          <a href="https://heretoo.social/subjects/${p.subject_id}" style="color:#4A6CF0; text-decoration:none;">Unfollow</a>
          or <a href="https://heretoo.social/profile/notifications" style="color:#4A6CF0; text-decoration:none;">manage email settings</a>.
        </div>
      </div>
    </body></html>`;

  const text = `Hey ${greet},

${p.author_name || p.author_handle || 'Someone'} just added to "${p.subject_name}", a story you're following in ${p.family_name || 'your family'}.

${(p.body ?? '').slice(0, 300) || '(A new photo or moment was shared.)'}

Read it: ${postLink}
See the whole story: ${link}

You're getting this because you follow "${p.subject_name}".
Manage email settings: https://heretoo.social/profile/notifications`;

  return { subject, html, text };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[subject-post] RESEND_API_KEY not set — would have emailed', to, subject);
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
    console.error('[subject-post] resend error', res.status, await res.text());
    return false;
  }
  return true;
}

// ── main ────────────────────────────────────────────────────────────

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Who's due for an instant email? The RPC has already applied follow
  //    state, per-user pref, authorship, and the dedup ledger.
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/pending_subject_post_notifications`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_lookback: '2 hours', p_limit: 500 }),
    },
  );
  if (!pendingRes.ok) {
    // eslint-disable-next-line no-console
    console.error('[subject-post] rpc error', pendingRes.status, await pendingRes.text());
    return new Response('RPC failed', { status: 500 });
  }
  const pending = (await pendingRes.json()) as Pending[];
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped: 0, failed: 0, pending: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Resolve follower emails. notification_email (the per-user override)
  //    wins; otherwise the canonical auth.users email. One admin-API call
  //    covers everyone, same as the digest.
  const authUsersRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=10000`,
    { headers: HEADERS },
  );
  const authJson = await authUsersRes.json();
  const emailById = new Map<string, string>();
  for (const u of authJson?.users ?? []) {
    if (u.id && u.email) emailById.set(u.id, u.email);
  }

  // 3. Follower display names for the greeting.
  const followerIds = [...new Set(pending.map((p) => p.follower_id))];
  const nameById = new Map<string, string>();
  if (followerIds.length > 0) {
    const inList = followerIds.map((id) => `"${id}"`).join(',');
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,display_name,handle&id=in.(${inList})`,
      { headers: HEADERS },
    );
    const profs = (await profRes.json()) as any[];
    for (const pr of profs ?? []) {
      nameById.set(pr.id, pr.display_name || pr.handle || '');
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of pending) {
    const to = p.notification_email || emailById.get(p.follower_id);
    if (!to) {
      // No deliverable email (likely a bot/system account). Record it as
      // handled so we don't reconsider it every run.
      await recordNotified(p);
      skipped += 1;
      continue;
    }

    const { subject, html, text } = renderEmail(nameById.get(p.follower_id) || '', p);
    const ok = await sendEmail(to, subject, html, text);
    if (!ok) {
      // Leave it unrecorded so the next run retries (within the lookback).
      failed += 1;
      continue;
    }

    await recordNotified(p);
    sent += 1;
  }

  return new Response(
    JSON.stringify({ sent, skipped, failed, pending: pending.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** Write the dedup row so this (post, follower) never re-sends. Upsert on
 *  the (post_id, profile_id) primary key so a race between two runs is a
 *  no-op rather than a 409. */
async function recordNotified(p: Pending): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/subject_post_notifications`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      post_id: p.post_id,
      profile_id: p.follower_id,
      subject_id: p.subject_id,
    }),
  });
}

/**
 * Every 5 minutes. The RPC's 2-hour lookback + the dedup ledger make the
 * cadence forgiving: a skipped or failed run is caught by the next one,
 * and nothing double-sends.
 */
export const config: Config = {
  schedule: '*/5 * * * *',
};
