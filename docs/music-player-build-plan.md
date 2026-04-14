# HERETOO MUSIC PLAYER — CONSOLIDATED BUILD PLAN
## Single reference document for Claude Code
## Covers: Native independent player + Spotify + Apple Music integration
## Design standard: High-end, production-grade, visually distinctive

---

## SECTION 1: ARCHITECTURE OVERVIEW

Three music sources. One unified player interface.
The user experience is seamless regardless of source.
The business model differs per source but the UI does not.

```
SOURCE A: HereToo Native
Artist uploaded directly. Highest royalties. Platform's competitive moat.
Audio stored in Supabase Storage. Streamed via signed URL.
Artist earns $0.01 per qualifying stream + WAMP tokens.
Artist keeps 90-95% of direct sales depending on tier.

SOURCE B: Apple Music (MusicKit)
User's existing Apple Music subscription.
Any song in Apple Music catalog playable inside HereToo.
No licensing cost to platform. User's subscription covers it.
Social posts reference Apple Music tracks.

SOURCE C: Spotify (Web Playback SDK)
User's existing Spotify Premium subscription.
Full catalog playback inside HereToo web and mobile.
No licensing cost to platform.
Mobile: Spotify Remote API controls Spotify app.
Web: Spotify Web Playback SDK streams directly.
```

All three sources render through the same player components.
A track card in the feed looks identical regardless of source.
The source indicator is subtle — a small logo badge only.

---

## SECTION 2: DEPENDENCIES

### Install all before writing player code

```bash
# Core player
npx expo install react-native-track-player
npx expo install @react-native-community/slider
npx expo install expo-image
npx expo install expo-av
npx expo install expo-document-picker

# Apple Music
npx expo install react-native-musickit
# OR use official MusicKit JS for web

# Spotify
npm install @spotify/web-api-ts-sdk
# Mobile: Spotify Remote SDK (native module)
# Web: Spotify Web Playback SDK via script tag

# Wallet (for WAMP rewards)
npx expo install @rainbow-me/rainbowkit wagmi viem

# Animation (high-end presentation)
npx expo install react-native-reanimated
npx expo install react-native-gesture-handler
npm install @motionone/react  # web only
```

### app.json additions required

```json
{
  "plugins": [
    "react-native-track-player",
    "react-native-reanimated"
  ],
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": ["audio"],
      "NSAppleMusicUsageDescription": "HereToo uses Apple Music to play songs shared in your community.",
      "NSMicrophoneUsageDescription": "HereToo uses the microphone for audio recording features."
    }
  },
  "android": {
    "permissions": ["FOREGROUND_SERVICE", "WAKE_LOCK"]
  }
}
```

### Custom dev client required
react-native-track-player is a native module.
Build and install custom dev client before any player code runs.
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

---

## SECTION 3: DESIGN LANGUAGE — HIGH-END PRESENTATION

### Aesthetic Direction
Refined dark luxury. Not generic dark mode.
Think: high-end audio equipment meets editorial music magazine.
Warm near-black backgrounds. Gold accent. Ivory text.
Subtle grain texture on surfaces. Generous negative space.
Typography that has weight and character.

### Color Tokens
```typescript
export const MusicColors = {
  // Backgrounds
  bg:           '#0A0A0C',  // Deeper than app default — music is its own world
  surface:      '#141418',
  surfaceRaise: '#1C1C22',
  surfaceLift:  '#242430',

  // Text
  primary:      '#F0EEE8',  // Warm ivory
  secondary:    '#8A8A9A',
  muted:        '#4A4A5A',

  // Accent
  gold:         '#E8C97A',  // Primary accent
  goldDim:      '#9A8550',
  goldGlow:     'rgba(232, 201, 122, 0.15)',

  // Source badges
  heretoo:      '#E8C97A',  // Gold — native = premium
  apple:        '#FC3C44',  // Apple Music red
  spotify:      '#1DB954',  // Spotify green

  // Waveform
  waveActive:   '#E8C97A',
  waveInactive: '#2A2A38',
  waveBuffer:   '#3A3A48',
}
```

### Typography
```typescript
export const MusicFonts = {
  // Track title — strong, editorial
  trackTitle: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 18,
    letterSpacing: -0.3,
    color: MusicColors.primary,
  },
  // Artist name — lighter, subordinate
  artistName: {
    fontFamily: 'Syne_400Regular',
    fontSize: 13,
    letterSpacing: 0.2,
    color: MusicColors.secondary,
  },
  // Time display — monospace feel
  timeDisplay: {
    fontFamily: 'DM_Mono',
    fontSize: 11,
    letterSpacing: 0.5,
    color: MusicColors.muted,
  },
  // Price / badge
  badge: {
    fontFamily: 'Syne_700Bold',
    fontSize: 11,
    letterSpacing: 0.1,
    color: MusicColors.gold,
  },
}
```

### Motion Principles
- Artwork scales up 1.0 → 1.02 on play (Reanimated spring)
- Progress bar thumb animates in on play, hides on pause
- Play/pause button uses spring scale 0.95 on press
- Waveform bars animate height change with stagger on track load
- Track card slides in from bottom with spring on feed render
- Full-screen player uses shared element transition from card
- Blur background behind full-screen player — artwork colors bleed through

---

## SECTION 4: DATABASE SCHEMA

Run these migrations before building any music UI.

