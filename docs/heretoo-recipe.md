# HereToo — The Recipe

*A briefing for the next-level build spec. Paste this whole document into a fresh Claude conversation, then ask Claude to produce a large-scale build spec for the premium multi-generational social experience described below. The document is written so an LLM with no prior context can grasp the present state, the destination, and the philosophical frame that distinguishes HereToo from every other social product.*

---

## 1. What HereToo is today

HereToo is a family-first social platform at heretoo.social. It is built as a single codebase that ships to web, iOS, and Android via Expo Router and React Native. The web app is a progressive web app (installable on phones, runs offline-read with a service worker, gets a daily content cache update). Backend is Supabase Postgres with row-level security and security-definer RPCs. Email digests, scheduled jobs, and image processing run as Netlify functions. The whole thing is small enough that a single developer-product-owner runs it.

The product surface today consists of:

- **Family pages.** A family is a created group with a name, an owner, members, and a wallpaper (voted on collectively). Members post into the family. There is a per-family chat room for back-and-forth.
- **The Common.** A unified feed that ranks across all of a viewer's families using a cross-family engagement signal — the "unifying-feed ranker" — instead of grouping posts by source. This is the algorithmic claim that distinguishes HereToo from a typical group app: the feed isn't siloed by family; it's *bridged* by relevance.
- **Network.** A 3-hop family graph. You can see friends-of-family-of-family. Tap a person to view a profile, message them, or invite them into a family.
- **Direct messages.** One-to-one threads with an approval gate for out-of-network senders. The gate keeps strangers from ambushing grandmothers.
- **Music.** A station picker (currently fourteen curated public radio + commercial-free streams across genres). Music plays globally; the player follows the user across pages. It is the platform's unspoken background voice.
- **Read-aloud.** Any post can be read aloud in a single chosen voice (ElevenLabs "Bike Messenger"). Voice input is symmetric: any text field accepts the same voice for input.
- **Wallpapers.** Each user picks a wallpaper that paints behind the entire app. The current pattern library mixes hand-crafted SVG tiles (Damask, Mod Dots, Toile, Art Deco) and high-resolution public-domain scans of real William Morris designs (Trellis 1862, Daisy 1864, Fruit 1866, Jasmine 1872, Arcadia by May Morris). Families also vote on a family-wide wallpaper that overrides the personal choice when viewing a family page.
- **Daily digest email.** At 12pm in each user's local timezone, a Resend-sent message lands in their inbox summarizing unread family updates. Sender is `notifications@heretoo.social`. The function is timezone-aware and idempotent.
- **Moderation.** Three independent flags hide a post pending owner review.
- **Shakespeare Stage A.** Character bot accounts (Rosalind, Beatrice, the Capulets, Mercutio) appear in the seed data. The infrastructure exists to give them voices in Stage B.
- **Calendar widget.** A right-sidebar widget that embeds a Google or Apple calendar by URL and offers an `.ics` family-event invite generator.
- **Subjects & moderation pipeline.** Foundation laid for hashtag-style topical filters across families ("Tim's surgery," "Aunt Vee's wedding").

### Visual identity

- Display type: **Syne 800** for headlines and brand marks. Inter for body.
- Brand mark: a stylized HT tree on a rounded dark square — a single mark across favicon, PWA icon, share image, OG cover. Ivory and deep-gold split palette.
- Default theme: a dark, warm canvas (`#0A0A0F` background, off-white text, deep gold accents). Light theme available; theme palette swaps with a clean remount.
- Layout language: a centered narrow column flanked by wallpaper margins on desktop. A LeftSidebar (240px nav) appears at ≥1024px; a RightSidebar (320px calendar + invite) appears at ≥1280px. Below 1024px, a MobileTabBar takes over. The wallpaper bleeds through the gutters on every viewport.
- Avatars: square (squircle), not round. Gentle but not corporate.
- Hearts fill red on tap, optimistic across every feed flavor. Comments post optimistically. The interface tells the user "I heard you" before the round-trip completes.

### The bridging algorithm — the one technical claim

