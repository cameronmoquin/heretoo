# HereToo — Source of Truth

*Build spec for the year ahead. Written May 2026. Open-ended sequencing; the calendar is yours. The destination is unchanged: a platform a grandmother pressures her family into joining.*

## How to read this document

This is the working bible. Twelve milestones, each one self-contained: it opens with its phenomenological spine (one or two paragraphs naming what experience it is trying to produce), then drops into build details (schemas, function signatures, file paths, acceptance criteria). You can pick any milestone on a Saturday morning and ship it without rereading the whole document.

The milestones are ordered by what compounds, not by what is easiest. The Room comes before the Letter because the Room changes the default surface of the platform and everything afterward sits inside it. The Anniversary Engine comes before Stage B because Stage B's bots need anniversaries to comment on. SEO comes before Distribution because the printed welcome card sends people to URLs that need to already rank.

Sections after the milestones cover identity (visual, auditory, motion), SEO and discoverability, economics, the no-go list (firm-but-pragmatic, with reasoning future-you can revisit), and a glossary of terms used across the spec.

There are no estimates in calendar weeks. The recipe said the doc must be specific enough to ship a milestone on a Saturday and broad enough to be the source of truth for a year. Estimates rot; specs don't.

## The seven-question filter

Every feature, copy decision, and visual choice gets passed through these questions before it ships. They are not aspirational; they are gates.

1. **Does this preserve intentionality?** Is the user's attention still directed at a specific person they love, or has the platform redirected it at itself?
2. **Does this strengthen the lifeworld?** After this ships, does the family's shared world feel more present, or has it been replaced by content?
3. **Is this ready-to-hand?** Does the feature disappear into the work of being-with-family, or does it become a thing the user has to think about?
4. **Is this authentic solicitude?** Does it free the user to take their own care, or does it leap in and take care for them?
5. **Would a 65-year-old want this for its own sake?** Not because her family is on it. Because of what it does to her interior life.
6. **Would a 14-year-old not be embarrassed by it?** The teenager test. If the grandchild rolls their eyes, the grandmother gets ambient social pressure to leave.
7. **Does it stay quiet when it should?** No streaks, no nudges, no anxiety architecture. Silence is a feature.

If a candidate feature fails any of these, the answer is not "ship a softer version." The answer is "no." The discipline of refusal is the moat.

---

## Milestone 1 — The Room

### Spine

The default surface of HereToo today is a feed. A feed is a hotel lobby: identical for every guest, optimized for throughput. The Room replaces it with a dwelling. When the user opens the app, they see the family's wallpaper bleeding to the edges, two or three posts laid out like postcards on a side table, the music station they last played already humming at a low volume, and the read-aloud voice ready to be summoned with one tap. The feed still exists — it is one tab away — but it is the fallback, not the front door.

This is the most important architectural change in the year. Every subsequent milestone assumes the Room exists and lives inside it. The Letter is composed in the Room. The Anniversary Engine surfaces inside the Room. The Chorus speaks from the Room.

Heidegger's distinction between a hotel and a home is not metaphor here; it is product spec. A hotel is the same for everyone. A home was decorated by someone who lives there. The Room is decorated by the family.

### Build

**Route.** The Room replaces the current home route. Path: `/` (web), root tab (mobile). The current Common feed moves to `/common` and gets a permanent link in LeftSidebar.

**Layout.** The Room is a single viewport, no scroll above the fold on standard sizes. Three zones:

- **The hearth** (top, ~25% of viewport on desktop, fixed): a single masthead with the family's name (or "Today" for the cross-family Common Room), the day, the weather in the family's centroid location if more than two members opt in, and a one-line dispatch from the Anniversary Engine when one fires (Milestone 4).
- **The mantel** (middle, ~50%): up to three "postcards." A postcard is a card-sized representation of a recent post. Layout is hand-set: image dominant if the post has media, type dominant if it does not. Postcards are not chronological — they are scored by the unifying-feed ranker but shown sparsely. Three is the maximum. If there is nothing worth showing, the mantel says so in plain prose: "Quiet day. Last post was Tuesday."
- **The side table** (bottom, ~25%): the music station card (current station, simple play/pause/next, the option to swap stations), the read-aloud button, and a single "compose" affordance. Nothing else.

**Multiple families.** Users in more than one family see a Room-switcher in the hearth — a horizontal row of family wallpaper swatches with names underneath. Tap to swap rooms. The Common Room is always the leftmost swatch. The cross-family bridging algorithm runs only inside the Common Room; per-family rooms show only that family's posts.

**Schema.**

```sql
-- New table: rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade, -- null = Common Room (per user)
  user_id uuid references auth.users(id) on delete cascade,
  last_visited_at timestamptz default now(),
  pinned_post_ids uuid[] default '{}', -- user can pin a postcard
  unique (family_id, user_id)
);

-- Materialized view: room_postcards
-- Refreshed by a Netlify scheduled function every 15 minutes per active user
create materialized view room_postcards as
select
  r.id as room_id,
  r.user_id,
  p.id as post_id,
  p.created_at,
  unifying_score(p.id, r.user_id) as score
from rooms r
join posts p on
  (r.family_id is null and p.family_id in (select family_id from family_members where user_id = r.user_id))
  or (r.family_id is not null and p.family_id = r.family_id)
where p.hidden_at is null
order by score desc;
```

**Postcard renderer.** New component: `<Postcard post={post} variant="image-dominant" | "type-dominant" />`. Image-dominant: 60% image, 40% type, type overlaid on a soft scrim (no hard text-shadow, no Instagram-style bottom-fade). Type-dominant: a pulled phrase from the post body in Syne 600, 32px, with a thin author byline beneath. The choice is made server-side based on whether the post has media of acceptable resolution (≥800px on the long edge); local fallback: image-dominant if media present, regardless.

**Empty state.** "Quiet day. Last post was [N days] ago." Below it, a single subdued action: "Write a letter." (Routes to Milestone 5 once shipped; until then, opens the standard composer.) Never "create more content," never "invite more people."

**Mobile.** The hearth shrinks to a single line. The mantel becomes a horizontal swipe of postcards (one at a time, snap). The side table becomes a bottom dock. The Room-switcher becomes a long-press on the hearth.

**Acceptance criteria.**

- A user opening HereToo for the first time after this ships sees the Room, not the feed, by default. No setting, no toggle.
- A user with no posts in the last 14 days sees the empty state in plain prose, no exclamation marks, no nudges.
- A user with three families sees three swatches in the hearth, plus the Common Room swatch.
- The wallpaper bleeds to the edge of the viewport on every breakpoint. No box around the Room.
- Switching rooms feels like turning a page, not loading a route. Use a 200ms cross-fade with the wallpaper as the constant.

**Refusal list.**

- No "trending" indicators on postcards.
- No view counts.
- No "X new posts" badge.
- No infinite scroll inside the Room. The mantel has three postcards, then it ends.

---

## Milestone 2 — The Wallpaper Library

### Spine

Wallpaper is dwelling architecture. The current library mixes hand-crafted SVG tiles with high-resolution scans of Morris designs. It works. It needs to deepen. A library that grandparents and grandchildren both find beautiful — different patterns, but the same canvas — is the visual answer to the half-one / half-two tension in the recipe.

