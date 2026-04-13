# HERETOO — FULL BUILD PLAN
## For Claude Code — React Native + Expo + Supabase
### heretoo.social | Version 1.0 MVP

---

## MISSION STATEMENT FOR THIS BUILD

HereToo is a social platform built around one inversion: the algorithm rewards
agreement across difference, not outrage within tribes. The four MVP features
are The Pulse (live opinion mapping), The Bridge (cross-generational matching),
Photo/Video upload, and a Feed powered by a bridging algorithm. Authentication
is Google/Apple social login via Supabase Auth.

---

## TECH STACK

| Layer | Technology | Reason |
|---|---|---|
| Mobile framework | React Native + Expo SDK 51 | Cross-platform iOS + Android, single codebase |
| Navigation | Expo Router (file-based) | Clean, familiar, App Store ready |
| Backend | Supabase | Auth, database, realtime, storage |
| Database | PostgreSQL via Supabase | Graph-capable with extensions |
| Realtime | Supabase Realtime | Pulse live updates |
| Media storage | Supabase Storage + Mux | Photos in Supabase, video via Mux |
| Video streaming | Mux | Transcoding, adaptive bitrate, thumbnails |
| State management | Zustand | Lightweight, no boilerplate |
| Data fetching | TanStack Query (React Query) | Caching, pagination, optimistic updates |
| Styling | NativeWind (Tailwind for RN) | Consistent design system |
| Background jobs | Supabase Edge Functions | Bridging score recalculation |
| Push notifications | Expo Notifications + APNs/FCM | Cross-platform |
| Analytics | PostHog (self-hostable) | Privacy-respecting |

---

## PROJECT STRUCTURE

```
heretoo/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   ├── welcome.tsx           # Onboarding + social login
│   │   └── profile-setup.tsx     # Age, location, interests
│   ├── (tabs)/
│   │   ├── feed/
│   │   │   ├── index.tsx         # Main bridging feed
│   │   │   └── [postId].tsx      # Single post view
│   │   ├── pulse/
│   │   │   ├── index.tsx         # Pulse home — active topics
│   │   │   └── [topicId].tsx     # Live opinion map for topic
│   │   ├── bridge/
│   │   │   ├── index.tsx         # Bridge matching home
│   │   │   └── [sessionId].tsx   # Active bridge conversation
│   │   ├── upload/
│   │   │   └── index.tsx         # Photo/video upload + post creation
│   │   └── profile/
│   │       ├── index.tsx         # Own profile
│   │       └── [userId].tsx      # Other user profile
│   └── _layout.tsx               # Root layout + auth gate
├── components/
│   ├── feed/
│   │   ├── PostCard.tsx          # Feed post with bridging score display
│   │   ├── BridgeScoreBadge.tsx  # Visual indicator of cross-cluster reach
│   │   └── FeedList.tsx          # Virtualized feed list
│   ├── pulse/
│   │   ├── OpinionSlider.tsx     # User votes their position
│   │   ├── ClusterMap.tsx        # Visual 2D opinion cluster map
│   │   └── ConsensusBar.tsx      # Shows cross-cluster agreement %
│   ├── bridge/
│   │   ├── MatchCard.tsx         # Proposed bridge match
│   │   ├── ConversationThread.tsx # Async bridge conversation
│   │   └── PromptCard.tsx        # Guided conversation prompt
│   ├── upload/
│   │   ├── MediaPicker.tsx       # Camera + library access
│   │   ├── VideoUploader.tsx     # Mux upload handler
│   │   └── PhotoUploader.tsx     # Supabase storage handler
│   ├── profile/
│   │   ├── TrustScoreRing.tsx    # Visual trust score display
│   │   ├── ClusterBadge.tsx      # User's ideological cluster (soft display)
│   │   └── OriginStory.tsx       # User's background section
│   └── shared/
│       ├── Button.tsx
│       ├── Avatar.tsx
│       ├── LoadingPulse.tsx
│       └── ErrorBoundary.tsx
├── lib/
│   ├── supabase.ts               # Supabase client init
│   ├── mux.ts                    # Mux upload client
│   ├── bridging.ts               # Bridging score calculation helpers
│   └── clusters.ts               # Cluster assignment logic
├── hooks/
│   ├── useAuth.ts                # Auth state + session
│   ├── useFeed.ts                # Paginated bridging feed
│   ├── usePulse.ts               # Realtime pulse subscription
│   ├── useBridge.ts              # Bridge matching + conversation
│   └── useUpload.ts              # Media upload state machine
├── stores/
│   ├── authStore.ts              # Zustand auth store
│   ├── feedStore.ts              # Feed state
│   └── pulseStore.ts             # Active pulse data
├── supabase/
│   ├── migrations/               # All DB migrations in order
│   │   ├── 001_auth_profiles.sql
│   │   ├── 002_posts_media.sql
│   │   ├── 003_pulse_topics.sql
│   │   ├── 004_bridge_sessions.sql
│   │   ├── 005_bridging_scores.sql
│   │   └── 006_rls_policies.sql
│   └── functions/
│       ├── recalculate-bridging-scores/  # Edge function
│       ├── match-bridge-users/           # Edge function
│       └── update-trust-scores/          # Edge function
├── assets/
│   ├── fonts/
│   └── images/
├── constants/
│   ├── colors.ts                 # Design tokens
│   ├── typography.ts
│   └── clusters.ts               # Cluster definitions
├── app.json                      # Expo config
├── eas.json                      # EAS Build config (App Store submission)
└── package.json
```