```sql
-- Artist subscription tier
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  music_tier TEXT CHECK (music_tier IN ('none','sound','artist','pro'))
  DEFAULT 'none';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  music_subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  artist_earnings_balance DECIMAL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  stripe_connect_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  total_tracks INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  total_qualifying_streams INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  is_verified_artist BOOLEAN DEFAULT FALSE;

-- Native HereToo tracks
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  audio_storage_path TEXT NOT NULL,    -- Private Supabase Storage
  artwork_storage_path TEXT,
  artwork_url TEXT,                    -- Public URL for display

  -- Licensing
  license_type TEXT CHECK (
    license_type IN ('original','pro_registered','cover')
  ) NOT NULL DEFAULT 'original',
  isrc_code TEXT,
  pro_affiliation TEXT,
  publishing_entity TEXT,
  mechanical_license_confirmed BOOLEAN DEFAULT FALSE,
  cover_license_number TEXT,
  cover_license_expiry DATE,
  original_artist TEXT,
  original_title TEXT,

  -- Pricing
  price_usd DECIMAL,
  price_wamp INTEGER,
  is_free_stream BOOLEAN DEFAULT TRUE,
  tip_enabled BOOLEAN DEFAULT TRUE,

  -- Stats
  play_count INTEGER DEFAULT 0,
  qualifying_stream_count INTEGER DEFAULT 0,
  revenue_total_usd DECIMAL DEFAULT 0,
  revenue_total_wamp INTEGER DEFAULT 0,

  -- Bridging (same algorithm as posts)
  bridging_score DECIMAL DEFAULT 0,
  cluster_reach INTEGER DEFAULT 0,
  has_common_ground_badge BOOLEAN DEFAULT FALSE,

  -- Status
  is_published BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External track references (Spotify + Apple Music)
-- These are NOT hosted on HereToo. Just references for social posts.
CREATE TABLE IF NOT EXISTS public.external_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT CHECK (source IN ('spotify','apple_music')) NOT NULL,
  external_id TEXT NOT NULL,           -- Spotify track ID or Apple Music ID
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_name TEXT,
  artwork_url TEXT,
  duration_ms INTEGER,
  preview_url TEXT,                    -- 30-second preview (Spotify provides this)
  external_url TEXT,                   -- Link to Spotify/Apple Music page
  UNIQUE(source, external_id)
);

-- Stream plays (native tracks only)
CREATE TABLE IF NOT EXISTS public.track_plays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  listener_id UUID REFERENCES profiles(id),
  play_duration_seconds INTEGER DEFAULT 0,
  counted_as_stream BOOLEAN DEFAULT FALSE,
  usd_earned DECIMAL DEFAULT 0,
  wamp_earned INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases and tips (native tracks only)
CREATE TABLE IF NOT EXISTS public.track_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES tracks(id),
  buyer_id UUID REFERENCES profiles(id),
  artist_id UUID REFERENCES profiles(id),
  purchase_type TEXT CHECK (
    purchase_type IN ('purchase','tip')
  ) DEFAULT 'purchase',
  amount_usd DECIMAL,
  amount_wamp INTEGER,
  artist_share_usd DECIMAL,
  platform_share_usd DECIMAL,
  stripe_payment_id TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRO royalty reports
CREATE TABLE IF NOT EXISTS public.royalty_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES tracks(id),
  artist_id UUID REFERENCES profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_qualifying_streams INTEGER DEFAULT 0,
  mechanical_royalty_usd DECIMAL DEFAULT 0,
  performance_royalty_usd DECIMAL DEFAULT 0,
  pro_affiliation TEXT,
  isrc_code TEXT,
  report_status TEXT DEFAULT 'pending' CHECK (
    report_status IN ('pending','submitted','paid','error')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID REFERENCES profiles(id),
  amount_usd DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending','processing','paid','failed')
  ),
  stripe_transfer_id TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Bridge songs feature
CREATE TABLE IF NOT EXISTS public.bridge_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bridge_session_id UUID REFERENCES bridge_sessions(id),
  sender_id UUID REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  track_id UUID REFERENCES tracks(id),        -- Native track
  external_track_id UUID REFERENCES external_tracks(id),  -- OR external
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper functions
CREATE OR REPLACE FUNCTION increment_play_count(p_track_id UUID)
RETURNS VOID AS $$
  UPDATE tracks SET play_count = play_count + 1 WHERE id = p_track_id;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION increment_qualifying_stream(p_track_id UUID)
RETURNS VOID AS $$
  UPDATE tracks
  SET qualifying_stream_count = qualifying_stream_count + 1
  WHERE id = p_track_id;
  UPDATE profiles
  SET total_qualifying_streams = total_qualifying_streams + 1
  WHERE id = (SELECT artist_id FROM tracks WHERE id = p_track_id);
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION add_to_earnings(p_artist_id UUID, p_amount DECIMAL)
RETURNS VOID AS $$
  UPDATE profiles
  SET artist_earnings_balance = artist_earnings_balance + p_amount
  WHERE id = p_artist_id;
$$ LANGUAGE SQL;

-- RLS
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published tracks are public"
  ON tracks FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Artists manage own tracks"
  ON tracks FOR ALL USING (auth.uid() = artist_id);

ALTER TABLE external_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "External tracks are public"
  ON external_tracks FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can insert external tracks"
  ON external_tracks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE track_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own plays"
  ON track_plays FOR INSERT WITH CHECK (auth.uid() = listener_id);

ALTER TABLE track_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers and artists see own purchases"
  ON track_purchases FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = artist_id);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists manage own payouts"
  ON payout_requests FOR ALL USING (auth.uid() = artist_id);
```

---

## SECTION 5: UNIFIED TRACK TYPE

Single TypeScript type used everywhere regardless of source.

```typescript
// types/music.ts

export type MusicSource = 'heretoo' | 'spotify' | 'apple_music'

export interface UnifiedTrack {
  // Universal fields
  id: string                    // HereToo UUID or external ID
  source: MusicSource
  title: string
  artistName: string
  albumName?: string
  artworkUrl: string
  durationSeconds: number

  // Playback
  playbackUrl?: string          // Signed URL for native, null for external
  previewUrl?: string           // 30s preview for Spotify/Apple if no subscription
  externalUrl?: string          // Link back to Spotify/Apple

  // Native-only fields (null for external)
  artistId?: string
  priceUsd?: number
  priceWamp?: number
  isFreeStream?: boolean
  tipEnabled?: boolean
  playCount?: number
  qualifyingStreamCount?: number
  bridgingScore?: number
  hasCommonGroundBadge?: boolean
  licenseType?: 'original' | 'pro_registered' | 'cover'

  // Display
  sourceBadgeColor: string      // MusicColors.heretoo/.apple/.spotify
  sourceBadgeLabel: string      // 'HereToo' / 'Apple Music' / 'Spotify'
}
```

