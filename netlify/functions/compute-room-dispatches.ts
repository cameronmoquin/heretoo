/**
 * Scheduled function — computes one day of "candles on the mantel"
 * for every active user, then UPSERTs into room_dispatches.
 *
 * Source of Truth, Milestone 4 (Anniversary Engine).
 *
 * Cadence: hourly at :05 UTC. The "today" determination is per-user
 * in their local timezone, so we run hourly to catch the moment when
 * each timezone crosses into a new local day. Idempotent — a UNIQUE
 * (profile_id, for_date, rhythm_id, source_post_id) guards re-inserts.
 *
 * Detection in v1:
 *   - Post anniversaries (mechanical): any post in the user's family
 *     network older than 12 months whose anniversary lands on today
 *     in the user's local timezone.
 *
 * Deferred to follow-ups:
 *   - User-entered rhythms from the rhythms table (schema is in place;
 *     a future PR adds the settings UI to populate it).
 *   - NLP date extraction from post bodies.
 *   - Seasonal rhythms ("first warm day").
 *   - LLM tone polish on the "copy" field. v1 uses templates only.
 *
 * Tone discipline: never "celebrate", never "!", never confetti. The
 * candle is enough. See template helpers below.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

// ── helpers ─────────────────────────────────────────────────────────

/** YYYY-MM-DD in the given IANA timezone, today. */
function localDate(tz: string | null): string {
  const zone = tz || 'UTC';
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
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

/** Month + day extracted from a YYYY-MM-DD date string. */
function monthDay(iso: string): { month: number; day: number } {
  const [, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  return { month: m, day: d };
}

/** Count of full years between two ISO dates (good enough for
 *  "N years ago today" — handles leap days by floor-rounding). */
function yearsBetween(thenIso: string, nowIso: string): number {
  const then = new Date(thenIso);
  const now = new Date(nowIso);
  let years = now.getUTCFullYear() - then.getUTCFullYear();
  // If "now" hasn't reached "then's" month/day yet this year, subtract one
  if (
    now.getUTCMonth() < then.getUTCMonth()
    || (now.getUTCMonth() === then.getUTCMonth() && now.getUTCDate() < then.getUTCDate())
  ) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** Render the dispatch sentence for a post anniversary. Source of
 *  Truth tone: candle on the mantel. No exclamation, no flourish. */
function renderAnniversaryCopy(input: {
  authorName: string;
  postBodyExcerpt: string;
  yearsAgo: number;
}): string {
  const subject = input.postBodyExcerpt.trim().slice(0, 80).replace(/\s+/g, ' ');
  const truncated = input.postBodyExcerpt.trim().length > 80;
  const yearsLabel =
    input.yearsAgo === 1 ? 'One year ago today' : `${input.yearsAgo} years ago today`;
  return `${yearsLabel}, ${input.authorName} wrote: "${subject}${truncated ? '…' : ''}"`;
}

// ── main ────────────────────────────────────────────────────────────

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Pull every active profile + their timezone.
  const profilesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,handle,display_name,timezone&limit=10000`,
    { headers: HEADERS },
  );
  const profiles = (await profilesRes.json()) as Array<{
    id: string;
    handle: string | null;
    display_name: string | null;
    timezone: string | null;
  }>;

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles) {
    const tz = profile.timezone || 'UTC';
    const today = localDate(tz);
    const { month, day } = monthDay(today);

    // 2. For each viewer, find posts in their family network whose
    //    anniversary lands today AND that are at least 12 months old.
    //    The query lifts these via a single PostgREST call: filter
    //    by family membership through a security-definer-equivalent
    //    pattern (we run as service role, so RLS doesn't block us;
    //    we still constrain by membership manually).

    // Get the user's active families
    const fmRes = await fetch(
      `${SUPABASE_URL}/rest/v1/family_members?select=family_id&profile_id=eq.${profile.id}&status=eq.active&limit=200`,
      { headers: HEADERS },
    );
    const fmRows = (await fmRes.json()) as Array<{ family_id: string }>;
    if (!Array.isArray(fmRows) || fmRows.length === 0) {
      skipped += 1;
      continue;
    }
    const familyIds = fmRows.map((r) => r.family_id);

    // Look back 5 years max — older anniversaries are real but the
    // dispatch volume needs a ceiling so we don't flood the hearth.
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() + 1); // strictly older than ~1 year

    // PostgREST month/day filter via SQL function not available, so we
    // pull all candidate posts in the date band and filter in JS. This
    // is bounded: at most ~5 years of family posts per user.
    const familyFilter = `family_id=in.(${familyIds.join(',')})`;
    const dateFilter =
      `created_at=gte.${fiveYearsAgo.toISOString()}&created_at=lte.${oneYearAgo.toISOString()}`;
    const postsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?select=id,family_id,body,created_at,author_id,author:profiles!author_id(handle,display_name)&${familyFilter}&visibility=eq.family&${dateFilter}&order=created_at.desc&limit=2000`,
      { headers: HEADERS },
    );
    const postsCandidates = (await postsRes.json()) as any[];
    if (!Array.isArray(postsCandidates)) {
      failed += 1;
      continue;
    }

    // Filter to posts whose UTC month+day matches today's (in the
    // user's timezone). Approximation — month+day in UTC is usually
    // a fine match for the user's wall-clock date for non-Pacific
    // edge cases. For perfect accuracy we'd extract month+day in
    // the user's tz; v2.
    const matching = postsCandidates.filter((p) => {
      const created = new Date(p.created_at);
      return created.getUTCMonth() + 1 === month && created.getUTCDate() === day;
    });

    // Cap dispatches per user per day at 3 — the hearth is one line
    // wide; more than three candles is noise.
    const top = matching.slice(0, 3);

    for (const p of top) {
      const yearsAgo = yearsBetween(p.created_at, new Date().toISOString());
      if (yearsAgo < 1) continue;

      const author =
        p.author?.display_name?.trim() || p.author?.handle?.trim() || 'someone';
      const copy = renderAnniversaryCopy({
        authorName: author,
        postBodyExcerpt: p.body || '',
        yearsAgo,
      });

      const insertBody = {
        profile_id: profile.id,
        for_date: today,
        rhythm_id: null,
        source_post_id: p.id,
        family_id: p.family_id,
        kind: 'post_anniversary',
        copy,
        digest_only: false,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/room_dispatches`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(insertBody),
      });
      if (res.ok || res.status === 409) {
        inserted += 1;
      } else {
        // eslint-disable-next-line no-console
        console.warn('[dispatches] insert failed', res.status, await res.text());
        failed += 1;
      }
    }
  }

  return new Response(
    JSON.stringify({ inserted, skipped, failed, total_profiles: profiles.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** Hourly at :05 UTC. Each fire updates dispatches for any user whose
 *  local "today" has just rolled over. Idempotency from the UNIQUE
 *  constraint means re-fires within the same local day are no-ops. */
export const config: Config = {
  schedule: '5 * * * *',
};