---

## DATABASE SCHEMA

### Migration 001 — Auth & Profiles

```sql
-- Extends Supabase auth.users
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  birth_year INTEGER,                    -- For generational matching, not displayed
  location_region TEXT,                  -- State/region only, not precise
  origin_story TEXT,                     -- User's background narrative
  trust_score DECIMAL DEFAULT 0.0,       -- 0.0 to 1.0, calculated by Edge Function
  cluster_id INTEGER REFERENCES clusters(id),  -- Assigned by opinion history
  cluster_confidence DECIMAL DEFAULT 0.0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,               -- Internal label only, never shown to users
  display_color TEXT NOT NULL,      -- For ClusterMap visualization
  description TEXT
);

-- Seed clusters (these are soft, multidimensional, not partisan labels)
INSERT INTO clusters (name, display_color) VALUES
  ('pragmatic_center', '#6B7280'),
  ('community_focused', '#3B82F6'),
  ('tradition_minded', '#92400E'),
  ('reform_oriented', '#10B981'),
  ('liberty_focused', '#F59E0B'),
  ('unclassified', '#D1D5DB');
```

### Migration 002 — Posts & Media

```sql
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_type TEXT CHECK (media_type IN ('none', 'photo', 'video')),
  
  -- Photos stored in Supabase Storage
  photo_urls TEXT[],                     -- Array of up to 10 photo URLs
  
  -- Video stored via Mux
  mux_asset_id TEXT,                     -- Mux asset ID
  mux_playback_id TEXT,                  -- Mux playback ID for streaming
  mux_thumbnail_url TEXT,                -- Auto-generated thumbnail
  video_duration_seconds INTEGER,
  
  -- Bridging metrics (recalculated async)
  bridging_score DECIMAL DEFAULT 0.0,   -- 0.0 to 1.0, core ranking signal
  total_engagements INTEGER DEFAULT 0,
  cluster_reach INTEGER DEFAULT 0,       -- How many distinct clusters engaged
  cross_cluster_ratio DECIMAL DEFAULT 0.0,
  
  topic_tags TEXT[],
  is_position BOOLEAN DEFAULT FALSE,     -- Is this a structured Position post
  position_claim TEXT,                   -- If is_position: the stated claim
  position_evidence_url TEXT,            -- If is_position: linked evidence
  position_steelman TEXT,                -- If is_position: opposing view
  position_common_ground TEXT,           -- If is_position: proposed agreement
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.engagements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  engagement_type TEXT CHECK (
    engagement_type IN ('agree', 'disagree', 'important', 'share', 'bridge')
  ),
  -- Note: no 'like' — engagement types are meaningful, not dopamine hits
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id, engagement_type)
);

CREATE INDEX idx_posts_bridging_score ON posts(bridging_score DESC);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_engagements_post_id ON engagements(post_id);
```

