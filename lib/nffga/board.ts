/**
 * The clubhouse board: nffga_posts and nffga_comments.
 *
 * Reads are public (anon). Writes need a session; RLS decides who may
 * post an announcement or soft-delete. Deleting sets deleted_at.
 * Author profiles are fetched separately and merged, since there may be
 * no FK path for PostgREST to embed posts -> profiles.
 */
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { ensureProfile } from './auth';
import type { BoardComment, BoardPost } from './types';
import { fetchAuthors, quietRead, uploadMedia, writeErrorText, type PickedImage } from './profile';

export const POST_MAX = 4000;
export const COMMENT_MAX = 2000;
const PAGE = 20;

type PostRow = Omit<BoardPost, 'author' | 'comment_count'>;
type CommentRow = Omit<BoardComment, 'author'>;

async function decoratePosts(rows: PostRow[]): Promise<BoardPost[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [authors, commentRows] = await Promise.all([
    fetchAuthors(rows.map((r) => r.author_id)),
    quietRead<{ post_id: string }[]>(
      'nffga_comments counts',
      () => supabase.from('nffga_comments').select('post_id').in('post_id', ids).is('deleted_at', null).limit(5000),
      [],
    ),
  ]);
  const counts = new Map<string, number>();
  for (const c of commentRows) counts.set(c.post_id, (counts.get(c.post_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, author: authors.get(r.author_id) ?? null, comment_count: counts.get(r.id) ?? 0 }));
}

/** Newest first. `before` is a created_at cursor for paging. */
export async function listPosts(opts: { limit?: number; before?: string | null; authorId?: string } = {}): Promise<BoardPost[]> {
  const rows = await quietRead<PostRow[]>(
    'nffga_posts list',
    () => {
      let q = supabase
        .from('nffga_posts')
        .select('id, author_id, body, photo_path, photo_paths, kind, created_at, deleted_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(opts.limit ?? PAGE);
      if (opts.before) q = q.lt('created_at', opts.before);
      if (opts.authorId) q = q.eq('author_id', opts.authorId);
      return q;
    },
    [],
  );
  return decoratePosts(rows);
}

export async function getPost(id: string): Promise<BoardPost | null> {
  const row = await quietRead<PostRow | null>(
    'nffga_posts get',
    () => supabase
      .from('nffga_posts')
      .select('id, author_id, body, photo_path, photo_paths, kind, created_at, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    null,
  );
  if (!row) return null;
  const [post] = await decoratePosts([row]);
  return post ?? null;
}

export async function listComments(postId: string): Promise<BoardComment[]> {
  const rows = await quietRead<CommentRow[]>(
    'nffga_comments list',
    () => supabase
      .from('nffga_comments')
      .select('id, post_id, author_id, body, created_at, deleted_at')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(500),
    [],
  );
  const authors = await fetchAuthors(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author: authors.get(r.author_id) ?? null }));
}

type WriteResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Posting and commenting need an nffga_profiles row (migration 105). The
 * app creates it on sign-in (components/nffga/EnsureProfile.tsx), but if a
 * write is refused for lack of it, create it and try once more.
 */
async function withProfileRetry<T extends { error: { code?: string } | null }>(write: () => PromiseLike<T>): Promise<T> {
  const first = await write();
  if (first.error?.code !== '42501') return first;
  await ensureProfile('');
  return write();
}

/** Up to five photos per post; the database enforces it too (migration 108). */
export const POST_MAX_PHOTOS = 5;

export async function createPost(input: {
  userId: string; body: string; kind?: 'post' | 'announcement';
  photos?: PickedImage[]; photo?: PickedImage | null;
}): Promise<WriteResult> {
  const body = input.body.trim();
  const picked = [...(input.photos ?? []), ...(input.photo ? [input.photo] : [])].slice(0, POST_MAX_PHOTOS);
  if (!body && picked.length === 0) return { ok: false, error: 'Write something first.' };
  if (body.length > POST_MAX) return { ok: false, error: `Keep it under ${POST_MAX} characters.` };
  const photo_paths: string[] = [];
  try {
    // In order, so the post shows them the way they were chosen.
    for (const p of picked) photo_paths.push(await uploadMedia(input.userId, 'posts', p));
  } catch (err) {
    return { ok: false, error: writeErrorText(err, 'A photo did not upload. Try again.') };
  }
  const { data, error } = await withProfileRetry(() => supabase
    .from('nffga_posts')
    // photo_path is mirrored from photo_paths[0] by the database.
    .insert({ author_id: input.userId, body, photo_paths, kind: input.kind ?? 'post' })
    .select('id')
    .single());
  if (error) {
    // Don't leave the uploaded photos behind for a post that never saved.
    if (photo_paths.length) supabase.storage.from('nffga-media').remove(photo_paths).catch(() => {});
    return { ok: false, error: writeErrorText(error, 'The post did not save. Try again.') };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function createComment(input: { userId: string; postId: string; body: string }): Promise<WriteResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > COMMENT_MAX) return { ok: false, error: `Keep it under ${COMMENT_MAX} characters.` };
  const { data, error } = await withProfileRetry(() => supabase
    .from('nffga_comments')
    .insert({ post_id: input.postId, author_id: input.userId, body })
    .select('id')
    .single());
  if (error) return { ok: false, error: writeErrorText(error, 'The comment did not save. Try again.') };
  return { ok: true, id: (data as { id: string }).id };
}

// No RETURNING here on purpose: the public SELECT policy hides deleted
// rows, and Postgres checks RETURNING rows against it, so asking for the
// row back would fail the delete. The count says whether RLS let it through.
async function softDelete(table: 'nffga_posts' | 'nffga_comments', id: string): Promise<WriteResult> {
  const { error, count } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id);
  if (error) return { ok: false, error: writeErrorText(error, 'That did not delete. Try again.') };
  if (count === 0) return { ok: false, error: 'You do not have permission to do that.' };
  return { ok: true };
}
export const deletePost = (id: string) => softDelete('nffga_posts', id);
export const deleteComment = (id: string) => softDelete('nffga_comments', id);

/** "just now", "5m", "3h", "2d", then a date. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(t);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Hooks ───────────────────────────────────────────────────────────

export const boardKeys = {
  all: ['nffga', 'board'] as const,
  feed: ['nffga', 'board', 'feed'] as const,
  latest: (n: number) => ['nffga', 'board', 'latest', n] as const,
  byAuthor: (id: string) => ['nffga', 'board', 'author', id] as const,
  post: (id: string) => ['nffga', 'board', 'post', id] as const,
  comments: (id: string) => ['nffga', 'board', 'comments', id] as const,
};

export function useBoardFeed() {
  return useInfiniteQuery({
    queryKey: boardKeys.feed,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listPosts({ limit: PAGE, before: pageParam }),
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1].created_at),
  });
}

export function useLatestPosts(n: number) {
  return useQuery({ queryKey: boardKeys.latest(n), queryFn: () => listPosts({ limit: n }) });
}

export function useMemberPosts(userId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.byAuthor(userId ?? ''),
    queryFn: () => listPosts({ limit: 10, authorId: userId }),
    enabled: !!userId,
  });
}

export function usePost(id: string | undefined) {
  return useQuery({ queryKey: boardKeys.post(id ?? ''), queryFn: () => getPost(id as string), enabled: !!id });
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: boardKeys.comments(postId ?? ''),
    queryFn: () => listComments(postId as string),
    enabled: !!postId,
  });
}

/** Refresh every board query after a write. */
export function useBoardRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: boardKeys.all });
}
