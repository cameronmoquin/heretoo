/**
 * Post comments — infinite-depth tree. Migration 006 dropped the
 * single-level constraint, so a comment can reply to a reply to a
 * reply, etc. The `useCommentTree()` hook returns nested children for
 * easy rendering; the flat `useComments()` is kept for callers that
 * need a flat list.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  author?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_path: string | null;
  };
}

export function useComments(postId: string | null) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: async (): Promise<Comment[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(id, handle, display_name, avatar_path)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { postId: string; body: string; parentCommentId?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: input.postId,
          author_id: userId,
          body: input.body,
          parent_comment_id: input.parentCommentId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Comment;
    },
    onSuccess: (_c, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.postId] });
      qc.invalidateQueries({ queryKey: ['comments-tree', vars.postId] });
      // Comment count on the post is denormalized; refetch the feed too.
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['family-feed'] });
    },
  });
}

/**
 * Latest top-level comments on a post for the inline preview that
 * appears under the PostCard in the feed. Limit defaults to 2 so the
 * card doesn't get tall. Cheap query because we hit the index on
 * (post_id, created_at).
 */
export function useLatestComments(postId: string | null, limit = 2) {
  return useQuery({
    queryKey: ['comments-latest', postId, limit],
    queryFn: async (): Promise<Comment[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(id, handle, display_name, avatar_path)')
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      // Reverse so the oldest of the latest N reads first → flows naturally.
      return ((data ?? []) as Comment[]).reverse();
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
}

/**
 * Comment with materialized children. `children` is an array of the
 * same shape, sorted by created_at ascending. Top-level returns are
 * the comments whose `parent_comment_id` is null.
 */
export interface CommentNode extends Comment {
  children: CommentNode[];
}

/**
 * Hierarchical comment tree for a post. Builds the tree client-side
 * from a flat list — fine until a single post has thousands of
 * comments, at which point we should server-render via a recursive
 * CTE. For now this keeps things simple.
 */
export function useCommentTree(postId: string | null) {
  return useQuery({
    queryKey: ['comments-tree', postId],
    queryFn: async (): Promise<CommentNode[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(id, handle, display_name, avatar_path)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const flat = (data ?? []) as Comment[];

      // Build map first so insertion order doesn't matter.
      const byId = new Map<string, CommentNode>();
      for (const c of flat) byId.set(c.id, { ...c, children: [] });

      const roots: CommentNode[] = [];
      for (const c of flat) {
        const node = byId.get(c.id)!;
        if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
          byId.get(c.parent_comment_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }
      return roots;
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] });
      qc.invalidateQueries({ queryKey: ['comments-tree'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['family-feed'] });
    },
  });
}

/**
 * Toggle comments_disabled on a post the caller owns. RLS allows the
 * author to update their own posts; non-owners get a permission error.
 */
export function useToggleCommentsDisabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; disabled: boolean }) => {
      const { error } = await supabase
        .from('posts')
        .update({ comments_disabled: input.disabled })
        .eq('id', input.postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['family-feed'] });
    },
  });
}