### Migration 003 — Pulse Topics

```sql
CREATE TABLE public.pulse_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE public.pulse_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES pulse_topics(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  submitted_by UUID REFERENCES profiles(id),
  agree_count INTEGER DEFAULT 0,
  disagree_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  bridging_score DECIMAL DEFAULT 0.0,    -- Cross-cluster agreement score
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pulse_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id UUID REFERENCES pulse_statements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('agree', 'disagree', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(statement_id, user_id)
);

-- Realtime enabled on this table for live Pulse updates
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_statements;
```

### Migration 004 — Bridge Sessions

```sql
CREATE TABLE public.bridge_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id UUID REFERENCES profiles(id),
  user_b_id UUID REFERENCES profiles(id),
  topic_id UUID REFERENCES pulse_topics(id),
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'completed', 'declined')
  ),
  match_score DECIMAL,                   -- How different/complementary the match is
  prompt_sequence JSONB,                 -- Array of guided prompts for this session
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bridge_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES bridge_sessions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  content TEXT,
  prompt_id TEXT,                        -- Which prompt this responds to
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE bridge_messages;
```

### Migration 005 — Bridging Score Tracking

```sql
CREATE TABLE public.bridging_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  score DECIMAL,
  cluster_breakdown JSONB,              -- Score per cluster at this moment
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trust_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score DECIMAL,
  reason TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration 006 — RLS Policies

```sql
-- Profiles: public read, own write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: public read, authenticated write
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Engagements: authenticated only
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own engagements"
  ON engagements FOR ALL USING (auth.uid() = user_id);

-- Pulse votes: authenticated only
ALTER TABLE pulse_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own votes"
  ON pulse_votes FOR ALL USING (auth.uid() = user_id);

-- Bridge: participants only
ALTER TABLE bridge_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bridge participants can view their sessions"
  ON bridge_sessions FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

ALTER TABLE bridge_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bridge participants can view messages"
  ON bridge_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bridge_sessions
      WHERE id = bridge_messages.session_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );
```

---

## THE BRIDGING ALGORITHM — EDGE FUNCTION SPEC

### File: supabase/functions/recalculate-bridging-scores/index.ts

This runs every 30 minutes via Supabase cron. It also triggers immediately
when a post reaches 10 engagements.

```typescript
/*
BRIDGING SCORE FORMULA:

bridging_score = (cluster_diversity_score * 0.6) + (cross_cluster_ratio * 0.4)

cluster_diversity_score:
  - Count distinct clusters that have engaged with this post
  - Normalize: 1 cluster = 0.0, 6 clusters = 1.0
  - Formula: (distinct_clusters - 1) / (total_clusters - 1)

cross_cluster_ratio:
  - Of all engagements, what % came from clusters OTHER than the author's cluster
  - Formula: non_author_cluster_engagements / total_engagements

Result: 0.0 = tribal (one cluster only), 1.0 = maximum bridging (all clusters)

FEED RANKING FORMULA:

final_rank = (bridging_score * 0.5) + (recency_score * 0.3) + (engagement_velocity * 0.2)

recency_score: exponential decay, half-life 6 hours
engagement_velocity: engagements per hour in last 2 hours

This means:
- A post with bridging_score 0.9 from 12 hours ago ranks above
  a post with bridging_score 0.2 from 1 hour ago
- Pure recency without bridging gets buried
- Outrage bait that only activates one cluster never reaches the top
*/

