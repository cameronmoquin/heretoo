-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 005: Public posting requires family membership
-- ════════════════════════════════════════════════════════════════════════
-- Tightens the posts INSERT policy so a user can only create a post with
-- visibility='public' or 'connections' if they have at least one active
-- family_members row. Family-scoped posts (visibility='family') are
-- already gated by family_members membership in the existing policy.
--
-- Why: family ties are HereToo's anti-spam layer. You earn the right to
-- post in the common area by being in at least one family graph. The
-- client-side composer hides the post button for non-members, but RLS
-- is the only thing that actually enforces the rule.
-- ════════════════════════════════════════════════════════════════════════

-- SECURITY DEFINER helper: does the current user have ANY active family?
-- Wrapped in a function so the policy stays cheap and inlinable.
create or replace function public.viewer_has_active_family()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where profile_id = auth.uid()
      and status = 'active'
  );
$$;

grant execute on function public.viewer_has_active_family() to authenticated;

-- Replace whatever INSERT policy currently exists on posts with one that
-- gates public/connections posting on family membership.
drop policy if exists posts_insert on public.posts;

create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    -- Author is always the current user.
    author_id = auth.uid()
    and (
      -- Private + family posts: no extra gate (family membership is
      -- already enforced by family_id check below for family posts).
      visibility = 'private'
      or (
        visibility = 'family'
        and family_id is not null
        and exists (
          select 1 from public.family_members fm
          where fm.family_id = posts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'
        )
      )
      -- Public + connections-scoped posts: must be in at least one family.
      or (
        visibility in ('public', 'connections')
        and public.viewer_has_active_family()
      )
    )
  );

-- DONE.
