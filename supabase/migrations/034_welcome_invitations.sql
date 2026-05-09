-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 034: Welcome invitations (Source of Truth, M9)
-- ════════════════════════════════════════════════════════════════════════
-- The onboarding ceremony's data layer. A user (the granddaughter)
-- creates a welcome invitation for a recipient (the grandmother). The
-- invitation carries:
--   - a unique URL token (the QR code on the printed card resolves here)
--   - the recipient's first name + relationship (Bike Messenger reads
--     these aloud in the greeting)
--   - the family they'll join when they accept
--   - an optional 20-second voice note from the inviter (Supabase
--     Storage path)
--   - card_design (string id; only used by the print pipeline, which
--     is a follow-up — Lob integration not in this migration)
--
-- The recipient flow:
--   /welcome/{token} → "Begin" → Bike Messenger reads the greeting →
--   inviter's optional voice note plays → "Step inside" → routes to
--   the auth flow with the family's invite code pre-filled, so the
--   account creation form pre-fills handle suggestion + family.
--
-- Privacy: address fields are stored as a jsonb blob and only the
-- inviter (or service-role print fn) can read them. The token is
-- secret-ish — anyone with it can claim, so the inviter shares it
-- by hand or on the printed card.
--
-- Refusal list (M9):
--   - No "complete your profile" prompts after onboarding.
--   - No "invite five more family members to unlock features."
--   - No date of birth — never asked.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.welcome_invitations (
  token                       text primary key,
  inviter_id                  uuid references public.profiles(id) on delete set null,
  recipient_first_name        text not null check (length(recipient_first_name) between 1 and 60),
  recipient_relationship      text check (length(recipient_relationship) <= 60),
  recipient_address           jsonb,
  card_design                 text default 'pressed-flower',
  voice_note_url              text,
  family_id                   uuid references public.families(id) on delete set null,
  shipped_at                  timestamptz,
  claimed_at                  timestamptz,
  claimed_by_user_id          uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now()
);

create index if not exists welcome_invitations_inviter_idx
  on public.welcome_invitations (inviter_id, created_at desc);

alter table public.welcome_invitations enable row level security;

-- The inviter sees their own invitations.
drop policy if exists welcome_invitations_inviter_read on public.welcome_invitations;
create policy welcome_invitations_inviter_read on public.welcome_invitations
  for select to authenticated
  using (auth.uid() = inviter_id);

-- The claimant can read their own claimed row (for inviter attribution
-- on the welcome screen).
drop policy if exists welcome_invitations_claimant_read on public.welcome_invitations;
create policy welcome_invitations_claimant_read on public.welcome_invitations
  for select to authenticated
  using (auth.uid() = claimed_by_user_id);

-- Insert: an active family member of the target family.
drop policy if exists welcome_invitations_insert on public.welcome_invitations;
create policy welcome_invitations_insert on public.welcome_invitations
  for insert to authenticated
  with check (
    auth.uid() = inviter_id
    and (
      family_id is null
      or exists (
        select 1 from public.family_members fm
        where fm.family_id = welcome_invitations.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )
  );

-- Update: only the inviter (e.g., to attach a voice note after
-- creation, mark shipped, etc.).
drop policy if exists welcome_invitations_inviter_update on public.welcome_invitations;
create policy welcome_invitations_inviter_update on public.welcome_invitations
  for update to authenticated
  using (auth.uid() = inviter_id)
  with check (auth.uid() = inviter_id);

-- 2. Public-read RPC for the unauthenticated /welcome/{token} surface
-- ────────────────────────────────────────────────────────────────────
-- The recipient is NOT signed in when they open the welcome URL. We
-- can't grant SELECT on the table to anon (the address blob is
-- private). So a security-definer RPC returns only the safe fields
-- needed to render the ceremony.

create or replace function public.welcome_invitation_public(p_token text)
returns table (
  recipient_first_name    text,
  recipient_relationship  text,
  inviter_first_name      text,
  inviter_handle          text,
  family_id               uuid,
  family_name             text,
  family_invite_code      text,
  voice_note_url          text,
  card_design             text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wi.recipient_first_name,
    wi.recipient_relationship,
    coalesce(p.display_name, p.handle) as inviter_first_name,
    p.handle as inviter_handle,
    wi.family_id,
    f.name as family_name,
    f.invite_code as family_invite_code,
    wi.voice_note_url,
    wi.card_design
  from public.welcome_invitations wi
  left join public.profiles p on p.id = wi.inviter_id
  left join public.families f on f.id = wi.family_id
  where wi.token = p_token
  limit 1;
$$;

-- Anonymous access — anyone with the token can read these public bits.
grant execute on function public.welcome_invitation_public(text) to anon, authenticated;

-- 3. Mark-claimed RPC ──────────────────────────────────────────────────
-- Called once the recipient has signed in. Stamps claimed_by_user_id
-- and claimed_at. Can be re-called idempotently; subsequent calls are
-- no-ops if the same user re-opens the URL.

create or replace function public.welcome_invitation_claim(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  row public.welcome_invitations%rowtype;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  select * into row from public.welcome_invitations where token = p_token;
  if row.token is null then
    raise exception 'Invitation not found';
  end if;
  if row.claimed_by_user_id is not null and row.claimed_by_user_id <> caller then
    -- Already claimed by someone else; ignore silently.
    return;
  end if;
  update public.welcome_invitations
    set claimed_by_user_id = caller,
        claimed_at = coalesce(claimed_at, now())
    where token = p_token;
end;
$$;

grant execute on function public.welcome_invitation_claim(text) to authenticated;

-- DONE.