import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all posts with engagements in last 24 hours
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, author_id')
    .gte('updated_at', new Date(Date.now() - 86400000).toISOString())

  for (const post of recentPosts ?? []) {
    // Get all engagements with engager cluster info
    const { data: engagements } = await supabase
      .from('engagements')
      .select('user_id, profiles(cluster_id)')
      .eq('post_id', post.id)

    // Get author cluster
    const { data: author } = await supabase
      .from('profiles')
      .select('cluster_id')
      .eq('id', post.author_id)
      .single()

    if (!engagements || engagements.length === 0) continue

    // Calculate cluster diversity
    const clusterIds = engagements
      .map((e: any) => e.profiles?.cluster_id)
      .filter(Boolean)
    const distinctClusters = new Set(clusterIds).size
    const totalClusters = 6 // seed clusters
    const clusterDiversityScore = (distinctClusters - 1) / (totalClusters - 1)

    // Calculate cross-cluster ratio
    const authorCluster = author?.cluster_id
    const crossClusterEngagements = clusterIds
      .filter((c: number) => c !== authorCluster).length
    const crossClusterRatio = crossClusterEngagements / engagements.length

    // Final bridging score
    const bridgingScore =
      (clusterDiversityScore * 0.6) + (crossClusterRatio * 0.4)

    // Update post
    await supabase
      .from('posts')
      .update({
        bridging_score: bridgingScore,
        cluster_reach: distinctClusters,
        cross_cluster_ratio: crossClusterRatio,
        total_engagements: engagements.length
      })
      .eq('id', post.id)

    // Log history
    await supabase
      .from('bridging_score_history')
      .insert({
        post_id: post.id,
        score: bridgingScore,
        cluster_breakdown: { distinctClusters, crossClusterRatio }
      })
  }

  return new Response('Bridging scores updated', { status: 200 })
})
```

---

## BRIDGE MATCHING ALGORITHM — EDGE FUNCTION SPEC

### File: supabase/functions/match-bridge-users/index.ts

```typescript
/*
BRIDGE MATCHING FORMULA:

A good bridge match is:
1. Different cluster from the user (cross-ideological)
2. Different generation (cross-generational) — birth_year difference > 15 years
3. Similar trust score (within 0.2 of each other) — prevents bad faith actors
4. Active on same topic — both have voted on the same Pulse topic
5. Not previously matched on this topic

match_score = (cluster_distance * 0.4) + (generation_distance * 0.3) + (trust_similarity * 0.3)

cluster_distance: 0.0 = same cluster, 1.0 = maximally different
generation_distance: normalized 0–1 based on birth year gap (max useful gap = 40 years)
trust_similarity: 1.0 - abs(trust_a - trust_b) — closer trust scores = better match
*/
```

---

## VIDEO UPLOAD PIPELINE

### lib/mux.ts

```typescript
import { Video } from 'expo-av'

