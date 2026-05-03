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
  heart_count?: number;
  viewer_hearted?: boolean;
  created_at: string;
  author?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_path: string | null;
  };
}

export function useComments(postId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['comments', postId, userId],
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
        .select('*, author:profiles!author_id(id, handle, display_name, avatar_path)')
        .single();
      if (error) throw error;
      return data as Comment;
    },
    // Optimistic: drop a placeholder into the tree + flat list and the
    // latest-comments preview the moment the user taps Send.
    onMutate: async (vars) => {
      const id = `optimistic-${Date.now()}`;
      const tempComment: Comment = {
        id,
        post_id: vars.postId,
        author_id: userId ?? 'me',
        parent_comment_id: vars.parentCommentId ?? null,
        body: vars.body,
        created_at: new Date().toISOString(),
        author: undefined,
      };

      // Cache keys must EXACTLY match the keys the consumers read
      // from. useCommentTree's key is now 3-tuple [tree, postId, userId]
      // after the viewer-hearted enrichment was added; if we write to
      // the 2-tuple here the placeholder lands in a different cache
      // slot and never appears on screen — which is the bug Cameron
      // reported as "comments don't post immediately."
      const flatKey = ['comments', vars.postId, userId];
      const treeKey = ['comments-tree', vars.postId, userId];
      const latestKey = ['comments-latest', vars.postId, 2];

      await qc.cancelQueries({ queryKey: flatKey });
      await qc.cancelQueries({ queryKey: treeKey });
      await qc.cancelQueries({ queryKey: latestKey });

      const prev = {
        flat: qc.getQueryData<Comment[]>(flatKey),
        tree: qc.getQueryData<any[]>(treeKey),
        latest: qc.getQueryData<Comment[]>(latestKey),
      };

      qc.setQueryData<Comment[]>(flatKey, (old) => [...(old ?? []), tempComment]);
      qc.setQueryData<any[]>(treeKey, (old) => {
        const node: any = { ...tempComment, viewer_hearted: false, heart_count: 0, children: [] };
        if (!vars.parentCommentId) return [...(old ?? []), node];
        const insertReply = (nodes: any[]): any[] =>
          nodes.map((n) =>
            n.id === vars.parentCommentId
              ? { ...n, children: [...n.children, node] }
              : { ...n, children: insertReply(n.children) },
          );
        return insertReply(old ?? []);
      });
      // Latest preview only shows top-level comments
      if (!vars.parentCommentId) {
        qc.setQueryData<Comment[]>(latestKey, (old) => {
          const next = [...(old ?? []), tempComment];
          return next.slice(-2);
        });
      }
      return { prev, flatKey, treeKey, latestKey };
    },
    onError: (_err, _vars, ctx: any) => {
      if (!ctx) return;
      qc.setQueryData(ctx.flatKey, ctx.prev.flat);
      qc.setQueryData(ctx.treeKey, ctx.prev.tree);
      qc.setQueryData(ctx.latestKey, ctx.prev.latest);
    },
    onSettled: (_c, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['comments', vars.postId] });
      qc.invalidateQueries({ queryKey: ['comments-tree', vars.postId] });
      qc.invalidateQueries({ queryKey: ['comments-latest', vars.postId] });
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
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['comments-tree', postId, userId],
    queryFn: async (): Promise<CommentNode[]> => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(id, handle, display_name, avatar_path)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const flat = (data ?? []) as Comment[];

      // Enrich with viewer's hearts so the heart icon renders filled
      // for comments the user has already reacted to.
      let heartedSet = new Set<string>();
      if (userId && flat.length > 0) {
        const ids = flat.map((c) => c.id);
        const { data: hearts } = await supabase
          .from('comment_reactions')
          .select('comment_id')
          .eq('profile_id', userId)
          .eq('reaction_type', 'heart')
          .in('comment_id', ids);
        heartedSet = new Set((hearts ?? []).map((h: any) => h.comment_id));
      }

      // Build map first so insertion order doesn't matter.
      const byId = new Map<string, CommentNode>();
      for (const c of flat) {
        byId.set(c.id, { ...c, viewer_hearted: heartedSet.has(c.id), children: [] });
      }

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

/**
 * Toggle the viewer's heart on a single comment. Optimistic — the
 * icon flips and the count adjusts immediately in the tree, rolls
 * back on error.
 */
export function useToggleCommentHeart(postId: string | null) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { data: existing } = await supabase
        .from('comment_reactions')
        .select('id')
        .eq('comment_id', commentId)
        .eq('profile_id', userId)
        .eq('reaction_type', 'heart')
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { hearted: false };
      } else {
        const { error } = await supabase
          .from('comment_reactions')
          .insert({ comment_id: commentId, profile_id: userId, reaction_type: 'heart' });
        if (error) throw error;
        return { hearted: true };
      }
    },
    onMutate: async (commentId) => {
      if (!postId || !userId) return { undo: () => {} };
      const treeKey = ['comments-tree', postId, userId];
      await qc.cancelQueries({ queryKey: treeKey });
      const prev = qc.getQueryData<CommentNode[]>(treeKey);
      if (!prev) return { undo: () => {} };
      const flip = (nodes: CommentNode[]): CommentNode[] =>
        nodes.map((n) => {
          if (n.id === commentId) {
            const wasHearted = !!n.viewer_hearted;
            return {
              ...n,
              viewer_hearted: !wasHearted,
              heart_count: Math.max(0, (n.heart_count ?? 0) + (wasHearted ? -1 : 1)),
            };
          }
          if (n.children.length > 0) return { ...n, children: flip(n.children) };
          return n;
        });
      qc.setQueryData<CommentNode[]>(treeKey, flip(prev));
      return { undo: () => qc.setQueryData(treeKey, prev) };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.undo) try { context.undo(); } catch {}
    },
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