---

## SECTION 6: AUDIO STORE

```typescript
// stores/audioStore.ts

import TrackPlayer, { State } from 'react-native-track-player'
import { create } from 'zustand'
import { UnifiedTrack, MusicSource } from '../types/music'

interface AudioStore {
  currentTrack: UnifiedTrack | null
  source: MusicSource | null
  isPlayerReady: boolean
  isSpotifyConnected: boolean
  isAppleMusicConnected: boolean
  setPlayerReady: (ready: boolean) => void
  setSpotifyConnected: (connected: boolean) => void
  setAppleMusicConnected: (connected: boolean) => void
  playTrack: (track: UnifiedTrack) => Promise<void>
  pauseTrack: () => Promise<void>
  resumeTrack: () => Promise<void>
  seekTo: (position: number) => Promise<void>
  stopAndClear: () => Promise<void>
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  currentTrack: null,
  source: null,
  isPlayerReady: false,
  isSpotifyConnected: false,
  isAppleMusicConnected: false,

  setPlayerReady: (ready) => set({ isPlayerReady: ready }),
  setSpotifyConnected: (c) => set({ isSpotifyConnected: c }),
  setAppleMusicConnected: (c) => set({ isAppleMusicConnected: c }),

  playTrack: async (track: UnifiedTrack) => {
    const { currentTrack } = get()

    // Already playing this track
    if (currentTrack?.id === track.id) {
      await TrackPlayer.play()
      return
    }

    // Route to correct playback engine
    if (track.source === 'heretoo') {
      await playNativeTrack(track)
    } else if (track.source === 'spotify') {
      await playSpotifyTrack(track)
    } else if (track.source === 'apple_music') {
      await playAppleMusicTrack(track)
    }

    set({ currentTrack: track, source: track.source })
  },

  pauseTrack: async () => {
    const { source } = get()
    if (source === 'heretoo') await TrackPlayer.pause()
    else if (source === 'spotify') await pauseSpotify()
    else if (source === 'apple_music') await pauseAppleMusic()
  },

  resumeTrack: async () => {
    const { source } = get()
    if (source === 'heretoo') await TrackPlayer.play()
    else if (source === 'spotify') await resumeSpotify()
    else if (source === 'apple_music') await resumeAppleMusic()
  },

  seekTo: async (position: number) => {
    const { source } = get()
    if (source === 'heretoo') await TrackPlayer.seekTo(position)
    else if (source === 'spotify') await seekSpotify(position)
    else if (source === 'apple_music') await seekAppleMusic(position)
  },

  stopAndClear: async () => {
    const { source } = get()
    if (source === 'heretoo') await TrackPlayer.reset()
    else if (source === 'spotify') await pauseSpotify()
    else if (source === 'apple_music') await pauseAppleMusic()
    set({ currentTrack: null, source: null })
  },
}))

// ---- Native playback helpers ----

async function playNativeTrack(track: UnifiedTrack) {
  if (!track.playbackUrl) throw new Error('No playback URL for native track')
  await TrackPlayer.reset()
  await TrackPlayer.add({
    id: track.id,
    url: track.playbackUrl,
    title: track.title,
    artist: track.artistName,
    artwork: track.artworkUrl,
    duration: track.durationSeconds,
  })
  await TrackPlayer.play()
}

// ---- Spotify helpers (implement after Spotify SDK setup) ----
async function playSpotifyTrack(track: UnifiedTrack) {
  // Mobile: Spotify Remote SDK
  // SpotifyRemote.playURI(`spotify:track:${track.id}`, 0, 0)
  // Web: Spotify Web Playback SDK
  // player.togglePlay() or fetch /me/player/play with device_id
  console.log('Spotify play:', track.id)
}
async function pauseSpotify() { /* SpotifyRemote.pause() */ }
async function resumeSpotify() { /* SpotifyRemote.resume() */ }
async function seekSpotify(pos: number) { /* SpotifyRemote.seek(pos * 1000) */ }

// ---- Apple Music helpers (implement after MusicKit setup) ----
async function playAppleMusicTrack(track: UnifiedTrack) {
  // MusicKit.getInstance().setQueue({ song: track.id })
  // MusicKit.getInstance().play()
  console.log('Apple Music play:', track.id)
}
async function pauseAppleMusic() { /* MusicKit.getInstance().pause() */ }
async function resumeAppleMusic() { /* MusicKit.getInstance().play() */ }
async function seekAppleMusic(pos: number) {
  /* MusicKit.getInstance().seekToTime(pos) */
}
```

---

## SECTION 7: AUDIO SERVICE

```typescript
// services/audioService.ts

import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
} from 'react-native-track-player'

export async function setupPlayer(): Promise<boolean> {
  let isSetup = false
  try {
    await TrackPlayer.getCurrentTrack()
    isSetup = true
  } catch {
    await TrackPlayer.setupPlayer({ maxCacheSize: 1024 * 5 })
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      progressUpdateEventThrottle: 2,
    })
    isSetup = true
  }
  return isSetup
}

export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause())
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play())
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext())
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious())
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position))
}
```

Register in root index.ts:
```typescript
import TrackPlayer from 'react-native-track-player'
import { playbackService } from './services/audioService'
TrackPlayer.registerPlaybackService(() => playbackService)
```

---

## SECTION 8: SIGNED URL HELPER

```typescript
// Add to lib/supabase.ts

const urlCache: Record<string, { url: string; expires: number }> = {}

export const getCachedSignedUrl = async (path: string): Promise<string> => {
  const now = Date.now()
  const cached = urlCache[path]
  if (cached && cached.expires > now + 60000) return cached.url
  const { data, error } = await supabase.storage
    .from('track-audio')
    .createSignedUrl(path, 3600)
  if (error) throw error
  urlCache[path] = { url: data.signedUrl, expires: now + 3600000 }
  return data.signedUrl
}
```

