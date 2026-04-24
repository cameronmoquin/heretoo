import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { notifyGroupOfNewPost } from '../lib/candon-notifications';

export type PostType = 'general_update' | 'event' | 'assignment' | 'reminder' | 'medical_update';
export type RsvpResponse = 'yes' | 'no' | 'maybe';
export type AssignmentStatus = 'open' | 'claimed' | 'complete';
export type VisibilityScope = 'group' | 'selected_members' | 'admins_only' | 'medical_limited';
export type PostSensitivity = 'normal' | 'private' | 'medical';

export interface FamilyPost {
  id: string;
  family_group_id: string;
  created_by: string;
  post_type: PostType;
  title: string;
  body: string | null;
  sensitivity: PostSensitivity;
  visibility_scope: VisibilityScope;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  event?: FamilyEvent | null;
  assignments?: FamilyAssignment[];
}

export interface FamilyEvent {
  id: string;
  family_post_id: string;
  start_at: string;
  end_at: string | null;
  timezone: string;
  location_name: string | null;
  location_address: string | null;
  rsvp_deadline: string | null;
}

export interface FamilyAssignment {
  id: string;
  family_post_id: string | null;
  family_event_id: string | null;
  assignment_type: 'item' | 'task' | 'ride' | 'food' | 'other';
  label: string;
  quantity_needed: number;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  status: AssignmentStatus;
  notes: string | null;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  response: RsvpResponse;
  plus_count: number;
  note: string | null;
}

// ─── POSTS LIST (for a group) ───
export function useFamilyPosts(groupId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['candon-posts', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('candon_family_posts')
        .select('*')
        .eq('family_group_id', groupId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FamilyPost[];
    },
    enabled: !!groupId,
  });

  // Realtime subscription: refresh on any post change
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`candon_posts:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'candon_family_posts',
          filter: `family_group_id=eq.${groupId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['candon-posts', groupId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, qc]);

  return query;
}

// ─── SINGLE POST (with event + assignments) ───
export function useFamilyPost(postId: string | null) {
  return useQuery({
    queryKey: ['candon-post', postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data: post, error } = await supabase
        .from('candon_family_posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (error) throw error;

      const result: FamilyPost = { ...(post as any) };

      if (post.post_type === 'event') {
        const { data: event } = await supabase
          .from('candon_family_events')
          .select('*')
          .eq('family_post_id', postId)
          .single();
        result.event = (event ?? null) as any;

        if (event) {
          const { data: assignments } = await supabase
            .from('candon_family_assignments')
            .select('*')
            .eq('family_event_id', event.id)
            .order('created_at', { ascending: true });
          result.assignments = (assignments ?? []) as any;
        }
      } else if (post.post_type === 'assignment') {
        const { data: assignments } = await supabase
          .from('candon_family_assignments')
          .select('*')
          .eq('family_post_id', postId)
          .order('created_at', { ascending: true });
        result.assignments = (assignments ?? []) as any;
      }

      return result;
    },
    enabled: !!postId,
  });
}

// ─── CREATE POST ───
interface CreatePostInput {
  family_group_id: string;
  post_type: PostType;
  title: string;
  body?: string;
  // visibility
  visibility_scope?: VisibilityScope;
  sensitivity?: PostSensitivity;
  recipient_user_ids?: string[]; // for selected_members / medical_limited
  // event fields
  start_at?: string;
  end_at?: string;
  timezone?: string;
  location_name?: string;
  location_address?: string;
  rsvp_deadline?: string;
  // assignment slots
  assignments?: { label: string; quantity_needed?: number; assignment_type?: string }[];
  // medical
  medical?: {
    patient_label: string;
    status_level?: 'stable' | 'monitoring' | 'concerning' | 'critical' | 'improving' | 'recovering' | 'passed';
    care_location?: string;
    help_needed?: string;
    contact_person?: string;
    next_update_expected_at?: string;
  };
}

