-- ════════════════════════════════════════════════════════════════════════
-- HereToo Migration 060: line reactions on post_reactions
-- ════════════════════════════════════════════════════════════════════════
-- You react to a slip by firing a real Shakespeare line at it. The
-- reaction vocabulary is language, not glyphs.
--
-- WHAT CHANGES
--   1. reaction_type stops being a one-value column. It now accepts
--      'heart' plus a bounded set of line-reaction keys, one per
--      category declared in data/bard-insults.json (meta.categories).
--      Keys are 'line:<category>'. Bounded on purpose: the column
--      cannot become a dumping ground for free text.
--   2. New nullable column line_ref holds WHICH line was fired. It is a
--      stable identifier, not the quote. The client resolves it against
--      the bundled corpus and renders text + speaker + play.
--   3. bump_heart_count() learns to count hearts only. Without this
--      guard the existing INSERT/DELETE triggers on post_reactions
--      would inflate posts.heart_count on every line reaction. Hearts
--      must behave exactly as they did.
--
-- WHAT DOES NOT CHANGE
--   * Existing rows. Every current row is reaction_type='heart' with
--     line_ref null, which satisfies both new constraints untouched.
--   * posts.heart_count. No line reaction can exist before this file
--     runs (the old check blocks the insert), so there is no drift to
--     backfill.
--   * RLS. Policies reactions_read and reactions_self from migration
--     002 are left exactly as they are. reactions_self is FOR ALL with
--     auth.uid() = profile_id on both USING and WITH CHECK, so it
--     already covers insert, update, and delete of a line reaction by
--     the person who fired it. Nothing here grants, widens, or drops a
--     policy.
--   * post_heart_family_diversity (025) already filters
--     reaction_type = 'heart', so the unifying score is unaffected.
--
-- NO COUNTS. Nothing in this file tallies reactions per type. A
-- reaction shows what was said and who said it. It does not score.
--
-- Idempotent. Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Drop every existing check constraint that mentions reaction_type ──
-- Found by definition rather than by name so a differently-named
-- constraint (or a re-run of this file) cannot leave a stale rule
-- standing.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'post_reactions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reaction_type%'
  loop
    execute format('alter table public.post_reactions drop constraint %I', c.conname);
  end loop;
end$$;

-- ── 2. The line identifier column ───────────────────────────────────────
alter table public.post_reactions
  add column if not exists line_ref text;

comment on column public.post_reactions.line_ref is
  'Stable identifier of the Shakespeare line fired at this post. Null for hearts. Resolved client-side against data/bard-insults.json to render text, speaker, and play.';

-- ── 3. The bounded reaction vocabulary ──────────────────────────────────
-- Keys mirror meta.categories in data/bard-insults.json. Fifteen of the
-- seventeen appear on lines today; baiting and flytingVolley are
-- declared in the corpus and included so a future line in either
-- category does not need a migration.
alter table public.post_reactions
  add constraint post_reactions_reaction_type_check
  check (reaction_type in (
    'heart',
    'line:compoundStack',
    'line:objectMetaphor',
    'line:cascade',
    'line:nameAsWeapon',
    'line:deformityBestiary',
    'line:universalCurse',
    'line:elementalCurse',
    'line:threatInsult',
    'line:selfDirected',
    'line:codedAntic',
    'line:baiting',
    'line:villainsBoast',
    'line:statureInsult',
    'line:clothesBurn',
    'line:witCombat',
    'line:flytingVolley',
    'line:massInsult'
  ));

-- ── 4. Pair the two columns ─────────────────────────────────────────────
-- A heart carries no line. A line reaction must carry one, otherwise
-- the post has nothing to quote.
alter table public.post_reactions
  add constraint post_reactions_line_ref_pairing_check
  check (
    (reaction_type = 'heart' and line_ref is null)
    or (reaction_type <> 'heart'
        and line_ref is not null
        and length(line_ref) between 1 and 120)
  );

-- ── 5. Read path for a post's fired lines ───────────────────────────────
create index if not exists post_reactions_line_post_idx
  on public.post_reactions (post_id, created_at)
  where reaction_type <> 'heart';

-- ── 6. Hearts keep counting. Lines never do. ────────────────────────────
-- Same triggers from 002 (reactions_count_ins / reactions_count_del),
-- same function name, one guard added. Replacing the body leaves both
-- triggers bound and working.
create or replace function public.bump_heart_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.reaction_type is distinct from 'heart' then return null; end if;
    update public.posts set heart_count = heart_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    if old.reaction_type is distinct from 'heart' then return null; end if;
    update public.posts set heart_count = greatest(heart_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end$$;

-- Project rule, learned the hard way: name all three roles. PostgREST
-- reaches the database as anon, and Supabase grants EXECUTE to anon
-- directly rather than only through PUBLIC. Revoking public and
-- authenticated alone leaves the anon grant standing. This is a trigger
-- function and nothing should ever call it by hand.
do $$
begin
  revoke all on function public.bump_heart_count() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.bump_heart_count() from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.bump_heart_count() from authenticated;
  end if;
end$$;

commit;

-- PostgREST caches the table shape. Without this the new column stays
-- invisible to the client until the next restart.
notify pgrst, 'reload schema';
