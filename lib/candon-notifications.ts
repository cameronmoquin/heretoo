/**
 * Candon notification scaffolding.
 *
 * Queues notification jobs in the database. A separate Supabase Edge
 * Function (not yet deployed) reads the queue and sends via Resend.
 *
 * To activate:
 *   1. Get a Resend API key (https://resend.com/api-keys)
 *   2. Verify a sending domain or subdomain
 *   3. Deploy the process-candon-notifications Edge Function
 *      (set RESEND_API_KEY in Supabase project secrets)
 *   4. Schedule it via pg_cron every 5 minutes
 *
 * Until then this hook just writes to the queue with status='queued'
 * and nothing ever leaves the database. No-op is safe.
 */

import { supabase } from './supabase';

export type NotificationTemplate =
  | 'new_post'
  | 'new_event'
  | 'new_assignment'
  | 'rsvp_reminder'
  | 'assignment_reminder'
  | 'weekly_digest';

export interface QueueNotificationInput {
  user_id?: string;
  family_group_id?: string;
  family_post_id?: string;
  channel: 'email' | 'push' | 'digest';
  template_key: NotificationTemplate;
  payload?: Record<string, any>;
  scheduled_for?: string; // ISO timestamp, defaults to now
}

/**
 * Queue a notification. Returns quickly — doesn't send anything.
 * The Edge Function worker will pick it up later.
 */
export async function queueNotification(input: QueueNotificationInput): Promise<void> {
  try {
    await supabase.from('candon_notification_jobs').insert({
      user_id: input.user_id ?? null,
      family_group_id: input.family_group_id ?? null,
      family_post_id: input.family_post_id ?? null,
      channel: input.channel,
      template_key: input.template_key,
      payload: input.payload ?? {},
      scheduled_for: input.scheduled_for ?? new Date().toISOString(),
      status: 'queued',
    });
  } catch {
    // Non-blocking: notifications should never break the user flow.
  }
}

/**
 * Queue notifications for every member of a family group when a new post is published.
 * Excludes the post author (don't notify yourself).
 */
export async function notifyGroupOfNewPost(params: {
  family_group_id: string;
  family_post_id: string;
  author_id: string;
  post_type: string;
  title: string;
}): Promise<void> {
  try {
    const { data: members } = await supabase
      .from('candon_family_memberships')
      .select('user_id')
      .eq('family_group_id', params.family_group_id);

    if (!members) return;
    const recipients = members.filter((m) => m.user_id !== params.author_id);

    // Queue one notification per recipient
    const jobs = recipients.map((m) => ({
      user_id: m.user_id,
      family_group_id: params.family_group_id,
      family_post_id: params.family_post_id,
      channel: 'email' as const,
      template_key:
        params.post_type === 'event' ? 'new_event'
        : params.post_type === 'assignment' ? 'new_assignment'
        : 'new_post' as NotificationTemplate,
      payload: { title: params.title, post_type: params.post_type },
      scheduled_for: new Date().toISOString(),
      status: 'queued',
    }));

    if (jobs.length > 0) {
      await supabase.from('candon_notification_jobs').insert(jobs);
    }
  } catch {
    // Silent
  }
}