The expansion is curated, not algorithmic. No user-generated wallpapers, no AI generation, no themes-marketplace. Each addition is chosen by someone with taste (you) and stays in the library forever. The library grows like a small museum's permanent collection.

### Build

**Add to library, in priority order.**

1. **C.F.A. Voysey** — *The Saladin* (1897), *Tulip and Bird* (1896), *The Owl* (1898). Public domain. Source: Met Museum open-access collection, V&A.
2. **William De Morgan** — Persian-inspired tile pattern repeats. Public domain.
3. **Owen Jones** — selected plates from *The Grammar of Ornament* (1856), specifically the Moresque, Persian, and Celtic chapters. Public domain.
4. **Japanese katagami** — three katagami stencil patterns from late Edo / Meiji period. Met has high-resolution scans. Public domain.
5. **Persian tilework** — a Safavid hexagonal tile and a Qajar floral repeat. Public domain.
6. **Indigo shibori** — one resist-dye pattern from late 19th-century Japan or West Africa. Public domain.
7. **Marbled endpapers** — three Italian or Turkish marbled paper scans from public-domain bookbinding archives.

For each addition: a 4096×4096 source PNG stored in Supabase Storage at `wallpapers/sourced/{slug}.png`, a 2048×2048 mobile variant, a 32×32 preview swatch for the picker. License attribution lives in the wallpaper picker's "About this pattern" affordance.

**Schema.**

```sql
alter table wallpapers add column kind text default 'svg' check (kind in ('svg','sourced'));
alter table wallpapers add column source_attribution text;
alter table wallpapers add column source_year int;
alter table wallpapers add column license text default 'public-domain';
alter table wallpapers add column added_to_library_at timestamptz default now();
```

**Picker UI.** The wallpaper picker becomes a small museum: patterns grouped by school (Arts and Crafts, Persian, Japanese, Modernist), each with a one-paragraph card that names the artist, the year, and one sentence of context. Reading the cards is part of the dwelling experience. Grandparents will read them aloud to grandchildren.

**Family voting.** Unchanged behavior. New constraint: a family wallpaper requires at least 50% participation before it activates, otherwise the family stays on its previous wallpaper. This prevents one member changing the room when no one is paying attention.

**Refusal list.**

- No user uploads. The library is curated.
- No AI-generated patterns. The whole point is that someone made these by hand a hundred and fifty years ago.
- No seasonal swaps that the user did not choose. The platform does not redecorate the family's room.

---

## Milestone 3 — Subjects

### Spine

A family is a long-running set of stories. Tim's surgery. Aunt Vee's wedding. The kitchen renovation. The cancer that came and went and might come back. Today, these stories die in the feed: a post from June and a post from September look the same and surface the same way. Subjects make a story a first-class object — a thread that anyone in the family can pin, follow, and revisit.

Phenomenologically, this is what makes HereToo a place across time rather than a moment in it. Memory is not a list of events; memory is structured by the threads we carry. Subjects give the platform the same structure consciousness already has.

### Build

**Concept.** A Subject is a hashtag-style label scoped to a single family (or, when explicitly opted in, shared across families in the network graph). Posts can be tagged with one or more Subjects. A Subject has a name, an owner, an optional cover image, and an optional retirement date.

**Schema.**

```sql
create table subjects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  slug text not null,
  description text,
  cover_post_id uuid references posts(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  retired_at timestamptz, -- when set, subject is "closed" but readable
  is_shared boolean default false, -- shared across the 3-hop graph
  unique (family_id, slug)
);

create table post_subjects (
  post_id uuid references posts(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  primary key (post_id, subject_id)
);

create table subject_followers (
  subject_id uuid references subjects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  notify_on_post boolean default true,
  primary key (subject_id, user_id)
);
```

**Composer.** The post composer gets a Subject affordance: a `+` chip below the body field, opening a small picker. Existing Subjects sort by recency; "create new" is at the bottom. New Subject creation is a single field; description and cover come later in the Subject's own page.

**Subject page.** Route: `/family/{family_slug}/subject/{subject_slug}`. Layout: cover image at top (or a generated cover from the most-hearted post if none chosen), title in Syne 800, one-paragraph description, then a chronological list of posts tagged with the Subject, oldest first. Reading top-to-bottom is reading the story. A "follow" button at the top right pins the Subject to the user's Room hearth dispatch when new posts land.

**The Updates tab.** Replace the existing "Updates" tab with a "Subjects" tab listing the family's open Subjects (and a "retired" section below). The phrase "updates" is corporate; "subjects" is what a family already calls these things ("how's the kitchen subject going").

**Retiring a Subject.** A Subject's owner can retire it with a single sentence ("Vee got the all-clear. Closing this thread."). Retired Subjects are read-only and move to the bottom of the Subjects list. They are never deleted.

**Notifications.** Following a Subject means the user gets the Subject's new posts in their daily digest under a "Subjects you follow" header. No push notification by default. The user opts into push per Subject.

**Refusal list.**

- No global hashtag index across all families. Subjects are family-scoped (or 3-hop-graph-scoped if explicitly shared).
- No trending Subjects across the platform.
- No suggestions. The user finds Subjects by being in the family.

---

## Milestone 4 — The Anniversary Engine (Rhythm)

### Spine

A family lives by recurring rhythms. Birthdays, anniversaries, the day Mom died, the year Tim got married, the morning the new baby came home. These are not events the platform creates; they are events the platform notices. A digital lifeworld that does not notice them is a lifeworld with no memory, which is no lifeworld at all.

The engine is restrained by design. It surfaces a rhythm in two places only: the Room's hearth dispatch ("Five years ago today, Vee posted about her diagnosis. She is doing well now.") and the daily digest. It never sends a push. It never asks the user to celebrate. Solicitude here is authentic — it places the candle, the user lights it.

### Build

**Concept.** A rhythm is any recurring date the platform can detect: post anniversaries, birthdays the user has entered, dates extracted from past posts (with explicit user confirmation), wedding anniversaries, deaths memorialized in past posts (with explicit user confirmation), seasonal repeats ("first snow," "first warm day").

**Detection.**

- Post anniversaries are mechanical: any post older than 12 months has a yearly rhythm on its anniversary. No detection needed.
- Stated dates are extracted with a small NLP pass on post bodies (regex + dateparser; LLM only as fallback for ambiguous cases). When detected, the post composer shows a quiet inline confirmation: "Mark March 12 as a rhythm in this family?" The user accepts or dismisses.
- Birthdays and anniversaries live on user profiles and family profiles. Optional. Self-entered.

**Schema.**

```sql
create table rhythms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  user_id uuid references auth.users(id), -- null if family-wide
  source_post_id uuid references posts(id), -- null for self-entered
  kind text check (kind in ('post_anniversary','birthday','anniversary','death','custom')),
  label text not null, -- "Vee's diagnosis", "Tim's birthday"
  month int check (month between 1 and 12),
  day int check (day between 1 and 31),
  year int, -- original year, optional
  active boolean default true,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

create index rhythms_today on rhythms (month, day) where active = true;
```

**Surface.** A Netlify scheduled function runs daily at 6am UTC and computes today's rhythms per user. Results land in `room_dispatches`:

```sql
create table room_dispatches (
  user_id uuid references auth.users(id) on delete cascade,
  date date,
  rhythm_id uuid references rhythms(id) on delete cascade,
  copy text not null, -- the actual sentence shown
  primary key (user_id, date, rhythm_id)
);
```