---

## SECTION 9: STREAM LOGGER HOOK

```typescript
// hooks/useStreamLogger.ts

import { useEffect, useRef } from 'react'
import { useProgress } from 'react-native-track-player'
import { supabase } from '../lib/supabase'

const loggedThisSession = new Set<string>()

export const useStreamLogger = (
  trackId: string | null,
  listenerId: string | null
) => {
  const { position } = useProgress(1000)
  const logged = useRef(false)

  useEffect(() => {
    if (!trackId || !listenerId) return
    if (logged.current) return
    if (loggedThisSession.has(trackId)) return
    if (position >= 30) {
      logged.current = true
      loggedThisSession.add(trackId)
      supabase.functions.invoke('log-stream-play', {
        body: { trackId, listenerId }
      })
    }
  }, [position, trackId, listenerId])
}
```

---

## SECTION 10: WAVEFORM COMPONENT

High-end animated waveform. Consistent per track. Touch-to-seek enabled.
Uses Reanimated for smooth animation.

```typescript
// components/music/AnimatedWaveform.tsx

import React, { useEffect } from 'react'
import { View, TouchableWithoutFeedback, LayoutChangeEvent } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated'
import { MusicColors } from '../../constants/musicColors'

interface Props {
  trackId: string
  progress: number        // 0 to 1
  buffered?: number       // 0 to 1 — shows buffered region
  width: number
  height?: number
  activeColor?: string
  inactiveColor?: string
  bufferColor?: string
  onSeek?: (ratio: number) => void
  isPlaying?: boolean
}

function seededHeight(seed: string, index: number): number {
  let hash = 0
  const str = seed + String(index)
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  // Bias toward middle heights for more natural look
  const raw = (Math.abs(hash) % 100) / 100
  return 15 + (raw * 70) + (Math.sin(index * 0.3) * 8)
}

const WaveBar: React.FC<{
  height: number
  isActive: boolean
  isBuffered: boolean
  index: number
  activeColor: string
  inactiveColor: string
  bufferColor: string
  isPlaying: boolean
}> = ({ height, isActive, isBuffered, index, activeColor, inactiveColor,
        bufferColor, isPlaying }) => {
  const animHeight = useSharedValue(5)

  useEffect(() => {
    animHeight.value = withDelay(
      index * 8,
      withSpring(height, { damping: 12, stiffness: 180 })
    )
  }, [])

  // Subtle pulse animation on playing bars
  const pulseOffset = useSharedValue(0)
  useEffect(() => {
    if (isActive && isPlaying) {
      pulseOffset.value = withSpring(
        Math.random() * 6 - 3,
        { damping: 8, stiffness: 200 }
      )
    }
  }, [isPlaying, isActive])

  const animStyle = useAnimatedStyle(() => ({
    height: `${animHeight.value + (isActive && isPlaying ? pulseOffset.value : 0)}%`,
    backgroundColor: isActive ? activeColor : isBuffered ? bufferColor : inactiveColor,
  }))

  return (
    <Animated.View
      style={[{
        width: 3,
        borderRadius: 1.5,
        alignSelf: 'center',
      }, animStyle]}
    />
  )
}

export const AnimatedWaveform: React.FC<Props> = ({
  trackId,
  progress,
  buffered = 0,
  width,
  height = 48,
  activeColor = MusicColors.waveActive,
  inactiveColor = MusicColors.waveInactive,
  bufferColor = MusicColors.waveBuffer,
  onSeek,
  isPlaying = false,
}) => {
  const barCount = Math.floor(width / 5)

  const handleTouch = (e: any) => {
    if (!onSeek) return
    const ratio = e.nativeEvent.locationX / width
    onSeek(Math.max(0, Math.min(1, ratio)))
  }

  return (
    <TouchableWithoutFeedback onPress={onSeek ? handleTouch : undefined}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        height,
        width,
        gap: 2,
      }}>
        {Array.from({ length: barCount }, (_, i) => {
          const ratio = i / barCount
          return (
            <WaveBar
              key={`${trackId}-${i}`}
              height={seededHeight(trackId, i)}
              isActive={ratio <= progress}
              isBuffered={ratio <= buffered && ratio > progress}
              index={i}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              bufferColor={bufferColor}
              isPlaying={isPlaying}
            />
          )
        })}
      </View>
    </TouchableWithoutFeedback>
  )
}
```

---

## SECTION 11: TRACK CARD COMPONENT

High-end inline feed card. Works for all three sources.

