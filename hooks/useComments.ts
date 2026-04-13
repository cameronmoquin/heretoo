import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
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

const MOCK_COMMENTS: Record<string, Comment[]> = {
  'post-001': [
    {
      id: 'c1', post_id: 'post-001', author_id: 'user-004', parent_id: null,
      content: 'This is exactly what my street needs. How did you organize it?',
      created_at: '2026-04-13T09:00:00Z',
      author: { username: 'priya_s', display_name: 'Priya Shah', avatar_url: null },
    },
    {
      id: 'c2', post_id: 'post-001', author_id: 'user-002', parent_id: 'c1',
      content: 'Just knocked on doors. Most people said yes before I finished asking.',
      created_at: '2026-04-13T09:30:00Z',
      author: { username: 'elena_r', display_name: 'Elena Rodriguez', avatar_url: null },
    },
    {
      id: 'c3', post_id: 'post-001', author_id: 'user-006', parent_id: null,
      content: 'We did the same thing. Best thing we ever did for our block.',
      created_at: '2026-04-13T10:00:00Z',
      author: { username: 'sarah_k', display_name: 'Sarah Kim', avatar_url: null },
    },
  ],
  'post-002': [
    {
      id: 'c4', post_id: 'post-002', author_id: 'user-005', parent_id: null,
      content: 'This one hit home. My dad was a mechanic. I write software. Same drive.',
      created_at: '2026-04-13T07:00:00Z',
      author: { username: 'marcus_t', display_name: 'Marcus Thompson', avatar_url: null },
    },
  ],
};

export function useComments(postId: string) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async () => {
      if (DEV_MODE) return MOCK_COMMENTS[postId] ?? [];

      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if (!data || data.length === 0) return MOCK_COMMENTS[postId] ?? [];

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