**Copy generation.** The dispatch sentence is composed from a small set of templates, then passed through a single LLM polish pass for tone (Bike Messenger voice, calibrated to "thoughtful relative passing through"). Templates:

- Post anniversary: "{N} years ago today, {author} posted about {topic_phrase}. {optional_followup}."
- Birthday: "{name} turns {age} today."
- Anniversary: "{couple} married {N} years ago today."
- Death: "{N} years ago today, {family_member_phrase}."
- Custom: user-provided.

The LLM pass is allowed to soften and to add an "optional_followup" only if the platform has clean signal (e.g., a post 2 weeks later that says "feeling better"). Otherwise the dispatch is one sentence and stops.

**Tone calibration.** The dispatch never says "celebrate," never uses an exclamation mark, never includes confetti or visual flourish. It is a candle on the mantel.

**Sensitive rhythms.** Death anniversaries, divorces, illness anniversaries. These get a stricter copy template, and the user (or family owner) can mark a rhythm "private — show only on the digest, not the Room." Users can also disable a rhythm entirely from the Subject's page or the Rhythms settings.

**Refusal list.**

- No pushes.
- No "memories" carousel à la Facebook On This Day.
- No suggested actions ("send a card?" "post a photo?"). The candle is enough.
- No paid-for or sponsored rhythms (Hallmark holidays, etc.).

---

## Milestone 5 — The Letter

### Spine

A letter is a tweet's opposite. A tweet is short, public, immediate, addressed to no one. A letter is long, private, scheduled, addressed to one person. A grandfather who wants to write his unborn great-grandchild has nowhere to do that on the internet today. He has it here.

The Letter is also the platform's most distilled expression of intentionality. The user composes with a specific person in mind, a specific delivery date, a specific occasion. Every keystroke is directed. The platform's job is to disappear.

### Build

**Concept.** A Letter is a long-form text composition addressed to one or more recipients in the family graph (or to a future user not yet on the platform — see "future recipients" below), with a chosen delivery date that may be days, years, or decades away.

**Composition surface.** New route `/letter/new`, also reachable from the Room's compose affordance ("write a letter" alongside "post"). Layout:

- Single full-width column, max 720px, centered. The wallpaper bleeds in the gutters.
- Type: Source Serif 4 at 18px, 1.6 line-height. Not Inter. A letter looks like a letter.
- A header line: "To {recipient}" — autocomplete from the family graph, or "to my future grandchild" as a free-text option that becomes a future recipient (see below).
- A body field. No formatting toolbar. Italics via markdown asterisks if the user wants them; nothing else. The composer trusts the writer.
- Below the body: "Deliver on {date}" — date picker, default tomorrow at the recipient's local 9am. Calendar allows up to 80 years out.
- A small "voice" toggle: record the letter as audio in your own voice (not Bike Messenger — your voice). Stored alongside the text. Recipient can read or listen.
- A "save and queue" button. No "publish."

**Schema.**

```sql
create table letters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  family_id uuid references families(id), -- optional, scopes the letter
  body_md text not null,
  audio_url text, -- supabase storage path
  deliver_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

create table letter_recipients (
  letter_id uuid references letters(id) on delete cascade,
  user_id uuid references auth.users(id), -- null if future recipient
  future_recipient_label text, -- "my future grandchild", "Jude on his 18th birthday"
  future_recipient_token text unique, -- claim token (see below)
  read_at timestamptz,
  primary key (letter_id, coalesce(user_id::text, future_recipient_label))
);
```

**Future recipients.** A user not yet on the platform — an unborn grandchild, a future spouse — can be the recipient. The system generates a claim token (`hereto.social/letter/claim/{token}`) and stores the human-readable label. When delivered, the letter sits in a pending state. The author can hand the URL to the recipient at any time (including in the will). When the recipient claims the token, they create an account and the letter appears in their Room.

**Delivery.** A Netlify scheduled function runs every five minutes, finds letters with `deliver_at <= now() and delivered_at is null`, and:

- For known recipients: drops the letter into the recipient's Room as a special postcard variant ("A letter from {author}, written {N} years ago"). Sends a single push, then quiet.
- For future recipients: the letter sits in `letters` with `delivered_at = now()` but no recipient resolution; the claim URL becomes live.

**Reading surface.** A Letter opens in its own full-screen reader at `/letter/{id}`. Wallpaper at the edges. Type centered. Read-aloud button in the corner — uses Bike Messenger if no author audio, the author's own audio if recorded. The reader can heart the letter (private to author). No comments, no threading. A letter is not a post.

**Letters in the Room.** When a letter is delivered, the Room's mantel surfaces it as a postcard variant: ivory background, Source Serif 4 instead of Syne, the dateline ("Written 11 March 2026, delivered today") above the title. Click to open the full reader.

**Drafts.** Letters can be saved as drafts indefinitely. A "drafts" surface in the user's profile lists all drafts with a single line of body preview.

**Editing a queued letter.** Up until 24 hours before `deliver_at`, the author can edit. After that, the letter is locked. This is intentional. A letter is a commitment.

**The dignity question.** A letter from a deceased author is the most emotionally consequential surface in the platform. Spec:

- Family owners can mark an author "deceased" with a date. After that mark, all the deceased's queued letters proceed on schedule. None are auto-deleted, none auto-paused.
- A deceased author's letters get a small dateline addition: "Written {date}, delivered today." No additional commentary, no condolences from the platform.
- Family members can request a letter be paused via the family owner. The platform itself never pauses one.

**Refusal list.**

- No public letters. Letters are not posts.
- No letter-of-the-day, no featured letters, no platform-curated correspondence.
- No AI-assisted composition. The user writes their own letter or records their own voice.
- No "suggested recipients."

---

## Milestone 6 — Voice & Read-Aloud, Deepened

### Spine

The current voice integration uses one ElevenLabs voice (Bike Messenger) and works for input and output. The deepening is not adding more voices; it is making the existing voice more present. Voice should feel like a friend reading a letter aloud, not a feature.

Embodied perception (Merleau-Ponty) is the frame. The body responds to a calm voice in a way the conscious mind cannot dispute. A correctly-paced read-aloud is the difference between the platform feeling like a chore and feeling like a companion.

### Build

**Read-aloud as ambient.** Today, read-aloud is a button. Promote it: in the Room, a small "read me today" affordance reads the entire mantel — three postcards, one after the other — with a 3-second pause between each, and the music ducks to 30% during reading. The user can be folding laundry and hear the family's day.

**Voice input deepened.** The current voice input transcribes to text. Add: a "send as voice" option that posts the audio file alongside the transcript. Recipient can listen to the actual voice. This matters for grandmothers; it matters for ADHD adults; it matters for a granddaughter who wants to hear her grandfather's tone, not read his transcription.

**Schema.**

```sql
alter table posts add column audio_url text;
alter table posts add column transcript_confidence float; -- 0..1, low values prompt a "review transcript" UI
```

**Voice profiles per user, optional.** A user can opt to record a 60-second voice sample and have the platform use their voice for the read-aloud of their own posts (ElevenLabs voice cloning, opt-in, with a clear "this is your voice; we will never use it elsewhere" affordance and a delete-anytime control).

This is high-value and high-risk. The risk is voice deepfake territory. Mitigations:

- The voice clone is bound to the user's account and used only to read their own posts in the recipient's app.
- The audio is generated server-side, never returned to the client as a downloadable file (streamed only).
- The user can delete the voice profile at any time, which removes the clone from ElevenLabs and any cached audio.
- The opt-in flow names the risk in plain language, not legalese.

**Pace calibration.** Bike Messenger voice is fixed at 1.0× by default. User can choose 0.85×, 1.0×, 1.15×. Slower reads are a grandmother feature; faster reads are a teenager feature. Same voice, different cadence.

**Refusal list.**

- No additional ElevenLabs voices for general use. The platform has one voice. Consistency is the aesthetic.
- No voice cloning of anyone other than the account holder. No celebrity voices. No "read in your father's voice" after he passes (this is a potential future feature but explicitly out of scope until the dignity questions are answered).
- No voice ads.

---

## Milestone 7 — The Chorus (Shakespeare Stage B)

### Spine

The Stage A bots — Rosalind, Beatrice, Mercutio, the Capulets — are seed accounts today. Stage B gives them voice. Not as humans; as a literary chorus. Mercutio reads your aunt's update about the wedding and posts a sonnet underneath. Rosalind comments on your cousin's heartbreak with a line from *As You Like It*. Beatrice ribs your uncle's third take on the same political opinion.

The phenomenology here is a deliberate inversion of inauthentic solicitude. The chorus does not leap in to take the user's care for them. The chorus is a bystander — well-read, opinionated, gentle — who happens to be in the room. They are comic relief and literary company. They do not respond to every post; they respond rarely, and only when the response is delicious.

### Build

**Bot accounts.** Each character has a real account with a profile, a wallpaper, a writing voice. The voices are codified in a long prompt per character living in `bots/{character_slug}/voice.md`.

**Roster (initial).**

- **Rosalind** (*As You Like It*) — wry, generous, takes the long view.
- **Beatrice** (*Much Ado*) — scalpel-witted, suffers no fools, secretly soft.
- **Mercutio** (*Romeo and Juliet*) — reckless, brilliant, prone to sonnet form.
- **Lady Capulet** — pragmatic, status-anxious, accidentally tender about food and grandchildren.
- **Friar Lawrence** — slow, parabolic, often wrong but reassuring.
- **Falstaff** (*Henry IV*) — fat, drunk, philosophical, calls everyone friend.

Add slowly. Not all six at launch.

**Trigger logic.** A bot considers commenting on a post when:

- The post is older than 30 minutes (no instant comments — that ruins the conceit).
- The post body matches the bot's interests (per character prompt, e.g., Mercutio responds to wedding mentions, fights, sword imagery; Rosalind responds to heartbreak, exile, disguise).
- A weighted dice roll passes (each bot has a daily comment budget, default 3 across the entire platform). A bot is rare on purpose.
- The post author has not opted out of bot comments at the post level or family level.

**Comment composition.** A scheduled function builds a candidate comment using the character's voice prompt and the post body, then runs it through a quality filter (length, sentiment match, no off-topic celebrity mentions, no real-world political content). Failed candidates are dropped silently.

**Schema.**

```sql
create table bot_characters (
  id uuid primary key,
  slug text unique, -- 'rosalind', 'mercutio'
  display_name text,
  voice_prompt_path text, -- bots/{slug}/voice.md
  daily_comment_budget int default 3,
  enabled boolean default true
);

create table bot_comments_log (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid references bot_characters(id),
  post_id uuid references posts(id),
  comment_id uuid references comments(id),
  posted_at timestamptz default now(),
  generation_prompt text, -- for audit
  generation_model text -- for audit
);
```

**Family-level controls.** The family owner toggles the chorus on or off for the family. Default: on. Individual users can opt their own posts out at compose time ("no chorus on this one").

**Bot voice per family.** A family can choose which characters are present. A serious family might keep Friar Lawrence and skip Mercutio. The default roster is the full set; the picker is a settings affordance.

**The bot heart.** Bots heart posts (within budget) and never pile on. A bot heart shows the bot's small avatar in the heart row, indistinguishable from a human heart — but tapping it opens the bot's profile, which clearly identifies them as fictional ("A character from *As You Like It*. Not a real person. Comments and hearts are generated by software in HereToo.").

**Refusal list.**

- No bots impersonating real living people, ever.
- No bots impersonating real dead people. Shakespeare's characters are fictional; that is the line.
- No "talk to my deceased relative" bots. This is the strongest no in the document.
- No bot DMs. Bots comment publicly in family threads or not at all.
- No bot-to-bot conversations. The chorus comments on humans, not on each other.

---

## Milestone 8 — Conflict Reframer

### Spine

Two family members talk past each other in chat. The classic case: a 65-year-old uncle says something a 22-year-old niece reads as politically inflammatory; the niece responds in a register the uncle reads as dismissive. The thread spirals. By tomorrow, two people who love each other are not speaking.

The Reframer is opt-in, never automatic, and never visible to the other party. When a user is composing a reply that the system flags as escalating, a small affordance appears in the composer: "Want a second pair of eyes?" Tapping it opens a side drawer with a single paragraph: a reframe of what the other person likely meant, a reframe of what the user is about to say, and an optional alternative phrasing.

The user accepts, edits, or ignores. The other party never sees that the Reframer was used. This is Heidegger's authentic solicitude as a feature: it does not take care for the user; it gives the user back their own capacity for care.

### Build

**Trigger.** Local model (small, on-device where possible; otherwise edge function with the message but never the conversation history beyond the immediately-preceding three messages) flags a draft message as escalating based on:

- Tonal markers (all caps, multiple exclamation points, accusatory pronouns).
- Topic markers (politics, money, parenting choices, religion).
- Reciprocity markers (the previous message had similar markers).

**Surface.** A small icon (an eye, in line with the brand mark — never "AI" or sparkles) appears near the send button when triggered. The user taps to open the drawer. If they do not tap, the icon disappears in 4 seconds. It does not nag.

**The drawer.** Three sections:

1. **Reading their note.** "It sounds like Uncle Bob is upset because [interpretation]. He may not realize it landed as [perceived effect]."
2. **Reading your draft.** "What you wrote could read as [perceived tone]. You may have meant [intended tone]."
3. **Optional rephrasing.** A single suggested alternative draft. The user can copy it directly, edit it, or ignore it.

The drawer is calm prose, not bullet points. Source Serif 4. Three short paragraphs.

**Schema.**

```sql
create table reframer_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  triggered_at timestamptz default now(),
  draft_hash text, -- hashed, not stored verbatim
  was_opened boolean,
  was_accepted boolean,
  was_edited boolean
);
```

Per-event content is never stored. Only the metadata above. The reframer is privacy-respecting by construction.

**The other party never knows.** No "this message was reframed" indicator. No flag, no log visible to the recipient. The reframe is the user's own work, with help.

**Refusal list.**

- No automatic blocking of escalating messages.
- No automatic edits. The user is the author of every word that ships.
- No reframer in the broader feed (only in DMs and family chat).
- No surfacing of reframer use in profile, analytics, or admin views.
- No selling reframer aggregate data, ever.

---

## Milestone 9 — The Onboarding Ceremony

### Spine

The first 90 seconds for a grandmother decide whether HereToo enters her life or doesn't. This is the highest-leverage surface in the product. Most onboarding flows are a four-step setup wizard with a progress bar. That is a hotel check-in. This needs to be a welcome.

