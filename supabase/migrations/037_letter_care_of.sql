-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 037: care_of_email on letter_recipients
-- ════════════════════════════════════════════════════════════════════════
-- A future recipient may be a child without an email of their own —
-- a grandchild not yet born, a one-year-old. The author can address
-- the letter c/o a parent so the delivery email lands somewhere a
-- responsible adult will see it.
--
-- Behavior in deliver-letters.ts:
--   - If user_id is set: email goes to that auth user's address.
--   - Else if care_of_email is set: email goes there with a clear
--     "Care of {name}" line in the subject + body.
--   - Else: no email; the author hands the claim URL by other means.
-- ════════════════════════════════════════════════════════════════════════

alter table public.letter_recipients
  add column if not exists care_of_email text;

-- Soft check: if care_of_email is set, the recipient must be a future
-- recipient (no resolved user) at create time. After claim, the
-- email becomes irrelevant; we keep it as historical metadata.
-- The check is advisory — the column is nullable and there's no
-- enforced constraint, so a parent's email can stay attached to a
-- claimed letter for the audit trail.

-- DONE.
