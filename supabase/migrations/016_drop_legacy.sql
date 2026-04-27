-- ─────────────────────────────────────────────────────────────────────────
-- 016: Drop legacy tables (Pulse, Bridge, WAMP, prior candon_*)
-- ─────────────────────────────────────────────────────────────────────────
-- HereToo is now: Feed (public posts) + Family (family-scoped posts).
-- This migration removes everything that's no longer in the codebase.
-- Run this ONCE in the Supabase SQL editor.
-- It is destructive — there is no rollback. Make sure you don't actually
-- want any of these tables before running.

-- ── Pulse (migrations 003) ──
DROP TABLE IF EXISTS public.pulse_votes      CASCADE;
DROP TABLE IF EXISTS public.pulse_statements CASCADE;
DROP TABLE IF EXISTS public.pulse_topics     CASCADE;

-- ── Bridge (migrations 004) ──
DROP TABLE IF EXISTS public.bridge_messages  CASCADE;
DROP TABLE IF EXISTS public.bridge_sessions  CASCADE;

-- ── Bridging scores / trust history (migration 005) ──
DROP TABLE IF EXISTS public.bridging_score_history CASCADE;
DROP TABLE IF EXISTS public.trust_score_history    CASCADE;

-- ── WAMP token (migration 013) ──
DROP TABLE IF EXISTS public.wamp_transactions CASCADE;
DROP TABLE IF EXISTS public.wamp_balances     CASCADE;
DROP FUNCTION IF EXISTS public.credit_wamp(UUID, NUMERIC, TEXT, TEXT) CASCADE;

-- ── Prior candon_* attempt (migrations 015-023, deleted from codebase) ──
DROP TABLE IF EXISTS public.candon_post_view_log         CASCADE;
DROP TABLE IF EXISTS public.candon_inbound_emails        CASCADE;
DROP TABLE IF EXISTS public.candon_family_medical_updates CASCADE;
DROP TABLE IF EXISTS public.candon_family_post_recipients CASCADE;
DROP TABLE IF EXISTS public.candon_event_rsvps           CASCADE;
DROP TABLE IF EXISTS public.candon_family_assignments    CASCADE;
DROP TABLE IF EXISTS public.candon_family_events         CASCADE;
DROP TABLE IF EXISTS public.candon_family_posts          CASCADE;
DROP TABLE IF EXISTS public.candon_family_memberships    CASCADE;
DROP TABLE IF EXISTS public.candon_family_groups         CASCADE;
DROP TABLE IF EXISTS public.candon_contact_tags          CASCADE;
DROP TABLE IF EXISTS public.candon_contacts              CASCADE;
DROP TABLE IF EXISTS public.candon_user_profiles         CASCADE;
DROP TABLE IF EXISTS public.candon_notification_jobs     CASCADE;

DROP FUNCTION IF EXISTS public.candon_is_family_member(UUID)        CASCADE;
DROP FUNCTION IF EXISTS public.candon_family_role(UUID)             CASCADE;
DROP FUNCTION IF EXISTS public.candon_can_view_post(UUID)           CASCADE;
DROP FUNCTION IF EXISTS public.candon_auto_add_owner_membership()   CASCADE;
DROP FUNCTION IF EXISTS public.candon_whoami(UUID)                  CASCADE;
DROP FUNCTION IF EXISTS public.candon_family_ancestry(UUID)         CASCADE;
DROP FUNCTION IF EXISTS public.get_candon_network_stats()           CASCADE;

-- ── Storage: candon-photos bucket (orphaned; used by deleted features) ──
-- Note: a non-empty bucket must have its objects deleted first. The dashboard
-- "Storage" tab is the safest place to do that. If empty, this is a no-op.
DELETE FROM storage.objects WHERE bucket_id = 'candon-photos';
DELETE FROM storage.buckets WHERE id = 'candon-photos';

-- ── Drop bridging-related columns from `posts` (no longer used) ──
ALTER TABLE public.posts DROP COLUMN IF EXISTS bridging_score;
ALTER TABLE public.posts DROP COLUMN IF EXISTS bridging_score_components;