```typescript
// components/music/TrackCard.tsx

import React, { useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import {
  usePlaybackState,
  useProgress,
  State
} from 'react-native-track-player'
import { useAudioStore } from '../../stores/audioStore'
import { getCachedSignedUrl } from '../../lib/supabase'
import { AnimatedWaveform } from './AnimatedWaveform'
import { useStreamLogger } from '../../hooks/useStreamLogger'
import { useAuth } from '../../hooks/useAuth'
import { UnifiedTrack, MusicSource } from '../../types/music'
import { MusicColors, MusicFonts } from '../../constants/musicColors'

interface Props {
  track: UnifiedTrack
  onOpenDetail?: (track: UnifiedTrack) => void
}

const SOURCE_LABELS: Record<MusicSource, string> = {
  heretoo: 'HereToo',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
}

export const TrackCard: React.FC<Props> = ({ track, onOpenDetail }) => {
  const { currentTrack, playTrack, pauseTrack, resumeTrack } = useAudioStore()
  const playbackState = usePlaybackState()
  const { position, duration, buffered } = useProgress(500)
  const { user } = useAuth()

  const isCurrentTrack = currentTrack?.id === track.id
  const isPlaying = isCurrentTrack && playbackState.state === State.Playing
  const progress = isCurrentTrack && duration > 0 ? position / duration : 0
  const bufferRatio = isCurrentTrack && duration > 0 ? buffered / duration : 0

  // Native stream logging
  useStreamLogger(
    isCurrentTrack && track.source === 'heretoo' ? track.id : null,
    user?.id ?? null
  )

  // Play button press animation
  const btnScale = useSharedValue(1)
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }]
  }))

  // Artwork glow animation on play
  const artworkScale = useSharedValue(1)
  const artworkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artworkScale.value }],
  }))

  React.useEffect(() => {
    artworkScale.value = withSpring(isPlaying ? 1.03 : 1, {
      damping: 15,
      stiffness: 200,
    })
  }, [isPlaying])

  const handlePlayPause = useCallback(async () => {
    btnScale.value = withSpring(0.92, { damping: 10 }, () => {
      btnScale.value = withSpring(1)
    })

    if (isPlaying) {
      await pauseTrack()
      return
    }
    if (isCurrentTrack) {
      await resumeTrack()
      return
    }

    let trackWithUrl = { ...track }
    if (track.source === 'heretoo' && track.playbackUrl === undefined) {
      const url = await getCachedSignedUrl(
        (track as any).audioStoragePath
      )
      trackWithUrl = { ...track, playbackUrl: url }
    }
    await playTrack(trackWithUrl)
  }, [isPlaying, isCurrentTrack, track])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      {/* Top row: artwork + info + play button */}
      <View style={styles.topRow}>
        {/* Artwork with glow on play */}
        <TouchableOpacity onPress={() => onOpenDetail?.(track)}>
          <View style={styles.artworkContainer}>
            {isPlaying && (
              <View style={[
                styles.artworkGlow,
                { backgroundColor: track.sourceBadgeColor }
              ]} />
            )}
            <Animated.View style={artworkStyle}>
              <Image
                source={{ uri: track.artworkUrl }}
                style={styles.artwork}
              />
            </Animated.View>
            {/* Source badge */}
            <View style={[
              styles.sourceBadge,
              { backgroundColor: track.sourceBadgeColor }
            ]}>
              <Text style={styles.sourceBadgeText}>
                {SOURCE_LABELS[track.source][0]}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Track info */}
        <TouchableOpacity
          style={styles.infoContainer}
          onPress={() => onOpenDetail?.(track)}
        >
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artistName}
          </Text>
          <View style={styles.badgeRow}>
            {track.hasCommonGroundBadge && (
              <View style={styles.commonGroundBadge}>
                <Text style={styles.commonGroundText}>✦ Common Ground</Text>
              </View>
            )}
            {track.priceUsd && track.source === 'heretoo' && (
              <Text style={styles.price}>
                ${track.priceUsd.toFixed(2)}
              </Text>
            )}
            {track.source !== 'heretoo' && (
              <Text style={[styles.sourceLabel,
                { color: track.sourceBadgeColor }]}>
                {SOURCE_LABELS[track.source]}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Play / pause button */}
        <Animated.View style={btnStyle}>
          <TouchableOpacity
            onPress={handlePlayPause}
            style={[styles.playButton, isPlaying && styles.playButtonActive]}
          >
            <Text style={[
              styles.playIcon,
              isPlaying && { color: MusicColors.bg }
            ]}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Waveform — only shown for native tracks or when playing */}
      {(track.source === 'heretoo' || isCurrentTrack) && (
        <View style={styles.waveformContainer}>
          <AnimatedWaveform
            trackId={track.id}
            progress={progress}
            buffered={bufferRatio}
            width={320}
            height={44}
            isPlaying={isPlaying}
          />
        </View>
      )}

      {/* Time display — only when this track is current */}
      {isCurrentTrack && (
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>
            {formatTime(duration || track.durationSeconds)}
          </Text>
        </View>
      )}

      {/* Divider line — subtle */}
      <View style={styles.divider} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: MusicColors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artworkContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  artworkGlow: {
    position: 'absolute',
    inset: -4,
    borderRadius: 10,
    opacity: 0.2,
    filter: 'blur(8px)',  // web only, ignore on native
  },
  artwork: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  sourceBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: MusicColors.surface,
  },
  sourceBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000',
  },
  infoContainer: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...MusicFonts.trackTitle,
    fontSize: 15,
  },
  artist: {
    ...MusicFonts.artistName,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  commonGroundBadge: {
    backgroundColor: 'rgba(232, 201, 122, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(232, 201, 122, 0.3)',
  },
  commonGroundText: {
    ...MusicFonts.badge,
    fontSize: 9,
  },
  price: {
    ...MusicFonts.badge,
  },
  sourceLabel: {
    fontSize: 10,
    fontFamily: 'Syne_600SemiBold',
    letterSpacing: 0.1,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MusicColors.surfaceLift,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 201, 122, 0.2)',
  },
  playButtonActive: {
    backgroundColor: MusicColors.gold,
    borderColor: MusicColors.gold,
  },
  playIcon: {
    fontSize: 16,
    color: MusicColors.gold,
  },
  waveformContainer: {
    paddingHorizontal: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  time: {
    ...MusicFonts.timeDisplay,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 2,
  },
})
```

---

## SECTION 12: FULL SCREEN PLAYER

