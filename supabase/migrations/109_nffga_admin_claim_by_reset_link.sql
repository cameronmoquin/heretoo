-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 109: An emailed reset link also proves the inbox
-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-04. NFFGA's "email me a link" now goes out through Resend in the
-- branded frame (netlify/functions/request-password-reset.ts) as a
-- RECOVERY link, not Supabase's magic link. Clicking it gives a session
-- whose JWT amr method is 'recovery', which 102's claim_admin_seat()
-- refused, so an admin following the branded email could not take their
-- seat.
--
-- A recovery link is delivered to the inbox exactly like a magic link, so
-- it proves the same thing. This accepts 'recovery' and 'invite' (an
-- invitation email) alongside 'otp' and 'magiclink'. A password session
-- still cannot claim a seat — the reason 102 exists.
--
-- Same signature and behaviour as 102 otherwise. Only claim_admin_seat()
-- is replaced; it was created by NFFGA migration 102. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.claim_admin_seat()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  em      text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  held    text;
  d       public.nffga_admin_designations;
  by_link boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select role into held from public.nffga_officers where user_id = uid;
  if found then
    return jsonb_build_object('ok', true, 'role', held);
  end if;

  select * into d from public.nffga_admin_designations where email = em for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_designated');
  end if;

  if d.claimed_by is not null and d.claimed_by <> uid then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  -- Any session that began by clicking a link sent to this inbox.
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'magiclink', 'recovery', 'invite')
  ) into by_link;
  if not by_link then
    return jsonb_build_object('ok', false, 'error', 'email_link_required');
  end if;

  insert into public.nffga_officers (user_id, role) values (uid, d.role)
    on conflict (user_id) do update set role = excluded.role;
  update public.nffga_admin_designations
    set claimed_by = uid, claimed_at = now()
    where email = d.email;

  return jsonb_build_object('ok', true, 'role', d.role, 'claimed', true);
end; $$;
revoke all on function public.claim_admin_seat() from public, anon;
grant execute on function public.claim_admin_seat() to authenticated;

commit;