Most social products either silo content by group (Slack, Facebook Groups, Discord) or homogenize it into a single addictive scroll (Twitter, Instagram). HereToo does neither. Posts live in family contexts but the **unifying-feed ranker** scores them across families on a cross-family engagement signal — the more your own family network responds, the higher unrelated posts climb. This means the platform actively *bridges* loosely connected families instead of locking them into private rooms. It is the architectural answer to the loneliness problem that group apps create.

---

## 2. What HereToo seeks to be

A platform a grandmother **pressures her family into joining**.

That sentence is the entire vision. Every product decision must be evaluated against it. The grandmother pressure-test has two halves and they are equally important:

### Half one: HereToo must be something a grandmother actively wants

She must want it because of what it *does to her interior life*, not because her family is on it. (If she only joins because they did, we have built another Facebook — a network whose only gravity is sunk cost.) Grandmothers, in our model, want:

- **Slowness.** A feed that doesn't punish them for closing the app for two weeks.
- **Beauty.** A space that looks like a living room she would have decorated. Wallpaper. Warm light. Softness. Not Silicon Valley flat sterility.
- **Voice over typing.** She speaks better than she types. Read-aloud and mic input give her dignity around literacy and dexterity.
- **Real news.** The new grandchild. The diagnosis. The recital. A digest, not a feed of strangers' opinions.
- **Continuity.** Threads from last spring still findable. Birthdays, anniversaries, recurring rhythms. The app remembers in a way she does not have to.
- **Calm.** No streaks, no engagement nudges, no anxiety architecture. The opposite of TikTok's nervous system.

### Half two: the family must want it back

Her son and daughter and grandchildren must find it pleasant — not a chore. The pressure is sustainable only if the platform is also a place teenagers and 30-somethings would spend an idle five minutes for *their own* reasons:

- The cross-family bridging produces real serendipity. You see your cousin's college roommate's wedding photo because someone in your network thought it was beautiful. The graph creates surprise without compromising privacy.
- The aesthetic is downstream of taste. Younger users post here because the canvas itself is more flattering than Instagram. The wallpaper, the typography, the music behind it — every post is dressed by the room.
- The voice / read-aloud feature works for ADHD adults the same way it works for arthritic ones. Long posts get read while folding laundry.
- The Shakespeare bots, character chat, and other literary affordances make the platform a place a thoughtful person actually wants to spend time. Not a feed; a parlor.

### The phenomenon

A "phenomenon" — in the colloquial sense — is a product that exits its category and becomes part of how people describe their lives. Wordle. Polaroid. The original Facebook on a college campus in 2004. The phenomenon-test for HereToo is:

> Two grandmothers meet in a yoga class. One mentions HereToo without prompting. The other says, "I was going to ask you about that — my granddaughter set me up."

Reaching that state is partly product, partly distribution, partly cultural moment. This document is concerned with the product half: making something so distinctive that the grandmother in line one introduces it on her own terms. The product must be a **gift**, not a service. People recommend gifts.

---

## 3. The phenomenology

The vision in section 2 is not branding fluff. It rests on a specific philosophical claim about what social media has been getting wrong, and the discipline that names that claim is **phenomenology**.

Phenomenology — the school founded by Husserl, advanced by Heidegger, embodied by Merleau-Ponty — is the study of consciousness *from the first-person perspective*. It does not ask "what is real?" It asks "what is it like to live this experience?" Its core ideas are useful here as design constraints:

### Intentionality (Husserl)

Every act of consciousness is *directed at something*. You don't just think; you think *about* your daughter. You don't just feel; you feel *toward* her. Intentionality is the structure of meaning.

Most social media destroys intentionality. It fragments attention across thousands of unrelated stimuli, each demanding a micro-judgment ("like? share? scroll?"). The user's consciousness is no longer directed; it is *served*. HereToo restores intentionality by making the unit of attention a person you actually love. Every act on the platform — a heart, a comment, a digest read at noon — is directed at a specific human in a specific family context. The platform's job is to keep the directionality intact.

### Lebenswelt — the lifeworld (Husserl)

