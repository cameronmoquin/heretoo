import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { getMuxStreamUrl, getMuxThumbnailUrl } from '../../lib/mux';

interface VideoPlayerProps {
  playbackId: string;
  thumbnailUrl?: string;
}

/**
 * Video player that shows a thumbnail and plays on tap.
 * Uses native video on mobile, HTML5 video on web.
 */
export function VideoPlayer({ playbackId, thumbnailUrl }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const streamUrl = getMuxStreamUrl(playbackId);
  const thumb = thumbnailUrl ?? getMuxThumbnailUrl(playbackId);

  if (playing && Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* @ts-ignore — HTML video element for web */}
        <video
          src={streamUrl}
          controls
          autoPlay
          style={{ width: '100%', height: 300, borderRadius: 12, backgroundColor: '#000' }}
        />
      </View>
    );
  }

  if (playing && Platform.OS !== 'web') {
    // On native, use expo-video
    const { useVideoPlayer, VideoView } = require('expo-video');
    const player = useVideoPlayer(streamUrl, (p: any) => {
      p.play();
    });
    return (
      <View style={styles.container}>
        <VideoView
          player={player}
          style={styles.video}
          allowsFullscreen
          allowsPictureInPicture
        />
      </View>
    );
  }

  // Thumbnail with play button
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => setPlaying(true)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
      <View style={styles.playOverlay}>
        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  video: {
    width: '100%',
    height: 300,
  },
  thumbnail: {
    width: '100%',
    height: 240,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 22,
    color: Colors.textPrimary,
    marginLeft: 3,
  },
});