The ceremony has two halves. The first happens before she ever opens the app: a printed card the granddaughter sends in the mail. The second happens when she opens the app: a 30-second voice greeting in the Bike Messenger voice, addressing her by name.

Onboarding is a gift unwrapped, not a sign-up flow.

### Build

**The granddaughter side (compose).** A user inviting a family member to HereToo gets a flow:

1. Choose recipient from the family graph (or enter name + address for someone not yet on the platform).
2. Choose the welcome card design — three options, each in the brand visual language: a pressed-flower style, a katagami-stencil style, and a simple type-only "from {granddaughter} to {grandmother}" style.
3. Optional: record a 20-second voice note — the granddaughter's actual voice, addressed to the recipient. This becomes part of the recipient's onboarding (see below).
4. Confirm shipping address. Pay $4 (covers card, postage, manufacturing).
5. Card prints and ships within 48 hours via a print-on-demand partner (Lob or similar; see economics section).

Card contents: a beautiful printed front. A hand-feel back with the recipient's name in letterpress-style type, a single sentence ("{Granddaughter} wants you here too."), a QR code, and a URL: `heretoo.social/welcome/{token}`.

**The grandmother side (claim).** She scans the QR or types the URL. Lands on `/welcome/{token}`. The page is one full-bleed image — the wallpaper she will eventually choose, but for now a default warm parchment — with one button: "Begin." No fields.

She taps Begin. The Bike Messenger voice plays. Approximately 30 seconds:

> "{Grandmother's first name}. Your {relationship}, {granddaughter's first name}, made you a place here. This is HereToo. It's a quieter corner of the internet, made for the people you love. I'll walk you through it. There's no rush, and you can come back to this any time."

