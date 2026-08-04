-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 070: the word "family" survived in the data
-- ════════════════════════════════════════════════════════════════════════
-- The rewrite cut "family" from every user-facing string. It could not
-- cut it from the rows, and family_members.relationship_label is READ
-- ONTO THE SCREEN — the crew picker renders it under each crew, and the
-- update-recipient picker renders it under each member. So the retired
-- word kept appearing in the product, written by the app itself every
-- time somebody joined.
--
-- constants/vocab.ts is explicit that the schema keeps the old word
-- forever: tables, columns, RPCs, policies. That hard rule is about
-- IDENTIFIERS. relationship_label is not an identifier — it is a string
-- a person reads, stored in a column. Display copy that happens to live
-- in a row is still display copy, and this migration treats it that way.
-- The column name stays `relationship_label` on the family_members
-- table, exactly as the rule requires. Only the value changes.
--
-- 'owner' is left alone. It says what it means and always did.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Existing rows ─────────────────────────────────────────────────
-- Every membership written by /join or the seed-invite flow carries the
-- literal 'family'. The app now writes Vocab.member ('member'); this
-- brings the rows already in the table in line with it, so old and new
-- memberships do not render two different words side by side.
update public.family_members
   set relationship_label = 'member'
 where relationship_label = 'family';


-- ── 2. Jude's crew ───────────────────────────────────────────────────
-- Renamed from "Jude's Family page". The point of the rewrite was that
-- this is HIS place, not a page about a family he belongs to. Scoped by
-- exact current name so re-running it after the rename is a no-op and it
-- can never touch another crew.
update public.families
   set name = 'Jude''s'
 where name = 'Jude''s Family page';


-- ── 3. Verify ────────────────────────────────────────────────────────
--   select relationship_label, count(*)
--     from public.family_members group by 1 order by 2 desc;
--   -- expect 'owner' and 'member' only; no 'family'
--
--   select name from public.families order by created_at;
--   -- expect "Jude's", not "Jude's Family page"

-- DONE.
