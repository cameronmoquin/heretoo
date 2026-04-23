# Candon — Relationship Assistant + Family Bulletin Board

Private vertical at `candon.heretoo.social`.
Built inside the existing HereToo Supabase project but namespace-isolated.

See full spec below.

> Full spec saved as-is from the build doc. Sections 1–26 cover product,
> schema, auth/RLS, realtime, reservoir content engine, draft assembly,
> family bulletin workflows, Edge Functions, scheduled jobs, mobile/web
> routing, Resend integration, hidden admin outreach, security, reuse
> strategy, QA, and phased rollout.

---

## High-level architecture

- **Hosting:** subdomain `candon.heretoo.social`, shared Supabase project
- **Auth:** reuse HereToo auth + membership, add role/feature flags
- **Schema:** additive migrations, namespaced tables (`contacts`, `family_groups`, `daily_queue`, etc.)
- **RLS:** personal data owner-only; family posts scoped by membership + visibility
- **Mobile:** Android SMS compose mode first, direct-send mode behind feature flag; iOS `MFMessageComposeViewController` in expansion phase
- **Email:** Resend for bulletins, digests, inbound replies via webhook
- **Realtime:** Supabase Broadcast for family feed, queue refresh, RSVP/assignment updates
- **Cron:** `pg_cron` + `pg_net` for daily queue build, digest send, notification processing, reservoir rotation

## Core products

1. **Personal Relationship Assistant** — daily outreach queue, draft generator, content reservoir (quotes / fun facts / openers), Android compose send, iOS composer bridge (later).
2. **Family Bulletin Board** — shared feed with events, assignments, RSVPs, medical updates with scoped visibility, email bulletins, inbound replies.
3. **Hidden admin outreach** — gated work/campaign outreach modes reusing the same queue engine, not visible in standard nav.

## Phased rollout

1. Foundation (schema, auth, shells, CRUD)
2. Personal queue MVP (scoring, drafts, reservoir, digest, Android compose)
3. Family board MVP (posts, events, assignments, Resend bulletins, realtime)
4. Sensitive workflows (medical, scoped visibility, audit, inbound email)
5. Expanded mobile (Android direct-send, iOS composer, push, offline)
6. Hidden admin outreach (work/campaign modes, segmentation, audit)
7. Intelligence layer (AI refinement, adaptive cadence, reply-aware tuning)

## Scope estimate

Roughly 20+ tables, 10+ Edge Functions, 9 scheduled jobs, 2 app shells,
separate mobile modules for iOS and Android, inbound email processing,
and a hidden admin surface. Conservatively a **multi-week engineering
effort** if built completely. Phase 1 alone (foundation + basic CRUD)
is a several-day commitment.

## Integration notes for HereToo

- Reuse Supabase project, auth, UI tokens, notification prefs
- Keep Candon logic in its own route group (`/candon/*` or subdomain shell)
- Additive migrations only — never rename HereToo tables
- Feature-flag Candon features per hostname
- Do not overload existing `posts`, `profiles`, or `engagements` tables with family/medical semantics

---

## Full spec

(Full markdown body follows — copied verbatim from the incoming build spec.)
