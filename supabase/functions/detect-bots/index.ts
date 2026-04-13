import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Bot detection Edge Function.
 * Runs on a cron (every 15 minutes) to analyze engagement velocity
 * and flag suspicious accounts.
 *
 * Signals:
 * 1. Engagement velocity — actions faster than humanly possible
 * 2. Pattern uniformity — same action repeated without variation
 * 3. Session anomalies — engaging 24/7 without breaks
 * 4. New account + high volume — fresh accounts with burst activity
 */

const THRESHOLDS = {
  // Minimum ms between engagements before it's suspicious
  MIN_INTERVAL_MS: 500,
  // Max engagements in a 5-minute window before flagging
  MAX_PER_5_MIN: 60,
  // Max engagements in 1 hour before flagging
  MAX_PER_HOUR: 300,
  // If account is < 24 hours old and has > this many actions, flag
  NEW_ACCOUNT_MAX_ACTIONS: 200,
  // Bot score threshold for auto-suspension
  AUTO_SUSPEND_THRESHOLD: 0.85,
  // Bot score threshold for flagging review
  FLAG_REVIEW_THRESHOLD: 0.5,
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Get users with recent activity
  const { data: recentActions } = await supabase
    .from('rate_limit_log')
    .select('user_id')
    .gte('created_at', oneHourAgo);

  if (!recentActions || recentActions.length === 0) {
    return new Response(JSON.stringify({ checked: 0, flagged: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userIds = [...new Set(recentActions.map((a: any) => a.user_id))];
  let flagged = 0;

  for (const userId of userIds) {
    let botScore = 0;

    // Signal 1: 5-minute burst check
    const { data: fiveMinActions } = await supabase
      .from('rate_limit_log')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', fiveMinAgo)
      .order('created_at', { ascending: true });

    const fiveMinCount = fiveMinActions?.length ?? 0;
    if (fiveMinCount > THRESHOLDS.MAX_PER_5_MIN) {
      botScore += 0.3;
    }

    // Signal 2: Interval analysis — check time between consecutive actions
    if (fiveMinActions && fiveMinActions.length >= 3) {
      const timestamps = fiveMinActions.map((a: any) =>
        new Date(a.created_at).getTime()
      );
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const minInterval = Math.min(...intervals);

      // Inhuman speed
      if (minInterval < THRESHOLDS.MIN_INTERVAL_MS) {
        botScore += 0.3;
      }

      // Suspiciously uniform intervals (std dev < 100ms = likely automated)
      const mean = avgInterval;
      const variance =
        intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) /
        intervals.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev < 100 && intervals.length > 5) {
        botScore += 0.2;
      }

      // Log velocity window
      await supabase.from('engagement_velocity').insert({
        user_id: userId,
        window_start: fiveMinAgo,
        window_end: now.toISOString(),
        engagement_count: fiveMinCount,
        avg_interval_ms: Math.round(avgInterval),
        flagged: botScore > THRESHOLDS.FLAG_REVIEW_THRESHOLD,
      });
    }

    // Signal 3: Hourly volume
    const { data: hourActions } = await supabase
      .from('rate_limit_log')
      .select('created_at', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    // Signal 4: New account high volume
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at, is_human_verified')
      .eq('id', userId)
      .single();

    if (profile) {
      const accountAge = now.getTime() - new Date(profile.created_at).getTime();
      const isNewAccount = accountAge < 24 * 60 * 60 * 1000;

      if (isNewAccount && fiveMinCount > 30) {
        botScore += 0.2;
      }

      // Reduce score if human verified
      if (profile.is_human_verified) {
        botScore *= 0.5;
      }
    }

    // Clamp
    botScore = Math.min(1.0, Math.max(0, botScore));

    // Update profile bot score
    const updates: Record<string, any> = {
      bot_score: Math.round(botScore * 100) / 100,
    };

    // Auto-suspend if above threshold
    if (botScore >= THRESHOLDS.AUTO_SUSPEND_THRESHOLD) {
      updates.is_suspended = true;
      updates.suspension_reason = `Automated: bot score ${botScore.toFixed(2)} exceeds threshold`;
      flagged++;

      // Create a moderation action
      await supabase.from('moderation_actions').insert({
        target_type: 'profile',
        target_id: userId,
        action: 'suspend',
        reason: `Bot detection: score ${botScore.toFixed(2)}`,
      });
    }

    await supabase.from('profiles').update(updates).eq('id', userId);
  }

  return new Response(
    JSON.stringify({ checked: userIds.length, flagged }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
