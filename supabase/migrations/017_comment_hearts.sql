-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 017: Comment hearts
-- ════════════════════════════════════════════════════════════════════════
-- Hearts on posts (post_reactions) shipped in migration 002. Hearts on
-- COMMENTS were never wired — the UI button on the comment row had no
-- backing handler. This adds:
--   1. comment_reactions table (one heart per (comment, profile))
--   2. comments.heart_count denorm column kept honest by triggers
--   3. RLS that mirrors post_reactions: read if you can read the
--      underlying comment, write/delete only your own row
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.comment_reactions (
  id            uuid primary key default gen_random_uuid(),
  comment_id    uuid not null references public.comments(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'heart',
  created_at    timestamptz not null default now(),
  unique (comment_id, profile_id, reaction_type)
);

create index if not exists comment_reactions_comment_idx
  on public.comment_reactions(comment_id);

alter table public.comments
  add column if not exists heart_count int not null default 0;

alter table public.comment_reactions enable row level security;

drop policy if exists cr_read on public.comment_reactions;
create policy cr_read on public.comment_reactions
  for select to authenticated using (
    exists (
      select 1 from public.comments c
      where c.id = comment_reactions.comment_id
    )
  );

drop policy if exists cr_self_write on public.comment_reactions;
create policy cr_self_write on public.comment_reactions
  for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists cr_self_delete on public.comment_reactions;
create policy cr_self_delete on public.comment_reactions
  for delete to authenticated using (auth.uid() = profile_id);

-- Trigger to keep heart_count honest.
create or replace function public.bump_comment_heart()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set heart_count = heart_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments set heart_count = greatest(heart_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end$$;

drop trigger if exists comment_hearts_count_ins on public.comment_reactions;
drop trigger if exists comment_hearts_count_del on public.comment_reactions;

create trigger comment_hearts_count_ins after insert on public.comment_reactions
  for each row execute function public.bump_comment_heart();
create trigger comment_hearts_count_del after delete on public.comment_reactions
  for each row execute function public.bump_comment_heart();

-- DONE.
