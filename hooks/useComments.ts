import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { getCommentsForPost } from '../lib/mock-data';
import { useAuthStore } from '../stores/authStore';

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

export function useComments(postId: string) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      if (DEV_MODE) return getCommentsForPost(postId);

      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Nest replies under parents
      const topLevel: Comment[] = [];
      const replyMap = new Map<string, Comment[]>();

      for (const c of data as Comment[]) {
        if (c.parent_id) {
          const existing = replyMap.get(c.parent_id) ?? [];
          existing.push(c);
          replyMap.set(c.parent_id, existing);
        } else {
          topLevel.push(c);
        }
      }

      return topLevel.map((c) => ({
        ...c,
        replies: replyMap.get(c.id) ?? [],
      }));
    },
    enabled: !!postId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentId,
    }: {
      postId: string;
      content: string;
      parentId?: string;
    }) => {
      if (DEV_MODE) {
        return {
          id: `c-dev-${Date.now()}`,
          post_id: postId,
          author_id: userId,
          parent_id: parentId ?? null,
          content,
          created_at: new Date().toISOString(),
        };
      }

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: userId,
          parent_id: parentId ?? null,
          content,
        })
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url)
        `)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
