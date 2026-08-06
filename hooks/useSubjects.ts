/**
 * Subjects — long-running family-story threads.
 *
 * Source of Truth, Milestone 3. Schema in supabase/migrations/028_subjects.sql.
 *
 * A Subject is family-scoped. Posts can carry zero or more Subjects.
 * Following a Subject pins it to the user's hearth dispatch and the
 * daily digest (the digest enrichment is queued for a follow-up; the
 * follower table is in place now so the data exists when the function
 * is updated).
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSubjectsSeenStore } from '../stores/subjectsSeenStore';
import { subjectHasNewActivity } from '../lib/subjects-activity';

export interface Subject {
  id: string;
  family_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_post_id: string | null;
  created_by: string | null;
  created_at: string;
  retired_at: string | null;
  is_shared: boolean;
}

export interface SubjectWithCount extends Subject {
  post_count: number;
  is_following?: boolean;
}

/** All subjects in a family, plus per-subject post count and the
 *  viewer's follow status. Open subjects first (recency-ordered), then
 *  retired. */
export function useFamilySubjects(familyId: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['family-subjects', familyId, userId],
    queryFn: async (): Promise<SubjectWithCount[]> => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('family_id', familyId)
        .order('retired_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      const subjects = (data ?? []) as Subject[];
      if (subjects.length === 0) return [];

      // Enrich: post counts + follow status.
      const ids = subjects.map((s) => s.id);
      const [counts, follows] = await Promise.all([
        supabase
          .from('post_subjects')
          .select('subject_id')
          .in('subject_id', ids),
        userId
          ? supabase
              .from('subject_followers')
              .select('subject_id')
              .eq('profile_id', userId)
              .in('subject_id', ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const countBy: Record<string, number> = {};
      for (const row of (counts.data ?? []) as Array<{ subject_id: string }>) {
        countBy[row.subject_id] = (countBy[row.subject_id] ?? 0) + 1;
      }
      const followingSet = new Set(
        ((follows.data ?? []) as Array<{ subject_id: string }>).map((f) => f.subject_id),
      );

      return subjects.map((s) => ({
        ...s,
        post_count: countBy[s.id] ?? 0,
        is_following: followingSet.has(s.id),
      }));
    },
    enabled: !!familyId,
  });
}

/** Single subject by family + slug, with its full post list (oldest
 *  first — reading top-to-bottom is reading the story). */
export function useSubjectBySlug(familyId: string | null | undefined, slug: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['subject', familyId, slug, userId],
    queryFn: async () => {
      if (!familyId || !slug) return null;
      const { data: subjectData, error: sErr } = await supabase
        .from('subjects')
        .select('*')
        .eq('family_id', familyId)
        .eq('slug', slug)
        .maybeSingle();
      if (sErr) throw sErr;
      if (!subjectData) return null;
      const subject = subjectData as Subject;

      const { data: postRows, error: pErr } = await supabase
        .from('post_subjects')
        .select(
          `post_id,
           added_at,
           post:posts!post_id(
             *,
             author:profiles!author_id(id, handle, display_name, avatar_path),
             media:post_media(*)
           )`,
        )
        .eq('subject_id', subject.id)
        .order('added_at', { ascending: true });
      if (pErr) throw pErr;

      const posts = (postRows ?? [])
        .map((r: any) => r.post)
        .filter(Boolean);

      // Follow status
      let isFollowing = false;
      if (userId) {
        const { data: f } = await supabase
          .from('subject_followers')
          .select('subject_id')
          .eq('profile_id', userId)
          .eq('subject_id', subject.id)
          .maybeSingle();
        isFollowing = !!f;
      }

      return { subject, posts, isFollowing };
    },
    enabled: !!familyId && !!slug,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      familyId: string;
      name: string;
      description?: string;
    }): Promise<Subject> => {
      if (!userId) throw new Error('Not signed in');
      // Compute slug client-side using the same rule as the Postgres
      // helper. Collision-safe via UNIQUE (family_id, slug) — caller
      // gets a friendly error and can retry with a tweaked name.
      const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      const slug = baseSlug || `subject-${Date.now().toString(36)}`;

      const { data, error } = await supabase
        .from('subjects')
        .insert({
          family_id: input.familyId,
          name: input.name.trim(),
          slug,
          description: input.description?.trim() || null,
          created_by: userId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Subject;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['family-subjects', s.family_id] });
    },
  });
}

export function useTagPostWithSubject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { postId: string; subjectId: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('post_subjects')
        .insert({
          post_id: input.postId,
          subject_id: input.subjectId,
          added_by: userId,
        } as any);
      // Treat duplicate-key as a no-op success (the post is already
      // tagged; the user clicked again).
      if (error && !/duplicate key/i.test(error.message)) throw error;
    },
    onSuccess: (_d, { subjectId }) => {
      qc.invalidateQueries({ queryKey: ['subject'] });
      qc.invalidateQueries({ queryKey: ['family-subjects'] });
    },
  });
}

