/**
 * Family trivia — questions written by family members, played by the
 * other family members. Source of Truth alignment: no leaderboard
 * across families, no streaks, no "X days in a row" mechanics. Per-
 * user "you got N of M right" counter only.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface TriviaQuestion {
  id: string;
  family_id: string;
  author_id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  retired_at: string | null;
  created_at: string;
  author?: { id: string; handle: string | null; display_name: string | null };
}

export interface TriviaQuestionPublic {
  id: string;
  question: string;
  choices: string[];
  author_handle: string | null;
  author_name: string | null;
}

export interface TriviaScore {
  correct_count: number;
  total_count: number;
}

/** All questions in the bank, newest first. Used for the management
 *  view (the family member's own questions + the family's bank). */
export function useFamilyTriviaBank(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ['family-trivia-bank', familyId],
    queryFn: async (): Promise<TriviaQuestion[]> => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from('trivia_questions')
        .select(`
          *,
          author:profiles!author_id(id, handle, display_name)
        `)
        .eq('family_id', familyId)
        .is('retired_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TriviaQuestion[];
    },
    enabled: !!familyId,
  });
}

/** Random question for the viewer to play (excludes their own + ones
 *  they already answered in the last 24h). Returns null if none. */
export function useNextTriviaQuestion(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ['next-trivia-question', familyId],
    queryFn: async (): Promise<TriviaQuestionPublic | null> => {
      if (!familyId) return null;
      const { data, error } = await supabase.rpc('next_trivia_question', {
        p_family_id: familyId,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[trivia] rpc failed', error.message);
        return null;
      }
      const row = ((data ?? []) as any[])[0];
      if (!row) return null;
      // The RPC returns choices as jsonb; supabase-js parses it for us.
      return {
        id: row.id,
        question: row.question,
        choices: row.choices as string[],
        author_handle: row.author_handle ?? null,
        author_name: row.author_name ?? null,
      };
    },
    enabled: !!familyId,
    staleTime: 0,            // always fresh
    refetchOnMount: 'always',
  });
}

/** Personal score for the viewer in a family. */
export function useTriviaScore(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ['trivia-score', familyId],
    queryFn: async (): Promise<TriviaScore> => {
      if (!familyId) return { correct_count: 0, total_count: 0 };
      const { data, error } = await supabase.rpc('trivia_score_for_viewer', {
        p_family_id: familyId,
      });
      if (error) return { correct_count: 0, total_count: 0 };
      const row = ((data ?? []) as any[])[0];
      return {
        correct_count: row?.correct_count ?? 0,
        total_count: row?.total_count ?? 0,
      };
    },
    enabled: !!familyId,
  });
}

/** Add a question to the family's bank. Multiple-choice only in v1. */
export function useAddTriviaQuestion() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      familyId: string;
      question: string;
      choices: [string, string, string, string];
      correctIndex: 0 | 1 | 2 | 3;
      explanation?: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('trivia_questions')
        .insert({
          family_id: input.familyId,
          author_id: userId,
          question: input.question.trim(),
          choices: input.choices,
          correct_index: input.correctIndex,
          explanation: input.explanation?.trim() || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['family-trivia-bank', vars.familyId] });
      qc.invalidateQueries({ queryKey: ['next-trivia-question', vars.familyId] });
    },
  });
}

/** Submit an answer. Returns whether it was correct + the explanation
 *  (we re-fetch the question to keep the correct_index out of the
 *  player's hands until they answer). */
export function useAnswerTrivia() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      questionId: string;
      chosenIndex: 0 | 1 | 2 | 3;
    }): Promise<{
      wasCorrect: boolean;
      correctIndex: number;
      explanation: string | null;
    }> => {
      if (!userId) throw new Error('Not signed in');
      // The server scores it (migration 086). The client used to read
      // the answer key, decide for itself, and write its own verdict
      // into trivia_attempts — so the key was readable before playing
      // and the standings were forgeable by anyone willing to POST.
      // answer_trivia is now the only way an attempt is recorded.
      const { data, error } = await supabase.rpc('answer_trivia', {
        p_question_id: input.questionId,
        p_chosen_index: input.chosenIndex,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as any;
      if (!row) throw new Error('Question not found');
      return {
        wasCorrect: !!row.was_correct,
        correctIndex: row.correct_index as number,
        explanation: (row.explanation as string | null) ?? null,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['next-trivia-question'] });
      qc.invalidateQueries({ queryKey: ['trivia-score'] });
    },
  });
}

/** Cross-family leaderboard — top families by aggregate correct
 *  answers. Each family is one row; individual users are not exposed.
 *  Source of Truth-aligned: the unit of comparison is the family. */
export interface LeaderboardRow {
  family_id: string;
  family_name: string;
  correct_count: number;
  total_count: number;
  contributors: number;
}

export function useTriviaLeaderboard(limit = 25) {
  return useQuery({
    queryKey: ['trivia-leaderboard', limit],
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('trivia_family_leaderboard', {
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        family_id: r.family_id,
        family_name: r.family_name,
        correct_count: Number(r.correct_count ?? 0),
        total_count: Number(r.total_count ?? 0),
        contributors: r.contributors ?? 0,
      }));
    },
    staleTime: 60_000,
  });
}

export interface FamilyRank {
  rank: number;
  total_families: number;
  correct_count: number;
  total_count: number;
}

export function useFamilyTriviaRank(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ['trivia-family-rank', familyId],
    queryFn: async (): Promise<FamilyRank> => {
      if (!familyId) {
        return { rank: 0, total_families: 0, correct_count: 0, total_count: 0 };
      }
      const { data, error } = await supabase.rpc('trivia_family_rank', {
        p_family_id: familyId,
      });
      if (error) {
        return { rank: 0, total_families: 0, correct_count: 0, total_count: 0 };
      }
      const row = ((data ?? []) as any[])[0];
      return {
        rank: row?.rank ?? 0,
        total_families: row?.total_families ?? 0,
        correct_count: Number(row?.correct_count ?? 0),
        total_count: Number(row?.total_count ?? 0),
      };
    },
    enabled: !!familyId,
    staleTime: 60_000,
  });
}

/** Retire one of your own questions. Soft-delete via retired_at. */
export function useRetireTriviaQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from('trivia_questions')
        .update({ retired_at: new Date().toISOString() } as any)
        .eq('id', questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-trivia-bank'] });
      qc.invalidateQueries({ queryKey: ['next-trivia-question'] });
    },
  });
}