The pre-reflective shared world we inhabit before any concept lands. The kitchen at your grandparents' house. The smell of the church basement. The lifeworld is what you take for granted *because you live inside it*.

Family is the original lifeworld. HereToo's task is to digitize the *feel* of the lifeworld — the wallpaper, the music in another room, the specific rhythms of who calls whom — without flattening it into "content." The lifeworld is precisely what cannot be content. It is what content is set against.

### Dwelling (Heidegger)

In *Building Dwelling Thinking* Heidegger argues that to dwell is to *be-with* others in a place that has been built with care. Dwelling is not lodging. A hotel room does not invite dwelling; a home does. The difference is not size or comfort; it is the felt sense that *this place was made for me to be here*.

Most social platforms are hotels. The user is a transient. The platform is the same for everyone, optimized for retention, indifferent to whether you ever come back. HereToo aspires to be a dwelling — a place where the user has decorated, the family has voted on the wallpaper, the music plays the user's preferred station, the feed calls them by name. The wallpaper system, the per-user music, the per-family votes are all dwelling architecture. They are how the user finds the place "made for me to be here."

### Ready-to-hand vs. present-at-hand (Heidegger)

A hammer in your hand is *ready-to-hand* — you don't think about it, you use it, it disappears into the work. When the hammer breaks, it becomes *present-at-hand* — you suddenly see it as an object. Software UI is good when it is ready-to-hand and bad when it is present-at-hand. Every modal, every loading spinner, every "did you mean?" forces presence. HereToo's interaction model — optimistic hearts, voice input, read-aloud, persistent music — is built to keep the platform ready-to-hand. The user lives *through* it, not *at* it.

### Embodied perception (Merleau-Ponty)

The body precedes the mind. We perceive with hands and ears and the small of the back, not just eyes and frontal lobes. A scroll feels different from a tap; a soft palette is *literally* easier on the nervous system than a harsh one. Voice input bypasses the hand entirely.

This is why the aesthetic decisions in section 1 are not decoration. The Syne typeface has a specific weight and warmth a body responds to before the mind names. The Morris wallpaper is felt before it is seen. The Bike Messenger voice is chosen because it is the voice of a calm friend reading you a letter, not a corporate assistant reading you a notification. Embodied design is the design that knows the user has a body.

### Solicitude — Fürsorge (Heidegger)

