import React, { useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { getMuxStreamUrl, getMuxThumbnailUrl } from '../../lib/mux';

interface VideoPlayerProps {
  playbackId: string;
  thumbnailUrl?: string;
}

export function VideoPlayer({ playbackId, thumbnailUrl }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const streamUrl = getMuxStreamUrl(playbackId);
  const thumb = thumbnailUrl ?? getMuxThumbnailUrl(playbackId);

  if (playing && Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* @ts-ignore */}
        <video src={streamUrl} controls autoPlay style={{ width: '100%', height: 300, borderRadius: 12, backgroundColor: '#000' }} />
      </View>
    );
  }

  if (playing && Platform.OS !== 'web') {
    const { useVideoPlayer, VideoView } = require('expo-video');
    const player = useVideoPlayer(streamUrl, (p: any) => { p.play(); });
    return (
      <View style={styles.container}>
        <VideoView player={player} style={styles.video} allowsFullscreen allowsPictureInPicture />
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={() => setPlaying(true)} activeOpacity={0.8}>
      <Image source={{ uri: thumb }} style={styles.thumbnail} resizeMode="cover" />
      <View style={styles.playOverlay}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={24} color={Colors.textPrimary} style={{ marginLeft: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  video: { width: '100%', height: 300 },
  thumbnail: { width: '100%', height: 240 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  playButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
});