```typescript
// components/music/FullScreenPlayer.tsx
// Presented as a modal sheet from any TrackCard

// Design: Full blurred artwork background
// Large centered artwork with shadow
// Animated waveform
// Scrubber with thumb indicator
// Play/pause, skip 15s back/forward
// Source-specific connect prompt if no subscription
// Purchase/tip for native tracks

// Key implementation notes:

// 1. Background: BlurView over stretched artwork
//    import { BlurView } from 'expo-blur'
//    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

// 2. Artwork shadow treatment:
//    shadowColor: track.sourceBadgeColor
//    shadowOffset: { width: 0, height: 20 }
//    shadowOpacity: 0.4
//    shadowRadius: 40
//    elevation: 20

// 3. Progress scrubber:
//    import Slider from '@react-native-community/slider'
//    minimumTrackTintColor: MusicColors.gold
//    maximumTrackTintColor: MusicColors.waveInactive
//    thumbTintColor: MusicColors.gold

// 4. Skip controls:
const skipBack = async () => {
  const { position } = await TrackPlayer.getProgress()
  await TrackPlayer.seekTo(Math.max(0, position - 15))
}
const skipForward = async () => {
  const { position, duration } = await TrackPlayer.getProgress()
  await TrackPlayer.seekTo(Math.min(duration, position + 15))
}

// 5. Source-specific subscription prompt:
//    If source = spotify and !isSpotifyConnected:
//      Show "Connect Spotify to play full tracks"
//      Play 30-second preview from previewUrl while disconnected
//    If source = apple_music and !isAppleMusicConnected:
//      Show "Connect Apple Music to play full tracks"
//      Show 30-second preview option

// 6. Native track actions (source === 'heretoo' only):
//    Purchase button (if priceUsd set)
//    Tip button (if tipEnabled)
//    Share to feed button

// 7. Artist earnings display (if viewer === artist):
//    Stream count for this track
//    WAMP earned today
//    Total USD earned
```

---

## SECTION 13: SPOTIFY INTEGRATION

### Registration (one-time setup)
1. Go to developer.spotify.com/dashboard
2. Create app — redirect URI: heretoo://spotify-auth
3. Save Client ID and Client Secret
4. For mobile: request Spotify Remote SDK access (separate approval)

### Web Playback SDK (heretoo.social web app)
```html
<!-- Add to web app index.html -->
<script src="https://sdk.scdn.co/spotify-player.js"></script>
```

```javascript
// lib/spotify.ts (web)
let spotifyPlayer: Spotify.Player | null = null

export const initSpotifyPlayer = (accessToken: string) => {
  spotifyPlayer = new Spotify.Player({
    name: 'HereToo',
    getOAuthToken: (cb) => cb(accessToken),
    volume: 0.8,
  })
  spotifyPlayer.connect()
}

export const playSpotifyTrackWeb = async (
  trackId: string,
  deviceId: string,
  accessToken: string
) => {
  await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
      }),
    }
  )
}
```

### Mobile (Spotify Remote SDK)
```typescript
// lib/spotifyMobile.ts
// Requires Spotify app installed on device
// User authenticates via Spotify app
// Controls Spotify app remotely

// SpotifyRemote.connect(accessToken)
// SpotifyRemote.playURI(`spotify:track:${trackId}`, 0, 0)
// SpotifyRemote.pause()
// SpotifyRemote.resume()
// SpotifyRemote.seek(positionMs)
```

### Searching Spotify catalog
```typescript
export const searchSpotify = async (
  query: string,
  accessToken: string
): Promise<UnifiedTrack[]> => {
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return data.tracks.items.map((item: any): UnifiedTrack => ({
    id: item.id,
    source: 'spotify',
    title: item.name,
    artistName: item.artists.map((a: any) => a.name).join(', '),
    albumName: item.album.name,
    artworkUrl: item.album.images[0]?.url ?? '',
    durationSeconds: Math.round(item.duration_ms / 1000),
    previewUrl: item.preview_url,
    externalUrl: item.external_urls.spotify,
    sourceBadgeColor: '#1DB954',
    sourceBadgeLabel: 'Spotify',
  }))
}
```

---

## SECTION 14: APPLE MUSIC INTEGRATION

### Registration (one-time setup)
1. developer.apple.com → Certificates, Identifiers & Profiles
2. Create Media Identifier
3. Generate MusicKit private key
4. Save Key ID and Team ID

### MusicKit setup
```typescript
// lib/appleMusic.ts

export const initAppleMusic = async () => {
  await MusicKit.configure({
    developerToken: process.env.EXPO_PUBLIC_APPLE_MUSIC_TOKEN,
    app: {
      name: 'HereToo',
      build: '1.0',
    },
  })
}

export const requestAppleMusicAuth = async (): Promise<boolean> => {
  const status = await MusicKit.getInstance().authorize()
  return status === 'authorized'
}

export const playAppleMusicTrackNative = async (trackId: string) => {
  const music = MusicKit.getInstance()
  await music.setQueue({ song: trackId })
  await music.play()
}

export const searchAppleMusic = async (
  query: string,
  developerToken: string
): Promise<UnifiedTrack[]> => {
  const res = await fetch(
    `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(query)}&types=songs&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${developerToken}`,
      },
    }
  )
  const data = await res.json()
  return (data.results?.songs?.data ?? []).map((item: any): UnifiedTrack => ({
    id: item.id,
    source: 'apple_music',
    title: item.attributes.name,
    artistName: item.attributes.artistName,
    albumName: item.attributes.albumName,
    artworkUrl: item.attributes.artwork.url
      .replace('{w}', '600').replace('{h}', '600'),
    durationSeconds: Math.round(item.attributes.durationInMillis / 1000),
    externalUrl: item.attributes.url,
    sourceBadgeColor: '#FC3C44',
    sourceBadgeLabel: 'Apple Music',
  }))
}
```

---

## SECTION 15: MUSIC SEARCH SCREEN

Single search bar returns results from all three sources simultaneously.

```typescript
// app/(tabs)/music/search.tsx

// On search query:
// 1. Search HereToo native tracks in Supabase
// 2. Search Spotify catalog (if connected)
// 3. Search Apple Music catalog (if connected)
// 4. Merge results with source label
// 5. Display unified list of TrackCards

// Result ordering:
// HereToo native tracks first (platform priority)
// Then Spotify results
// Then Apple Music results
// Deduplication: if same song appears in multiple sources,
// prefer HereToo native, then Spotify, then Apple Music

// UI:
// Search bar at top with magnifying glass icon
// "On HereToo" section header (gold)
// "On Spotify" section header (green) — only if connected
// "On Apple Music" section header (red) — only if connected
// Each result is a compact TrackCard
// Tapping plays immediately
// Long press opens full detail
```

---

