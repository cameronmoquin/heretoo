-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 016: Notification email override + phone column
-- ════════════════════════════════════════════════════════════════════════
-- notification_prefs already had the toggle columns (email_*, sms_*) but
-- no place to STORE which email / phone to send to. Sometimes the
-- account email isn't where the user wants notifications (e.g. they
-- signed up with phone, or use a different inbox for HereToo). Now
-- they can enter a notification_email that overrides the auth.users
-- email, and a notification_phone for future SMS support.
--
-- Both nullable: null means "use the auth.users email" (or, for SMS,
-- "no SMS for now").
-- ════════════════════════════════════════════════════════════════════════

alter table public.notification_prefs
  add column if not exists notification_email text,
  add column if not exists notification_phone text,
  add column if not exists email_verified_at  timestamptz;

create index if not exists notification_prefs_email_idx
  on public.notification_prefs(notification_email)
  where notification_email is not null;

-- DONE.