export function useUntagPostFromSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; subjectId: string }) => {
      const { error } = await supabase
        .from('post_subjects')
        .delete()
        .eq('post_id', input.postId)
        .eq('subject_id', input.subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subject'] });
      qc.invalidateQueries({ queryKey: ['family-subjects'] });
    },
  });
}

export function useFollowSubject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('subject_followers')
        .insert({ subject_id: subjectId, profile_id: userId } as any);
      if (error && !/duplicate key/i.test(error.message)) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-subjects'] });
      qc.invalidateQueries({ queryKey: ['subject'] });
    },
  });
}

export function useUnfollowSubject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('subject_followers')
        .delete()
        .eq('subject_id', subjectId)
        .eq('profile_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-subjects'] });
      qc.invalidateQueries({ queryKey: ['subject'] });
    },
  });
}

export function useRetireSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { subjectId: string; closingNote?: string }) => {
      const updates: Record<string, any> = { retired_at: new Date().toISOString() };
      if (input.closingNote?.trim()) {
        updates.description = input.closingNote.trim();
      }
      const { error } = await supabase
        .from('subjects')
        .update(updates)
        .eq('id', input.subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-subjects'] });
      qc.invalidateQueries({ queryKey: ['subject'] });
    },
  });
}

// ── "Something's happening" — new activity in followed subjects ──────

/** Per-subject latest-activity for the subjects the viewer FOLLOWS in
 *  this family. `byMe` flags activity the viewer themselves added (so
 *  we never badge someone for their own post). Refetches in realtime
 *  when a new post lands in the family. */
export function useFollowedSubjectActivity(familyId: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['subject-activity', familyId, userId],
    queryFn: async (): Promise<Record<string, { latestAt: string; byMe: boolean }>> => {
      if (!familyId || !userId) return {};
      // Subjects in THIS family that the viewer follows.
      const { data: follows, error: fErr } = await supabase
        .from('subject_followers')
        .select('subject_id, subject:subjects!subject_id(family_id)')
        .eq('profile_id', userId);
      if (fErr) throw fErr;
      const ids = ((follows ?? []) as any[])
        .filter((r) => r.subject?.family_id === familyId)
        .map((r) => r.subject_id as string);
      if (ids.length === 0) return {};

      // Latest tag per subject (newest first → first seen wins).
      const { data: tags, error: tErr } = await supabase
        .from('post_subjects')
        .select('subject_id, added_at, added_by')
        .in('subject_id', ids)
        .order('added_at', { ascending: false });
      if (tErr) throw tErr;

      const map: Record<string, { latestAt: string; byMe: boolean }> = {};
      for (const row of (tags ?? []) as any[]) {
        if (!map[row.subject_id]) {
          map[row.subject_id] = {
            latestAt: row.added_at,
            byMe: row.added_by === userId,
          };
        }
      }
      return map;
    },
    enabled: !!familyId && !!userId,
  });

  // Realtime: a new post in this family is the "something happened"
  // signal. We invalidate and let the query re-read post_subjects. (A
  // post is tagged to its subject immediately after insert; the brief
  // race is covered by React Query's refetch-on-focus.)
  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      // Unique per mount — a fixed name returns the previous, already
      // subscribed channel and .on() then throws. See useChat.ts.
      .channel(`subject-activity:${familyId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `family_id=eq.${familyId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['subject-activity', familyId] });
          qc.invalidateQueries({ queryKey: ['family-subjects', familyId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId, qc]);

  return query;
}

/** Derived "new activity" state for the Subjects tab + rows. A subject
 *  is "new" when its latest activity (by someone other than the viewer)
 *  is more recent than the last time the viewer opened it. */
export function useSubjectsNewActivity(familyId: string | null | undefined) {
  const { data: activity } = useFollowedSubjectActivity(familyId);
  const seen = useSubjectsSeenStore((s) => s.seen);
  const map = activity ?? {};

  const isNew = (subjectId: string): boolean =>
    subjectHasNewActivity(map[subjectId], seen[subjectId]);
  const anyNew = Object.keys(map).some((id) => isNew(id));
  const latestFor = (subjectId: string): string | undefined => map[subjectId]?.latestAt;

  return { isNew, anyNew, latestFor };
}

/** Subjects attached to a single post — used by the composer to show
 *  existing tags and offer to add or remove. */
export function usePostSubjects(postId: string | null | undefined) {
  return useQuery({
    queryKey: ['post-subjects', postId],
    queryFn: async (): Promise<Subject[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('post_subjects')
        .select('subject:subjects!subject_id(*)')
        .eq('post_id', postId);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.subject)
        .filter(Boolean) as Subject[];
    },
    enabled: !!postId,
  });
}
