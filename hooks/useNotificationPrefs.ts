/**
 * Notification preferences — what we send the user about, and where.
 *
 * The notification_prefs row is auto-created by the handle_new_user
 * trigger when a profile is set up, so every signed-in user has one.
 * This hook reads + updates that row.
 *
 * Sending the actual emails / SMS is a separate concern (Resend +
 * Twilio integrations, deferred). The toggles here just persist the
 * user's preferences so when sending is wired up the routing is
 * already correct.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface NotificationPrefs {
  profile_id: string;
  notification_email: string | null;
  notification_phone: string | null;
  email_verified_at: string | null;

  // Master switches
  email_enabled: boolean;
  sms_enabled: boolean;

  // Per-event email toggles
  email_connection_request: boolean;
  email_connection_accepted: boolean;
  email_new_message: boolean;
  email_family_activity: boolean;
  email_post_reaction: boolean;
  email_marketing: boolean;

  // Per-event SMS toggles
  sms_connection_request: boolean;
  sms_new_message: boolean;
  sms_family_activity: boolean;

  email_unsub_token: string;
  updated_at: string;
}

export function useNotificationPrefs() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['notification-prefs', userId],
    queryFn: async (): Promise<NotificationPrefs | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as NotificationPrefs | null;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('notification_prefs')
        .update(patch)
        .eq('profile_id', userId);
      if (error) throw error;
    },
    // Optimistic — flip the toggle in the cache immediately so the UI
    // doesn't visibly hiccup waiting on the network.
    onMutate: async (patch) => {
      if (!userId) return;
      const key = ['notification-prefs', userId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<NotificationPrefs | null>(key);
      if (prev) qc.setQueryData(key, { ...prev, ...patch });
      return { undo: () => qc.setQueryData(key, prev) };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.undo) try { context.undo(); } catch {}
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs', userId] });
    },
  });
}