## SECTION 16: EDGE FUNCTIONS

### log-stream-play
```typescript
// supabase/functions/log-stream-play/index.ts

import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { trackId, listenerId } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // One qualifying stream per track per listener per day
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('track_plays')
    .select('id')
    .eq('track_id', trackId)
    .eq('listener_id', listenerId)
    .eq('counted_as_stream', true)
    .gte('created_at', today)
    .maybeSingle()

  if (existing) return new Response('Already counted', { status: 200 })

  await supabase.from('track_plays').insert({
    track_id: trackId,
    listener_id: listenerId,
    counted_as_stream: true,
    processed: false,
  })

  await supabase.rpc('increment_play_count', { p_track_id: trackId })
  await supabase.rpc('increment_qualifying_stream', { p_track_id: trackId })

  return new Response('OK', { status: 200 })
})
```

### process-stream-royalties (daily cron)
```typescript
// supabase/functions/process-stream-royalties/index.ts

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: unprocessed } = await supabase
    .from('track_plays')
    .select('id, track_id, tracks(artist_id, license_type)')
    .eq('counted_as_stream', true)
    .eq('processed', false)
    .limit(1000)

  const STREAM_RATE = 0.01
  const WAMP_PER_STREAM = 10

  for (const play of unprocessed ?? []) {
    const artistId = (play.tracks as any)?.artist_id
    if (!artistId) continue

    await supabase.rpc('add_to_earnings', {
      p_artist_id: artistId,
      p_amount: STREAM_RATE
    })

    await supabase
      .from('track_plays')
      .update({
        processed: true,
        usd_earned: STREAM_RATE,
        wamp_earned: WAMP_PER_STREAM,
      })
      .eq('id', play.id)

    // WAMP distribution via Polygon tx
    // Implement: send WAMP_PER_STREAM from rewards pool to artist wallet
  }

  return new Response(`Processed ${unprocessed?.length ?? 0}`, { status: 200 })
})
```

### create-track-payment
```typescript
// supabase/functions/create-track-payment/index.ts

import Stripe from 'stripe'

Deno.serve(async (req) => {
  const { trackId, amountUsd, purchaseType } = await req.json()
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: track } = await supabase
    .from('tracks')
    .select('artist_id, profiles(stripe_connect_id, music_tier)')
    .eq('id', trackId)
    .single()

  const cuts: Record<string, number> = {
    sound: 0.90, artist: 0.92, pro: 0.95
  }
  const tier = (track as any).profiles?.music_tier ?? 'sound'
  const artistCut = purchaseType === 'tip' ? 0.95 : (cuts[tier] ?? 0.90)
  const artistAmount = Math.floor(amountUsd * artistCut * 100)

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amountUsd * 100),
    currency: 'usd',
    transfer_data: {
      destination: (track as any).profiles?.stripe_connect_id,
      amount: artistAmount,
    },
  })

  return new Response(
    JSON.stringify({ clientSecret: intent.client_secret }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## SECTION 17: MUSIC UPLOAD FLOW

```typescript
// app/(tabs)/music/upload.tsx

// Multi-step form. Clean. No clutter.
// Each step occupies full screen with forward/back navigation.

// Step 1: Audio file
//   expo-document-picker for audio (MP3, WAV, FLAC, AAC)
//   Show filename, duration detected automatically
//   File size limit: 50MB

// Step 2: Artwork + details
//   Artwork: expo-image-picker (min 1400x1400)
//   Track title (required)
//   Optional description

// Step 3: License declaration
//   "Who owns this music?" — three large tap targets
//   A) I wrote and recorded this entirely myself
//   B) This is registered with a PRO (ASCAP, BMI, SESAC)
//      → ISRC code field (validated format: CC-XXX-YY-NNNNN)
//      → PRO dropdown
//      → Publishing entity name
//   C) This is a cover of another artist's song
//      → Original title and artist name
//      → "I have a mechanical license" with license number field
//      → OR: "Purchase license" button → Easy Song Licensing

// Step 4: Pricing
//   Toggle: Free to stream (default ON)
//   If paid: USD price field, WAMP price field (both optional)
//   Toggle: Accept tips (default ON)
//   Earnings preview: "You keep [tier cut]% of every sale"

// Step 5: Upload
//   Progress bar during upload to Supabase Storage
//   On complete: navigate to track detail
//   Issue 3 WAMP invite tokens to artist after publish

// Visual design:
//   Step indicator at top (dots, not numbers)
//   Large tap targets for license selection
//   Earnings preview in gold text
//   Upload progress with animated waveform bars
```

---

## SECTION 18: ARTIST EARNINGS DASHBOARD

```typescript
// components/music/EarningsDashboard.tsx

// Display in real time. No thresholds. Every number live.

// Layout:
// ─────────────────────────────
// THIS MONTH
// Streams          847
// Stream earnings  $8.47
// WAMP earned      8,470
// Sales            $143.20
// Your cut (92%)   $131.74
// ─────────────────────────────
// ALL TIME
// Total streams    12,440
// Total earned     $892.00
// WAMP total       124,400
// PRO pending      $34.20 (Q1)
// ─────────────────────────────
// BALANCE: $24.61
// [Request Payout] — active when balance >= $10
// ─────────────────────────────
// Recent payouts (list with Stripe transfer IDs)
// ─────────────────────────────
// WAMP wallet
// Balance: [amount]
// Invite tokens: [count]
// [View on Polygonscan]
```

---

## SECTION 19: SUBSCRIPTION TIERS

```typescript
// Enforce in middleware on music feature routes

export const MUSIC_TIERS = {
  sound: {
    price: 9.99,
    trackLimit: 10,
    artistCut: 0.90,
    wampPerStream: 10,
    label: 'Sound',
  },
  artist: {
    price: 19.99,
    trackLimit: Infinity,
    artistCut: 0.92,
    wampPerStream: 10,
    proReporting: true,
    collaboratorSplits: 3,
    label: 'Artist',
  },
  pro: {
    price: 39.99,
    trackLimit: Infinity,
    artistCut: 0.95,
    wampPerStream: 15,
    proReporting: true,
    collaboratorSplits: 5,
    coverLicensing: true,
    syncInquiry: true,
    verifiedBadge: true,
    label: 'Pro',
  },
}