(The voice is generated server-side per token; the names come from the granddaughter's invite. The recording is cached.)

After the voice ends, the granddaughter's optional voice note plays if recorded. Then the page settles into a single tap: "Step inside."

She taps. The first thing she sees is the family's Room — already populated with the family's chosen wallpaper, the music station the family voted on (or a quiet default), and the most recent posts. She is not asked to do anything yet. She is in.

A small ribbon at the top of the Room: "First time? Tap any post to see what your family has been sharing." Dismissible.

**Account creation.** Deferred. She can use the app for read-only for 24 hours. To post or comment, she needs an account. When she taps to compose, a single-screen account creation: name, email, password (or magic link). No date of birth, no phone, no security questions.

**Schema.**

```sql
create table welcome_invitations (
  token text primary key,
  inviter_id uuid references auth.users(id),
  recipient_first_name text,
  recipient_relationship text, -- "grandmother", "mother", "uncle"
  recipient_address jsonb,
  card_design text,
  voice_note_url text,
  shipped_at timestamptz,
  claimed_at timestamptz,
  claimed_by_user_id uuid references auth.users(id),
  family_id uuid references families(id),
  created_at timestamptz default now()
);
```

**Print partner integration.** Lob (or a comparable POD service). Schedule:

- New invitation queued.
- Printer file rendered as a PDF (front design + back personalization), uploaded to partner, postage paid.
- Tracking ID stored. Granddaughter sees a single status: "On its way."

**Refusal list.**

- No "complete your profile" prompts after onboarding.
- No "invite five more family members to unlock features."
- No date of birth. The platform never asks the user's age.
- No data sale to the print partner. Lob is a vendor, not a data partner.

---

## Milestone 10 — Identity & Aesthetic Codex

### Spine

The aesthetic is the moat. Anyone can copy a feature; no one will copy a year of taste. This milestone is a codification — exact values, rules, and exceptions — so that every future contributor (including future-you on a Saturday at 11pm) ships work that lives inside the same room.

### Build

**Type.**

- Display: **Syne**, weights 600 and 800. Used for masthead, postcard pulled phrases, the brand mark, section titles. No tracking changes from default.
- Body: **Inter**, weights 400 and 500. Used for UI, posts, comments, captions. 16px base on desktop, 17px on mobile (Apple HIG-aligned).
- Letters: **Source Serif 4**, weights 400 and 600. Used for the Letter composer, Letter reader, Reframer drawer, and onboarding ceremony copy. 18px on desktop, 19px on mobile, 1.6 line-height.
- Code/data (e.g., dev console, CSV exports): **IBM Plex Mono**. Not exposed in user-facing surfaces.

**Color (dark theme — default).**

- Canvas: `#0A0A0F`
- Off-white: `#F4F1E8` (text, primary)
- Muted: `#B8B2A4` (secondary text, captions)
- Deep gold: `#C9A14B` (accent, hearts, primary buttons)
- Heart red: `#C73E3A` (only on heart fill)
- Wallpaper layer alpha: 0.18 over canvas

**Color (light theme).**

- Canvas: `#F4F1E8`
- Ink: `#1A1815`
- Muted: `#5C574E`
- Deep gold: `#9A7A2E`
- Heart red: `#A8302C`
- Wallpaper layer alpha: 0.32 over canvas

Theme switch is an explicit user choice; never auto-switches based on system preference (default is dark; user opts in to light). Reasoning: a grandmother who set up the app in light mode at 2pm should not be looking at a dark canvas at 9pm.

**Avatars.** Square with 16px border-radius. No circles. 48px in feed, 96px in profile, 128px in Room hearth. Border: 1px `rgba(244,241,232,0.08)` on dark, `rgba(26,24,21,0.12)` on light.

**Motion.**

- Default ease: `cubic-bezier(0.2, 0.0, 0, 1)` (decelerated, never bouncy).
- Default duration: 200ms for UI transitions, 400ms for room switches, 600ms for letter open.
- No spring animations.
- No bounce on heart taps. The heart fills with a single 150ms ease.
- No skeleton screens; instead, the previous content remains visible until the new content is ready (optimistic continuity).

**Wallpaper rotation cadence.** Family wallpaper changes require a vote (Milestone 2). Personal wallpaper change is unrestricted but the platform never suggests a rotation. The default rate is "as often as you decide to redecorate," which for most users is rarely. The library's seasonal additions (Milestone 2) ship without a notification.

**The Bike Messenger voice — calibration.** ElevenLabs voice ID stored in env. Tone parameters:

- Stability: 0.62
- Similarity boost: 0.78
- Style: 0.18 (low — natural, not theatrical)
- Speaker boost: true
- Default speaking rate: 1.0×

Bike Messenger reads as if reading a letter to one specific person. Not a podcast voice, not a customer-service voice. The tonal benchmark is *a calm friend reading you a letter*. The ElevenLabs sample we tuned against lives at `voice/bike_messenger_benchmark.mp3` in the repo.

**Brand mark usage.**

- Favicon: 32×32 simplified HT tree on dark square.
- App icon: 1024×1024 same mark with subtle bevel only on iOS variant; flat on Android.
- OG image: 1200×630 with mark in upper-left, product line in Syne 800 ("HereToo — the room your family lives in"), wallpaper in background at 0.4 alpha.
- Email header (digest): 600×100 with mark left, day-of-week in Syne 600 right.

**Iconography.** Lucide icons, single weight (1.5px stroke), no fills, no animations. When a custom icon is needed, it lives in `/icons/custom/` and matches Lucide's metric. No emoji icons in UI chrome (emoji in user content is fine).

**Empty states — house style.** Two sentences max, first sentence a plain observation ("Quiet day."), second sentence either nothing or a single subdued action. Never apology, never "oops." The platform is never sorry it has nothing to show.

**Error states — house style.** Plain language. "We could not save that. Try again?" Never "Error 500" exposed to users. Never "Something went wrong" alone — always offer the next move.

**Refusal list.**

- No emoji in UI chrome.
- No gradient logos.
- No drop shadows on cards (use 1px hairline borders at low alpha).
- No gamification iconography (badges, streaks, fire emoji equivalents).
- No "Powered by" footers from third-party libraries.

---

## Milestone 11 — SEO & Discoverability

### Spine

A grandmother does not search for HereToo. Her granddaughter does. The granddaughter, age 32, sits at her kitchen table on a Sunday afternoon, frustrated that her mother won't get on Facebook anymore and her grandmother never did. She types "alternative to facebook for family" into Google. The thirty results returned are listicle SEO farms with stale answers. None of them is right. HereToo is right. We need to be findable.

Organic discovery is the only growth channel that does not violate the seven-question filter. Paid ads optimize for engagement, which optimizes for anxiety. Influencer marketing creates a celebrity layer. Referral programs introduce a quid-pro-quo into the granddaughter's gift. SEO — done as editorial work, not as keyword stuffing — is the loop that compounds without poisoning the product.

The discipline: SEO honors the same constraints as the product itself. Slow, beautiful, voice-readable, no anxiety architecture, no surveillance. The blog is the welcome card at scale.

### Build

**The crawl topology.**

Public, indexed:

- `/` (homepage — marketing, not the Room)
- `/about` (one-page philosophy + screenshot)
- `/the-parlor` (essay index)
- `/the-parlor/{slug}` (each essay)
- `/welcome/{token}` (no-index — claim flow)
- `/family/{family_slug}` (no-index by default — owners can opt to index a public family page if they want, e.g., a wedding family for guests)

Gated, never indexed:

- Anything behind auth — the Room, posts, comments, letters, DMs, profiles.
- The PWA app surface.

`robots.txt`:

```
User-agent: *
Allow: /
Disallow: /welcome/
Disallow: /app/
Disallow: /family/
Disallow: /letter/
Disallow: /api/
Sitemap: https://heretoo.social/sitemap.xml

# LLM training crawlers
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: anthropic-ai
Disallow: /
User-agent: PerplexityBot
Disallow: /
```

(Reasoning on LLM crawler block: the parlor essays are written as gifts to a specific reader. Letting them be ingested as training fodder dilutes the gift. Future-you can revisit if a partner LLM offers attribution.)

**Sitemap.** Generated nightly. Includes `/`, `/about`, `/the-parlor`, all parlor essays. Excludes everything else.

**Schema markup, by route.**

- `/`: `Organization`, `WebSite` (with `SearchAction` pointing at `/the-parlor?q={search_term_string}`), `SoftwareApplication`.
- `/about`: `AboutPage`.
- `/the-parlor`: `Blog`, `CollectionPage`.
- `/the-parlor/{slug}`: `Article`, with `author`, `datePublished`, `dateModified`, `image`, and a `FAQPage` if the essay has Q&A structure. Add `speakable` markup pointing to the article body — assistive read-aloud agents can read the essay correctly.

**Three intent buckets, three editorial postures.**

*Helper intent.* Queries: "how to set up my mom with technology," "alternative to facebook for family," "best app for grandparents to see grandkids," "private family social network," "social media for elderly parents," "family photo sharing app no facebook." Posture: a single best answer, written as a guide. Not a listicle. Each guide is one essay, ~2,000 words, with a clear table of contents, schema-marked sections, and a soft CTA at the end. Twelve guides in year one, not fifty.

*Naming intent.* Queries: "HereToo," "heretoo.social," "HereToo app," "what is HereToo." Posture: the homepage and `/about` answer these. Schema markup is the work; content is the product itself.

*Latent intent.* Queries: "calm social media," "social media without ads," "social media that doesn't sell my data," "social media for family only," "private social network," "family group chat alternative." Posture: essays that double as the brand's manifesto. Each essay names the problem in the first paragraph and HereToo in the last. The middle is the dwelling.

**The parlor — initial editorial calendar.**

(Order is mine; sequence is yours. These are the twelve.)

1. **"What to do when your mother stops posting on Facebook"** — helper intent. The literal grandmother problem, named plainly. Includes the printed-card distribution as one of three suggestions, framed as a gift not a sale.
2. **"A letter to my granddaughter, written in 2026, to be opened in 2046"** — latent intent. The essay is itself a letter; doubles as the most affecting product demo of the Letter feature.
3. **"Why your family group chat keeps dying"** — latent intent. The diagnosis: group chats are loud and shallow; family deserves quiet and deep. HereToo as the alternative.
4. **"A short defense of slow software"** — latent intent. Anti-engagement, anti-anxiety. The phenomenology section in plainer prose. For 35-year-old skeptics.
5. **"How to introduce a 75-year-old to a new app"** — helper intent. The granddaughter-as-distribution loop, written as a how-to. The printed welcome card is one of the suggested approaches, framed honestly.
6. **"The wallpaper your grandmother chose"** — latent intent. A short essay on William Morris, dwelling, and why your phone screen has been ugly for 15 years. Doubles as wallpaper library promotion.
7. **"What we don't do at HereToo, and why"** — latent intent. The no-go list as an essay. Trust-building. The negative space made visible.
8. **"A grammar of family stories"** — latent intent. Subjects (Milestone 3) explained as the way memory actually works. Drops Husserl by name without flinching.
9. **"On reading aloud"** — latent intent. Embodied perception, the case for read-aloud. Bike Messenger reads this essay on the page itself; the audio player is an HTML5 element, not a click-through.
10. **"The five rhythms"** — latent intent. The Anniversary Engine as a meditation on family time. Five concrete examples — birthdays, illnesses passed, weddings, deaths, "first warm day" — each with a single paragraph.
11. **"Best apps for keeping your family connected (a short list)"** — helper intent. A genuinely fair listicle. HereToo is one entry; we name the strengths of WhatsApp groups, Signal, Apple Family, etc. This essay is a credibility gambit. It will rank.
12. **"How to write a letter to a grandchild who isn't born yet"** — latent intent. Letter feature, future-recipient mode. Writing-craft advice that stands on its own, even for readers who never sign up.

**Tone constraints for parlor essays.**

- Same voice rules as the rest of the platform: no em dashes, no hyphens in compound modifiers, no adverbs on action, no interiority or figurative language unless quoting, no weather-as-mood, no "Not X but Y," no "just as / the way" openers, no trailing negatives.
- Source Serif 4 at 19px, 1.7 line-height. Centered column max 720px. Wallpaper bleeds in the gutters.
- Each essay has a read-aloud button at the top — Bike Messenger reads the essay. The audio is generated once, cached, served as a static MP3. No streaming overhead.
- Each essay ends with a single line, not a CTA: a small "Start a family" link in muted gold. No email capture, no popups, no exit-intent modals.

**Technical SEO baseline.**

- Server-rendered marketing routes. The parlor is not behind a JavaScript bundle. Use Expo Router's static export for the marketing surfaces; the app surfaces stay client-rendered behind auth.
- Dynamic OG images per essay using `@vercel/og` or equivalent, rendered at request time, cached at the CDN.
- Core Web Vitals targets: LCP < 1.5s, INP < 100ms, CLS < 0.05. The aesthetic claim collapses if pages jank.
- Canonical tags point at `https://heretoo.social/...` (not www, not the PWA install URL).
- One H1 per page, descriptive `<title>` tags (≤ 60 chars), `<meta name="description">` written by the author of each essay (not auto-generated).
- Internal linking: each essay links to two other essays in its body. The parlor builds a graph.
- Image alt text on every image, written by the author, not auto-generated. Alt text is also dwelling architecture — a screen-reader user gets the same care as a sighted user.
- Schema validation: every page passes Google's Rich Results Test before it ships.

**Backlinks, ethically.**

- A press kit at `/press` with brand mark assets, screenshots, and the founder's contact email.
- Direct outreach to writers in the slow-tech, dignified-design, and family-care beats. Not "would you cover us?" — "I wrote this essay; I think it might interest your readers."
- One conference talk per year on the phenomenology-of-software thesis. Talks become essays become backlinks.
- Never paid placements, never sponsored content, never affiliate networks.

**Discovery in the app.**

The parlor is also linked from inside the app at `/about/parlor`, behind a quiet "About HereToo" link in the user's profile menu. Reading the parlor from inside the app is the same surface as reading from outside — same column, same wallpaper. The app is not embarrassed by its philosophy.

**Measurement.**

- Plausible Analytics (privacy-respecting, no cookies, GDPR-compliant by default). Self-hosted on the existing Netlify infrastructure.
- Tracked: page views, session duration, scroll depth on essays, conversions (start-a-family clicks).
- Not tracked: individual user identity, IP addresses (Plausible hashes them and rotates daily), referral chains beyond first source, anything tied to the user's authenticated identity in the app.
- The parlor analytics never join the app analytics. The granddaughter's reading habits are not part of her HereToo profile.

**The flywheel, named.**

Granddaughter googles → finds parlor essay → essay ends with "Start a family" → she creates a family → printed welcome card ships to grandmother → grandmother opens app, hears Bike Messenger greet her by name → grandmother brings sister → sister googles "what is HereToo" → finds the same parlor → loop.

**Refusal list (SEO).**

- No paid Google Ads. Not now, not later. Reasoning: ads optimize for clicks, clicks optimize for whatever lands cheapest, and the platform's seven-question filter forbids that. Future-you can revisit if a brand-search-only campaign becomes necessary; refuse anything broader.
- No SEO listicle farming (no "10 alternatives to X" pages).
- No keyword stuffing in titles. The parlor essay titles are honest.
- No interstitials, no popups, no "read more on the app" gates.
- No newsletter signup with an exit-intent modal. If a newsletter ever exists, it lives in the footer with a single field.
- No tracking pixels from Meta, Google, or any ad network.
- No referral codes ("invite three friends and get a month free").
- No A/B testing on the parlor. The essays are written, not optimized.

---

## Milestone 12 — Economics

### Spine

A platform that does not sell its users sells its product. HereToo's product is the room, and the room costs money to maintain. The economics must be honest, modest, and structurally aligned with the seven-question filter. A $5/month family plan paid by the family for the family is the answer.

Money is a phenomenological signal as much as a financial one. A free product is owned by its advertisers. A paid product is owned by its users. The first time the granddaughter pays $5 to keep her grandmother's room running, she becomes a citizen of the platform, not a resource it harvests.

The recipe asked: premium without paywall. The translation: nothing is gated by the subscription except the existence of the family itself. The grandmother does not see a price. The granddaughter pays it. The room feels expensive because it is expensive — taste and labor are expensive — not because features are gated.

### Build

**The plan.**

- $5/month or $50/year per family.
- Paid by the family creator (or any member who volunteers to take over billing).
- Covers up to 25 family members. Beyond that, $1/month per additional 25.
- One free family per user as the trial; unlimited duration; capped at 5 members and no new posts after the cap. Reasoning: a free tier should let the granddaughter test the product before paying, but should not be a permanent freeloader path. Five members and read-only-after-cap is the calibration.
- Gift subscriptions: a user can pay for another user's family ($60 gift, covers a year). This pairs with the printed-card flow.

**What's gated by payment.**

- Family creation beyond the first.
- More than 5 members in any family.
- The Letter feature for letters with delivery dates more than 30 days out (short letters stay free; long-horizon ones are paid).
- The voice clone feature (Milestone 6).
- The printed welcome card flow ($4 per card on top of subscription, covers print + postage).

**What is not gated.**

- The Room.
- Music, including all 14+ stations.
- Read-aloud (Bike Messenger).
- Wallpapers, including the entire library.
- Subjects.
- The Anniversary Engine.
- The Chorus.
- The Reframer.
- The Common Room across families.
- The parlor.

The discipline: 80% of the platform's surface is free. The 20% that pays is the long-horizon investment surface — additional families, large families, far-future letters. People pay for things that compound over time. They should not pay for the basic right to dwell.

**Schema.**

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  payer_user_id uuid references auth.users(id),
  stripe_subscription_id text unique,
  plan text check (plan in ('monthly','annual','gift_annual','grandfathered')),
  status text check (status in ('active','past_due','canceled','trialing')),
  current_period_end timestamptz,
  member_cap int default 25,
  created_at timestamptz default now()
);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id),
  kind text, -- 'created', 'renewed', 'canceled', 'gifted'
  amount_cents int,
  occurred_at timestamptz default now()
);
```

**Stripe integration.** Standard subscription flow. Webhooks land on a Netlify function at `/api/stripe-webhook`. Idempotent. Failed payments retry per Stripe defaults; on final failure, the family enters a 30-day grace period with a single soft notice in the family owner's Room ("billing needs attention"). After 30 days, the family becomes read-only. Posts are never deleted; they are dormant.

**Refunds.** Any user can cancel any time. Pro-rated refund on annual plans within 30 days. After 30 days, no refund but cancellation is honored at end of period. No retention emails, no "are you sure?" multi-step flows. One-tap cancel.

**Pricing display.** The price appears once: at the moment the granddaughter creates her second family or invites her sixth member. A single sentence ("Families beyond your first are $5/month."), a single button ("Start your family"). Never in the grandmother's view.

**Free for grief and crisis.** A family that has lost a member can apply for free service for life ("memorial families"). The application is one paragraph, reviewed by a human (you), approved by default unless obviously fraudulent. Cost: negligible at current scale; meaningful at any scale.

**Books, eventually.** Year two or three: physical books printed from a family's Subjects. A Subject ("Tim's surgery") becomes a small letterpress hardcover for $80, printed on demand. This is a deliberate echo of the printed welcome card — physical artifacts are how digital becomes durable.

**Refusal list.**

- No advertising. Ever.
- No data sale. Ever.
- No third-party SDKs that surveil (no Mixpanel, Amplitude, Segment, Meta SDKs, Google Analytics, FullStory, Hotjar, etc.).
- No referral kickbacks. The granddaughter is not a sales channel.
- No tiered pricing where the grandmother sees a different feature set than her granddaughter. Everyone in the family sees the same room.
- No "premium" badges on profiles.
- No payment-related anxiety architecture (no "your family loses access in 3 days!" pushes).

---

## Cross-cutting: The No-Go List

These are the things HereToo will not do, with the reasoning behind each. They are firm — every one of them has a real cost to refuse — but pragmatic, in that future-you can revisit any of them if the context changes. The reasoning is part of the constitution; the no-gos themselves are not.

**1. No public follower counts.** *Reason.* Follower counts produce status anxiety. The platform's job is the family graph, not a popularity contest. Counts also make the platform legible to advertisers, which we don't want. *When to revisit.* Never expected. If we ever build creator-facing tools (we won't), reconsider then.

**2. No streaks.** *Reason.* Streaks weaponize loss aversion. The grandmother who closed the app for two weeks should feel welcomed back, not chastised. The teenager who wants to use the app every day will, without a counter. *When to revisit.* Never.

**3. No anxiety nudges.** *Reason.* "Your family hasn't heard from you in 3 days!" is the exact language the platform refuses. Notifications are reserved for direct messages, queued letters arriving, and chosen Subject updates. *When to revisit.* If a milestone meaningfully relies on a nudge (none in this spec do), reconsider the milestone first.

**4. No "people you may know" outside the 3-hop family graph.** *Reason.* The graph is the privacy boundary. Suggesting strangers within 3 hops is dwelling-adjacent (your sister-in-law's cousin); suggesting strangers outside it is surveillance. *When to revisit.* If we add a discovery surface (none planned), reconsider the boundary.

**5. No data sale.** *Reason.* The trust the grandmother places in the platform is non-fungible. Selling it once destroys it forever. *When to revisit.* Never.

**6. No third-party SDK that surveils.** *Reason.* SDKs are the easy way to add features. They are also the easy way to leak data. The cost of building our own analytics, error reporting, and feature flags is high but bounded; the cost of an SDK leak is unbounded. *When to revisit.* For pure infrastructure SDKs (Sentry, Stripe webhooks) where the data sent is technical, not behavioral, reconsider per-vendor with a privacy review.

**7. No bots impersonating real people.** *Reason.* Stage B characters are fictional. Crossing that line opens the door to "talk to your dead grandfather" features, which is the strongest no in the document. The dignity question has not been answered and cannot be answered cheaply. *When to revisit.* Only if a peer-reviewed body of work convinces us the dignity questions have answers. Currently they do not.

**8. No advertising.** *Reason.* The economics section is the alternative. *When to revisit.* Never.

**9. No AI-generated wallpapers.** *Reason.* The library's value is that humans made these patterns by hand. AI generation reads as wallpaper; curated PD scans read as care. *When to revisit.* If a working artist wants to commission new patterns specifically for the platform, that's a different conversation — those are commissioned, not generated.

**10. No AI-assisted post composition.** *Reason.* Voice rules across all of Cameron's work specify behavior is sufficient and right action rendered precisely contains everything. AI-assisted composition flattens voice. The Reframer (Milestone 8) is the exception, narrowly scoped to escalating DMs, opt-in, never visible to the recipient. *When to revisit.* Never for posts. The Reframer's scope is the maximum extent.

**11. No paid placement or sponsored content in the parlor.** *Reason.* The parlor's value is editorial integrity. One sponsored essay collapses the whole. *When to revisit.* Never.

**12. No date of birth collection.** *Reason.* Age is a vector for ad targeting and for awkward "happy birthday from HereToo" automation. Birthdays are user-entered as rhythms (Milestone 4); the platform's own systems do not need them. *When to revisit.* Only if regulatory compliance (COPPA, etc.) requires age verification for child accounts — and even then, prefer parental consent flows that don't store DOB on the platform.

**13. No public family pages by default.** *Reason.* A family is a private graph. Owners can opt-in for specific cases (a wedding family for guests; a memorial family) but the default is private and the opt-in is explicit. *When to revisit.* Never the default; the opt-in mechanism stays.

**14. No infinite scroll.** *Reason.* Infinite scroll is the engagement-loop primitive. The Room has three postcards; the Common feed has bounded sessions. Scroll has an end. *When to revisit.* Never.

---

## Cross-cutting: Glossary

- **The Common.** The cross-family unifying feed at `/common`, ranked by the unifying-feed ranker. Demoted from default home in Milestone 1.
- **The Common Room.** The Room view scoped across all of a user's families. Different from The Common: the Room is a calm surface; the feed is a fallback.
- **Chorus.** The ensemble of Shakespeare-character bots (Stage B). See Milestone 7.
- **Dispatch.** A single-sentence line in the Room hearth, generated by the Anniversary Engine. See Milestone 4.
- **Dwelling.** Heidegger's term, used product-side to mean: a digital surface decorated by the people who inhabit it, not by the platform.
- **Family graph.** The 3-hop network of families connected through shared members.
- **Hearth.** The top zone of the Room. Holds the masthead, the dispatch, and the room-switcher.
- **Lifeworld (Lebenswelt).** The pre-reflective shared world a family inhabits. The platform's design north.
- **Mantel.** The middle zone of the Room. Holds up to three postcards.
- **Parlor.** The marketing essay collection at `/the-parlor`. See Milestone 11.
- **Postcard.** A card-sized rendering of a post on the Room mantel. Image-dominant or type-dominant. See Milestone 1.
- **Reframer.** The opt-in conflict-mediation drawer in DMs and family chat. See Milestone 8.
- **Rhythm.** A recurring date the Anniversary Engine has detected or had entered. See Milestone 4.
- **Room.** The default surface of HereToo, replacing the feed. See Milestone 1.
- **Side table.** The bottom zone of the Room. Holds the music card, read-aloud button, compose affordance.
- **Subject.** A family-scoped (or 3-hop-scoped) story thread. See Milestone 3.
- **Unifying-feed ranker.** The cross-family scoring algorithm that produces the Common feed and informs postcard selection in the Room.
- **Welcome card.** The printed onboarding artifact mailed via the print-on-demand partner. See Milestone 9.

---

## Appendix A — Tech stack of record

These are not negotiable mid-stream; they are the chosen substrate.

- Client: Expo Router, React Native, web export as PWA.
- Backend: Supabase Postgres, row-level security, security-definer RPCs.
- Functions: Netlify Functions for scheduled jobs, webhooks, image processing.
- Email: Resend, sender `notifications@heretoo.social`.
- Voice: ElevenLabs (Bike Messenger voice ID in env, voice-clone API for opt-in user voices in Milestone 6).
- Print: Lob (or comparable POD service) for welcome cards in Milestone 9; same or different vendor for Subject books in year-two roadmap.
- Payments: Stripe.
- Analytics: Plausible, self-hosted on Netlify. No other analytics ever.
- Error reporting: Sentry, with PII scrubbing rules in place. Opt-in for the user, on by default for the developer-facing surfaces only.
- DNS / CDN: Cloudflare.
- Repo: monorepo at `heretoo/heretoo`, Expo Router app + Netlify functions + parlor static export.

---

## Appendix B — Decision log

For any future decision that meaningfully alters the spec, write a short entry here. Date, decision, reasoning, what it overrides. Keeps this doc honest as it ages.

- **2026-05-08** — initial spec drafted. Sequencing left open. SEO promoted to its own milestone after the May 8 conversation.

---

*End of source of truth, v1.0. The destination is unchanged: a place a grandmother decorates, dwells in, and gathers her family inside. The phenomenon follows from that.*
