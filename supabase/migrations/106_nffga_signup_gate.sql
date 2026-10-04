-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 106: Open sign-up on the shared project
-- ════════════════════════════════════════════════════════════════════════
-- Cameron, 2026-10-04: "remove the .gov signups rule. anyone can use it.
-- its irrelevant to non firefighters anyway and I want a restriction free
-- customer funnel."
--
-- Project avepftawrkwytlohobjh (EMSPCR) is shared by EMSPCR, Car56 and
-- NFFGA. Its trigger `trg_enforce_pilot_signup_allowlist` (BEFORE INSERT
-- ON auth.users) ran public.enforce_pilot_signup_allowlist(), which refused
-- any new account unless the email ended in .gov, was listed in
-- public.signup_email_allowlist, or the sign-up carried app = 'car56'.
-- That blocked an ordinary firefighter with a gmail address from joining
-- NFFGA, and the same gate sat in front of EMSPCR and Car56.
--
-- THIS FILE OPENS IT FOR ALL THREE PRODUCTS. The function now admits
-- every new user. The trigger itself stays in place (auth.users belongs to
-- supabase_auth_admin, so dropping or disabling the trigger is not ours to
-- do; replacing the function we own is), which also means re-closing the
-- gate later is a single `create or replace` with no trigger work.
--
-- The allowlist table public.signup_email_allowlist is left untouched.
--
-- WHAT STILL PROTECTS EACH PRODUCT. Sign-up being open does not grant
-- access to anything: NFFGA's admin seats require an emailed-link session
-- (migration 102); Car56 scopes case files by organisation; EMSPCR's data
-- is behind its own RLS. Note the project also auto-confirms email
-- (mailer_autoconfirm: true as of 2026-10-04) — so an account's email
-- address is unverified unless that setting is turned on.
--
-- ── TO RESTORE THE PILOT GATE, run exactly this ──────────────────────────
-- CREATE OR REPLACE FUNCTION public.enforce_pilot_signup_allowlist()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'auth'
-- AS $function$ declare v_email text := lower(coalesce(new.email, '')); v_in_allowlist boolean; begin if coalesce(new.raw_user_meta_data->>'app','') = 'car56' then return new; end if; if v_email ~* '\.gov$' then return new; end if; select exists ( select 1 from public.signup_email_allowlist where lower(email) = v_email ) into v_in_allowlist; if v_in_allowlist then return new; end if; raise exception 'pilot_signup_blocked: email % is not in the pilot allowlist (any .gov address or a row in signup_email_allowlist required)', v_email using errcode = '42501'; end; $function$
-- ─────────────────────────────────────────────────────────────────────────
-- (Captured verbatim from pg_get_functiondef on 2026-10-04, owner postgres.
--  Trigger: CREATE TRIGGER trg_enforce_pilot_signup_allowlist BEFORE INSERT
--  ON auth.users FOR EACH ROW EXECUTE FUNCTION enforce_pilot_signup_allowlist())
--
-- Run against project avepftawrkwytlohobjh only. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.enforce_pilot_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  -- Open sign-up (2026-10-04). See this migration's header for the
  -- previous rule and how to restore it.
  return new;
end;
$function$;

comment on function public.enforce_pilot_signup_allowlist() is
  'OPEN since 2026-10-04 (NFFGA migration 106): admits every new user. The previous .gov / allowlist / car56 rule is preserved in supabase/migrations/106_nffga_signup_gate.sql in the NFFGA repo.';

commit;
