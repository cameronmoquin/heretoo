/**
 * Lightbox — full-screen image viewer.
 *
 * Tap any photo in the feed or on a post detail to open this. Receives
 * a list of media items (the post's full media array) and the index
 * of the one tapped, so the user can swipe horizontally between them
 * without bouncing back to the post.
 *
 * Background is solid black; close button is top-right; the image is
 * centered and constrained to the viewport. On video items we render
 * a poster image only (we already have inline players in the cards
 * and on the detail page; the lightbox is for stills).
 */

import React, { useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Image,
  Pressable, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaPathToUrl, mediaPathToThumb } from '../../hooks/useUpload';

interface MediaItem {
  id: string;
  storage_path: string;
  media_type: 'image' | 'video';
}

interface LightboxProps {
  media: MediaItem[];
  startIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function Lightbox({ media, startIndex = 0, visible, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(startIndex);
  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, media.length - 1));

  // Keep idx in sync when caller re-opens at a different start index.
  React.useEffect(() => { setIdx(startIndex); }, [startIndex, visible]);

  if (!visible || media.length === 0) return null;

  const item = media[safeIdx];
  const url =
    item.media_type === 'video'
      ? (mediaPathToThumb(item.storage_path) ?? mediaPathToUrl(item.storage_path))
      : mediaPathToUrl(item.storage_path);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(media.length - 1, i + 1));

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.root} onPress={onClose}>
        <Pressable style={s.imageWrap} onPress={(e) => e.stopPropagation()}>
          {Platform.OS === 'web' ? (
            // On web, allow native scroll for >100vw zoom situations.
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: url }} style={s.image} resizeMode="contain" />
            </ScrollView>
          ) : (
            <Image source={{ uri: url }} style={s.image} resizeMode="contain" />
          )}
        </Pressable>

        {/* Close */}
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Prev / Next when there's more than one item */}
        {media.length > 1 && (
          <>
            {safeIdx > 0 && (
              <TouchableOpacity onPress={goPrev} style={[s.arrow, { left: 12 }]}>
                <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {safeIdx < media.length - 1 && (
              <TouchableOpacity onPress={goNext} style={[s.arrow, { right: 12 }]}>
                <Ionicons name="chevron-forward" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <View style={s.counter}>
              <Text style={s.counterText}>{safeIdx + 1} / {media.length}</Text>
            </View>
          </>
        )}
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imageWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute', top: 24, right: 16,
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrow: {
    position: 'absolute', top: '50%', marginTop: -22,
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  counter: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
});