export function useCreateFamilyPost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      if (!userId) throw new Error('Not authenticated');

      // Medical posts default to medical_limited scope if caller didn't set one.
      const scope: VisibilityScope =
        input.visibility_scope ??
        (input.post_type === 'medical_update' ? 'medical_limited' : 'group');
      const sensitivity: PostSensitivity =
        input.sensitivity ??
        (input.post_type === 'medical_update' ? 'medical' : 'normal');

      const { data: post, error } = await supabase
        .from('candon_family_posts')
        .insert({
          family_group_id: input.family_group_id,
          created_by: userId,
          post_type: input.post_type,
          title: input.title,
          body: input.body ?? null,
          sensitivity,
          visibility_scope: scope,
        })
        .select()
        .single();
      if (error) throw error;

      // Recipient list for scoped posts
      if (
        (scope === 'selected_members' || scope === 'medical_limited')
        && input.recipient_user_ids && input.recipient_user_ids.length > 0
      ) {
        const rows = input.recipient_user_ids.map((uid) => ({
          family_post_id: post.id,
          user_id: uid,
        }));
        await supabase.from('candon_family_post_recipients').insert(rows);
      }

      // Medical subtype
      if (input.post_type === 'medical_update' && input.medical) {
        const { error: mErr } = await supabase
          .from('candon_family_medical_updates')
          .insert({
            family_post_id: post.id,
            patient_label: input.medical.patient_label,
            status_level: input.medical.status_level ?? 'stable',
            care_location: input.medical.care_location ?? null,
            help_needed: input.medical.help_needed ?? null,
            contact_person: input.medical.contact_person ?? null,
            next_update_expected_at: input.medical.next_update_expected_at ?? null,
          });
        if (mErr) throw mErr;
      }

      // Event subtype
      let eventId: string | null = null;
      if (input.post_type === 'event' && input.start_at) {
        const { data: event, error: eErr } = await supabase
          .from('candon_family_events')
          .insert({
            family_post_id: post.id,
            start_at: input.start_at,
            end_at: input.end_at ?? null,
            timezone: input.timezone ?? 'America/New_York',
            location_name: input.location_name ?? null,
            location_address: input.location_address ?? null,
            rsvp_deadline: input.rsvp_deadline ?? null,
          })
          .select()
          .single();
        if (eErr) throw eErr;
        eventId = event.id;
      }

      // Assignment slots
      if (input.assignments && input.assignments.length > 0) {
        const rows = input.assignments.map((a) => ({
          family_post_id: input.post_type === 'assignment' ? post.id : null,
          family_event_id: input.post_type === 'event' ? eventId : null,
          label: a.label,
          quantity_needed: a.quantity_needed ?? 1,
          assignment_type: a.assignment_type ?? 'item',
        }));
        const { error: aErr } = await supabase
          .from('candon_family_assignments')
          .insert(rows);
        if (aErr) throw aErr;
      }

      // Fire-and-forget notifications to other members
      notifyGroupOfNewPost({
        family_group_id: post.family_group_id,
        family_post_id: post.id,
        author_id: userId,
        post_type: post.post_type,
        title: post.title,
      });

      return post as FamilyPost;
    },
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ['candon-posts', post.family_group_id] });
    },
  });
}

export function useDeleteFamilyPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candon_family_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-posts'] });
    },
  });
}

// ─── RSVPS ───
export function useEventRsvps(eventId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['candon-rsvps', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('candon_event_rsvps')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      return (data ?? []) as EventRsvp[];
    },
    enabled: !!eventId,
  });

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`candon_rsvps:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candon_event_rsvps', filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ['candon-rsvps', eventId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, qc]);

  return query;
}

export function useSetRsvp() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({ eventId, response, plusCount = 0, note }: {
      eventId: string; response: RsvpResponse; plusCount?: number; note?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('candon_event_rsvps')
        .upsert(
          { event_id: eventId, user_id: userId, response, plus_count: plusCount, note: note ?? null },
          { onConflict: 'event_id,user_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['candon-rsvps', vars.eventId] });
    },
  });
}

// ─── ASSIGNMENTS ───
export function useClaimAssignment() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('candon_family_assignments')
        .update({
          claimed_by_user_id: userId,
          claimed_at: new Date().toISOString(),
          status: 'claimed',
        })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-post'] });
      qc.invalidateQueries({ queryKey: ['candon-posts'] });
    },
  });
}

export function useUnclaimAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('candon_family_assignments')
        .update({
          claimed_by_user_id: null,
          claimed_at: null,
          status: 'open',
        })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-post'] });
      qc.invalidateQueries({ queryKey: ['candon-posts'] });
    },
  });
}
