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

const MANAGE = { href: 'https://heretoo.social/profile/notifications', label: 'Manage email settings' };

/** One instant email about one post on one followed Subject. */
function renderEmail(
  displayName: string,
  p: Pending,
): { subject: string; html: string; text: string } {
  const greet = displayName ? escapeHtml(displayName.split(' ')[0]) : 'there';
  const subjectName = escapeHtml(p.subject_name || 'a story');
  const crew = escapeHtml(p.family_name || 'your crew');
  const author = escapeHtml(p.author_name || p.author_handle || 'Someone');
  const body = escapeHtml((p.body ?? '').slice(0, 600));
  // /subjects/{id} has never existed. The route is
  // /family/{id}/subject/{slug}, and the payload already carries both —
  // this link 404'd in every Subject email ever sent.
  const link = `https://heretoo.social/family/${p.family_id}/subject/${p.subject_slug}`;
  const postLink = `https://heretoo.social/feed/${p.post_id}`;

  const subject = `${p.author_name || p.author_handle || 'Someone'} posted to "${p.subject_name}"`;

  const bodyHtml =
    emailEyebrow(`${crew} &middot; Following`) +
    emailHeading(`New on “${subjectName}”`) +
    emailNote(`Hey ${greet}. ${author} added to a story you follow.`) +
    `<div style="margin:16px 0;padding:16px 18px;background:${EmailBrand.inset};border:1px solid ${EmailBrand.insetBorder};border-radius:10px;">
       <div style="font-size:15px;color:${EmailBrand.cream};line-height:1.6;">${body || `<span style="color:${EmailBrand.muted};">A new photo or moment.</span>`}</div>
       <a href="${postLink}" style="display:inline-block;margin-top:12px;font-size:13px;color:${EmailBrand.gold};font-weight:600;text-decoration:none;">Read on heretoo.social</a>
     </div>` +
    emailNote(`See the whole story on ${emailLink(link, 'heretoo.social')}.`);
  const html = renderEmailHtml({ subject, body: bodyHtml, footerAction: MANAGE });

  const text = renderEmailText({
    subject,
    text: `${p.author_name || p.author_handle || 'Someone'} added to "${p.subject_name}" in ${p.family_name || 'your crew'}.\n\n${(p.body ?? '').slice(0, 300) || '(A new photo or moment.)'}\n\nRead it: ${postLink}\nWhole story: ${link}`,
    footerAction: MANAGE,
  });

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