Heidegger distinguishes two kinds of care for the other. *Inauthentic solicitude* leaps in and takes over — it does for the other what they could do themselves, infantilizing them. *Authentic solicitude* leaps ahead and frees the other to take their own care. Most social platforms practice inauthentic solicitude: they decide what you should see, who you should follow, what you should care about. HereToo must practice authentic solicitude: it sets the table, then steps back. Family-wallpaper voting (not a corporate-chosen palette). User-picked wallpaper (not a feed-selected ad). Voice as input (not as a chatbot's interruption). The platform's job is to free the user to care for their family in their own way, not to perform care on the user's behalf.

### The phenomenological reduction

Husserl's method is to *bracket* the metaphysical assumptions of ordinary experience and attend only to what actually appears. Applied to product design, this means: bracket the assumptions of "what social media is," and attend only to what *the user actually experiences* when using the product. We have done this. The conclusion: nothing on the market produces the experience of being-with-family in a digital lifeworld. There is a hole exactly the shape of HereToo. The build spec proceeds from that hole.

---

## 4. The recipe — what we already have, what's missing

### Already cooked
- Family architecture (members, owner, voting, posts, family chat)
- Bridging algorithm (cross-family unifying feed)
- Wallpapers (SVG patterns + real PD Morris scans, full-bleed and tiled)
- Music (14-station picker, persistent playback)
- Voice in/out (ElevenLabs Bike Messenger, single-voice consistency)
- Daily digest at noon-local-time per user (Resend, idempotent)
- Network graph (3-hop, profile-aware, message-gated)
- Moderation (3-flag auto-hide)
- PWA install + offline read
- Brand mark + favicon + OG share consistently across surfaces
- Optimistic hearts and comments across every feed flavor
- Subjects/hashtags (foundation; UI not yet built)
- Shakespeare characters as seed bots (Stage A; AI replies are Stage B)

### Still raw
- **Subject/topic threads.** A family member tags a post `#timshealth` and others can pin and follow that thread across time. This replaces the "Updates" tab; it is the mechanism for long-running family stories.
- **Mobile overflow `⋯` menu.** Surface the right-sidebar widgets (calendar, event invite) on mobile.
- **Public-domain real wallpapers beyond Morris.** Curated additions: Voysey, William De Morgan, Owen Jones's *Grammar of Ornament*, Japanese katagami stencils, Persian tilework. Each as a full-bleed image, public domain.
- **Shakespeare Stage B.** The character bots reply in voice. They become a kind of literary chorus inside the family — not replacing humans, but commenting in the margins. Mercutio reads your aunt's update and writes a sonnet back.
- **Conflict-resolution suggestions.** When two family members talk past each other in chat, an opt-in agent offers a single-paragraph reframe. Not a moderator. A *thoughtful relative who happens to be passing through*. This is solicitude as a feature.
- **Anniversary and rhythm awareness.** The platform notices recurring dates and surfaces them. "Five years ago today, Vee posted about her diagnosis. She is doing well now."
- **A "letter" mode.** Long-form writing addressed to a specific person, queued for a chosen delivery date. The opposite of a tweet. The grandfather who wants to write to his unborn great-grandchild has a place to do it.
- **An ambient room view.** The user opens the app and sees not a feed but a room — the family's wallpaper, today's two or three posts laid out like postcards on a side table, the music playing softly, the read-aloud voice ready. Then if they want a list, they scroll. The default is the *room*; the feed is the *fallback*.
- **Distribution mechanics aimed at the grandmother.** A printed welcome card the granddaughter mails to the grandmother. A QR code on the back. A 30-second voice walkthrough in Bike Messenger's voice when she opens the app for the first time. Onboarding is a *gift* unwrapped, not a sign-up flow.
- **Premium without paywall.** The platform feels expensive. No ads ever, no upsells ever, no growth-team tactics. The economics will be a small subscription paid by the family for the family ($5/month per family, perhaps), but the feeling of expense is conveyed by *taste* and *restraint*, not gating.

---

## 5. The brief for the next build spec

Take everything above as ground truth. Produce a build spec that brings HereToo from its current state to **the platform a grandmother pressures her family into joining**. The spec should:

1. **Treat the phenomenological frame as a design constraint, not a flourish.** Every feature must answer: does this preserve intentionality? Does this strengthen the lifeworld? Does this leave the user free to take their own care, or does it leap in and take over?
2. **Sequence the unbuilt features above into milestones.** Each milestone should have a single thematic spine (e.g., *the room*, *the chorus*, *the letter*).
3. **Specify the onboarding ceremony for first-time grandparents.** This is the highest-leverage surface in the product. The first 90 seconds decide whether she calls her granddaughter to thank her or never opens it again.
4. **Specify the visual and auditory identity in granular detail.** Type weights, exact palette, motion physics, the Bike Messenger voice's tone calibration, the wallpaper rotation cadence. The aesthetic is the moat.
5. **Specify the rhythm/anniversary engine.** This is what makes HereToo a *place* rather than a *feed*. It deserves an architecture, not a feature flag.
6. **Specify the economics and distribution.** A $5/month family plan. The granddaughter-printed welcome card. The QR code. The voice greeting. The lack of growth hacks.
7. **Specify what HereToo will *never* do.** The negative space matters. No public follower counts. No streaks. No anxiety nudges. No suggestions of "people you may know" outside the 3-hop family graph. No data sale, ever. No third-party SDK that surveils.

The spec should read like a manifesto crossed with an engineering plan. Long enough to be the source of truth for the next year of work. Specific enough that the developer can pick a milestone and ship it on a Saturday.

The destination is not a better social network. The destination is a place a grandmother decorates, dwells in, and gathers her family inside. The phenomenon follows from that.

---

*HereToo, May 2026.*