// Musician invite tokens per published track: 3 WAMP
// Issued from institutional distribution reserve
```

---

## SECTION 20: ENVIRONMENT VARIABLES

```bash
# Apple Music
EXPO_PUBLIC_APPLE_MUSIC_KEY_ID=
EXPO_PUBLIC_APPLE_MUSIC_TEAM_ID=
APPLE_MUSIC_PRIVATE_KEY=              # Server-side only (for token signing)

# Spotify
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=                # Server-side only

# Stripe
STRIPE_SECRET_KEY=                    # Server-side only
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Music licensing
EASY_SONG_LICENSING_API_KEY=
SONGTRUST_API_KEY=

# Token (replace WAMP with final symbol)
EXPO_PUBLIC_WAMP_CONTRACT=
PLATFORM_WALLET_ADDRESS=
REWARDS_POOL_WALLET_PRIVATE_KEY=      # Server-side only
```

---

## SECTION 21: IMPLEMENTATION ORDER

Execute in strict dependency order.
Confirm each item works before moving to the next.

```
PREREQUISITES
[ ] 1.  Run all database migrations from Section 4
[ ] 2.  Create Supabase Storage buckets:
        track-audio (private) and track-artwork (public)
[ ] 3.  Upload Coyote Land test track to track-audio bucket
[ ] 4.  Insert Coyote Land track record in tracks table
[ ] 5.  Configure app.json (Section 2)
[ ] 6.  Build and install custom Expo dev client on physical device
[ ] 7.  Register Spotify Developer app
[ ] 8.  Register Apple MusicKit app identifier and key

NATIVE PLAYER
[ ] 9.  Install all dependencies (Section 2)
[ ] 10. Create services/audioService.ts — register in root index.ts
[ ] 11. Create types/music.ts — UnifiedTrack type
[ ] 12. Create constants/musicColors.ts — MusicColors and MusicFonts
[ ] 13. Create stores/audioStore.ts
[ ] 14. Add getCachedSignedUrl to lib/supabase.ts
[ ] 15. Create hooks/useStreamLogger.ts
[ ] 16. Create components/music/AnimatedWaveform.tsx
[ ] 17. Create components/music/TrackCard.tsx
[ ] 18. Add Coyote Land TrackCard to feed
[ ] 19. *** TEST: play, pause, lock screen controls on real device ***
        DO NOT PROCEED UNTIL LOCK SCREEN CONFIRMED WORKING
[ ] 20. Create components/music/FullScreenPlayer.tsx
[ ] 21. Wire touch-to-seek on AnimatedWaveform
[ ] 22. Confirm stream logging fires after 30 seconds
        Check track_plays table in Supabase dashboard

EDGE FUNCTIONS
[ ] 23. Deploy log-stream-play Edge Function
[ ] 24. Deploy process-stream-royalties Edge Function (daily cron)
[ ] 25. Deploy create-track-payment Edge Function
[ ] 26. Configure Stripe Connect for artist payouts

SPOTIFY INTEGRATION
[ ] 27. Implement Spotify OAuth flow
[ ] 28. Web: Spotify Web Playback SDK initialized
[ ] 29. Mobile: Spotify Remote SDK connected
[ ] 30. searchSpotify function working
[ ] 31. playSpotifyTrack wired into audioStore
[ ] 32. Spotify TrackCard renders in feed

APPLE MUSIC INTEGRATION
[ ] 33. Generate MusicKit developer token (server-side signed JWT)
[ ] 34. Implement Apple Music authorization flow
[ ] 35. searchAppleMusic function working
[ ] 36. playAppleMusicTrack wired into audioStore
[ ] 37. Apple Music TrackCard renders in feed

MUSIC SCREENS
[ ] 38. Music search screen — all three sources
[ ] 39. Music upload flow — all licensing paths
[ ] 40. Artist earnings dashboard
[ ] 41. Subscription tier gate on upload

LEGAL (before music goes live to users)
[ ] 42. DMCA agent registered — dmca.copyright.gov — $6
[ ] 43. Blanket mechanical license — Harry Fox Agency
[ ] 44. Music licensing attorney consultation
[ ] 45. Terms of Service updated for music
[ ] 46. Easy Song Licensing API integrated
[ ] 47. Songtrust API integrated for PRO reporting
```

---

## SECTION 22: LEGAL CHECKLIST

Non-negotiable before music feature goes live.

```
[ ] DMCA agent registered with US Copyright Office
    $6 fee. Required for Section 512 safe harbor.
    Register at: dmca.copyright.gov

[ ] Blanket mechanical license obtained
    Harry Fox Agency or Music Reports Inc.
    Required before PRO registered tracks can stream.
    US statutory rate ~15.1% of streaming revenue.
    HereToo pays 2x this minimum.

[ ] Terms of Service updated to include:
    Artist warranty of ownership/license for all uploads
    Platform right to remove infringing content
    Artist indemnification for licensing violations
    Clear statement of all three royalty tier structures

[ ] Easy Song Licensing API integrated
    Required before cover uploads go live.
    Cover upload flow blocked until this is complete.

[ ] Songtrust API or equivalent
    Required before PRO registered tracks can stream.
    Handles automated quarterly PRO submission.

[ ] Stripe Connect configured
    Required before any artist payout.
    Artists prompted to connect on first upload.

[ ] Music licensing attorney consultation
    Before music feature is live to any user.
    Estimated cost: $500 to $1,500 one-time.
    Not optional.
```

---

*HereToo Music Player — Consolidated Build Plan v1.0*
*Test track: Coyote Land*
*Token placeholder: WAMP — replace with final symbol when decided*
*Three sources: HereToo native + Spotify + Apple Music*
*heretoo.social — Be real.*