export async function uploadVideoToMux(
  localUri: string,
  onProgress: (progress: number) => void
): Promise<{ assetId: string; playbackId: string; thumbnailUrl: string }> {

  // 1. Request upload URL from your Supabase Edge Function
  //    (Edge Function calls Mux API with your credentials server-side)
  const { data: { uploadUrl, uploadId } } = await supabase.functions
    .invoke('create-mux-upload')

  // 2. Upload directly to Mux from device
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    localUri,
    {
      httpMethod: 'PUT',
      headers: { 'Content-Type': 'video/*' }
    },
    (progress) => {
      onProgress(progress.totalBytesSent / progress.totalBytesExpectedToSend)
    }
  )
  await uploadTask.uploadAsync()

  // 3. Poll for Mux asset ready (via Edge Function)
  const asset = await pollMuxAssetReady(uploadId)

  return {
    assetId: asset.id,
    playbackId: asset.playback_ids[0].id,
    thumbnailUrl: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`
  }
}
```

---

## KEY SCREENS — COMPONENT SPECS

### The Pulse Screen (pulse/[topicId].tsx)

```
Layout:
- Header: Topic title + active voter count (realtime)
- ClusterMap: 2D scatter plot showing opinion clusters forming in realtime
  - X axis: first principal component of vote patterns
  - Y axis: second principal component
  - Each dot = a user (anonymized), colored by cluster
  - Watch clusters form and move as votes come in
- Statement cards: Swipe to vote (agree/disagree/pass)
  - Tinder-style swipe UX — fast, addictive, effortless
  - Shows current consensus % after voting
  - ConsensusBar shows cross-cluster agreement
- Bottom: Submit a statement button
- Top bridge statements: Pinned statements with highest cross-cluster agreement
```

### The Bridge Screen (bridge/index.tsx)

```
Layout:
- Your active bridge sessions (if any)
- "Find a Bridge" button — triggers matching algorithm
- Match card when found:
  - Shows: generation gap, cluster distance, shared topic
  - Does NOT show: name, photo (until both accept)
  - Accept / Pass
- Active session view:
  - Async thread, not real-time pressure chat
  - Guided prompts appear at top: "What does your community value most?"
  - 48-hour response window (low pressure, high quality)
  - Completion earns Trust Score points for both users
```

### Feed Screen (feed/index.tsx)

```
Layout:
- Tab toggle: "For You" (personalized) / "Bridging" (highest bridge scores)
- PostCard component:
  - Media (photo grid or video player)
  - Content text
  - BridgeScoreBadge: visual bar showing cross-cluster reach
    - 1 cluster: gray "local"
    - 2-3 clusters: blue "reaching"
    - 4-5 clusters: green "bridging"
    - 6 clusters: gold "common ground" ← the viral badge everyone wants
  - Engagement buttons: Agree / Important / Disagree / Bridge
    - No generic "like" — every engagement is meaningful
  - Cluster reach display: "Heard across 4 communities"
```

---

## AUTHENTICATION FLOW

### app/(auth)/welcome.tsx

```typescript
import * as Google from 'expo-auth-session/providers/google'
import * as AppleAuthentication from 'expo-apple-authentication'

// Google OAuth via Supabase
const handleGoogleLogin = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'heretoo://auth/callback'
    }
  })
}

// Apple Sign In (required for iOS App Store)
const handleAppleLogin = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME
    ]
  })
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken!
  })
}
```

After first login → profile-setup.tsx collects:
- Display name
- Birth year (generational matching — stored, not displayed)
- Location region (state only)
- 3 topic interests (seeds initial cluster assignment)
- Origin story (optional, shown on profile)

---

## SUPABASE CONFIGURATION CHECKLIST

```
Auth:
[ ] Enable Google OAuth provider
    - Client ID from Google Cloud Console
    - Add heretoo://auth/callback to redirect URLs
[ ] Enable Apple OAuth provider
    - Service ID from Apple Developer
    - Add heretoo://auth/callback to redirect URLs
[ ] Set JWT expiry to 7 days
[ ] Enable email confirmations OFF (social login only)

Storage buckets:
[ ] Create bucket: post-photos (public read, auth write)
[ ] Create bucket: avatars (public read, auth write)
[ ] Set max file size: 10MB for photos
[ ] Enable image transformations for thumbnails

Realtime:
[ ] Enable for pulse_votes table
[ ] Enable for pulse_statements table
[ ] Enable for bridge_messages table

Edge Functions:
[ ] recalculate-bridging-scores (cron: every 30 min)
[ ] match-bridge-users (triggered: on demand)
[ ] update-trust-scores (cron: daily)
[ ] create-mux-upload (HTTP: called by client)

Database extensions:
[ ] Enable pgvector (for future semantic clustering)
[ ] Enable pg_cron (for Edge Function scheduling)
```

---

## EAS BUILD — APP STORE SUBMISSION CONFIG

### eas.json

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## APP STORE LISTING COPY

**App Name:** HereToo

**Subtitle:** Where common ground lives

**Description:**
HereToo is the social platform built for people who are tired of being divided.

Post photos and videos. Vote on what matters. Get matched with someone from a
different generation and background for a real conversation. Watch opinion maps
form in real time as your community finds its common ground.

The HereToo feed works differently. Content doesn't go viral because it made
people angry. It goes viral because people across different communities agreed
it mattered. The rarest badge on HereToo — Common Ground — means six different
communities heard what you said and nodded.

You're not alone in here.

**Keywords:** social media, community, civic, conversation, connection,
cross-generational, common ground, politics, local, deliberation

**Category:** Social Networking
**Age Rating:** 12+ (infrequent mild language)
**Content Moderation Policy:** Required before submission — draft below

---

## CONTENT MODERATION POLICY (App Store Required)

HereToo employs a three-layer moderation system:

1. Automated: AI screening on upload for CSAM, graphic violence, spam
2. Community: Flagging system with cross-cluster review panels
   (a flag requires reviewers from 2+ different clusters to act)
3. Human: Dedicated moderation queue for escalated content

Appeals process: Users may appeal any moderation decision within 30 days.
All appeals reviewed by human moderators within 72 hours.

---

## PHASED FEATURE ROADMAP

### Phase 1 — MVP (Months 1-3) — BUILD THIS FIRST
- [ ] Auth (Google + Apple)
- [ ] Profile setup + cluster assignment
- [ ] Photo upload + feed
- [ ] Video upload via Mux
- [ ] Basic bridging algorithm (v1)
- [ ] Feed with bridge score display
- [ ] Pulse — topic voting + live cluster map
- [ ] Bridge — matching + async conversation
- [ ] Push notifications
- [ ] App Store submission (iOS first)

### Phase 2 — Growth (Months 4-6)
- [ ] The Position format (structured argument posts)
- [ ] Trust Score display + leaderboard
- [ ] Bridge completion rewards
- [ ] Topic creation by users
- [ ] Commons Civic white-label API (B2B revenue)
- [ ] Android submission
- [ ] Web version (Next.js, shares Supabase backend)

### Phase 3 — Scale (Months 7-12)
- [ ] Commons+ subscription (Stripe)
- [ ] Institutional dashboard (cities, schools, nonprofits)
- [ ] Advanced bridging algorithm (v2 with pgvector semantic clustering)
- [ ] Impact advertising system
- [ ] Research data API
- [ ] The Pulse for elected officials (constituent mapping tool)

---

## ENVIRONMENT VARIABLES NEEDED

```
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=         # Edge Functions only, never client

# Mux
MUX_TOKEN_ID=                      # Server-side only
MUX_TOKEN_SECRET=                  # Server-side only

# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID=

# PostHog Analytics
EXPO_PUBLIC_POSTHOG_KEY=
```

---

## IMMEDIATE NEXT STEPS FOR CLAUDE CODE

Execute in this exact order:

1. `npx create-expo-app heretoo --template blank-typescript`
2. Install dependencies (full list below)
3. Configure Supabase project + run migrations in order
4. Build auth flow (welcome + profile setup)
5. Build upload pipeline (photo first, then video)
6. Build feed with placeholder bridging score
7. Build Pulse MVP (voting UI + realtime updates)
8. Build Bridge MVP (matching + conversation)
9. Wire bridging algorithm Edge Function
10. EAS build + TestFlight submission

### Full dependency install:

```bash
npx expo install expo-router expo-auth-session expo-apple-authentication \
  expo-image-picker expo-av expo-file-system expo-notifications \
  expo-secure-store expo-constants @supabase/supabase-js \
  @tanstack/react-query zustand nativewind react-native-reanimated \
  react-native-gesture-handler react-native-safe-area-context \
  react-native-screens @shopify/flash-list
```

---

## COST ESTIMATE — FIRST 12 MONTHS

| Item | Monthly Cost | Notes |
|---|---|---|
| Supabase Pro | $25 | 8GB database, 100GB storage |
| Mux | $0–200 | Pay per minute, free tier generous |
| Expo EAS | $29 | Build + submission pipeline |
| Apple Developer | $8 | $99/year |
| PostHog Cloud | $0 | Free up to 1M events |
| Domain (heretoo.social) | $3 | Already owned |
| **Total MVP** | **~$65–265/mo** | Scales with usage |

Breaks even at approximately 50 Commons Civic subscribers
or 500 Commons+ subscribers.

---

*Build plan version 1.0 — HereToo — heretoo.social*
*Generated April 2026 — Ready for Claude Code*
