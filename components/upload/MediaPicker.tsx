import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors } from '../../constants/colors';
import type { ImagePickerAsset } from 'expo-image-picker';

interface MediaPickerProps {
  selectedAssets: ImagePickerAsset[];
  onPickPhotos: () => void;
  onPickVideo: () => void;
  onClear: () => void;
}

export function MediaPicker({
  selectedAssets,
  onPickPhotos,
  onPickVideo,
  onClear,
}: MediaPickerProps) {
  if (selectedAssets.length > 0) {
    return (
      <View style={styles.preview}>
        <View style={styles.previewGrid}>
          {selectedAssets.slice(0, 4).map((asset, i) => (
            <Image
              key={i}
              source={{ uri: asset.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ))}
        </View>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clearText}>Remove media</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.option} onPress={onPickPhotos}>
        <Text style={styles.optionIcon}>📷</Text>
        <Text style={styles.optionText}>Photos</Text>
        <Text style={styles.optionHint}>Up to 10</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={onPickVideo}>
        <Text style={styles.optionIcon}>🎬</Text>
        <Text style={styles.optionText}>Video</Text>
        <Text style={styles.optionHint}>Single clip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  optionIcon: {
    fontSize: 28,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  optionHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  preview: {
    gap: 12,
    alignItems: 'center',
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: 100,
    height: 100,
  },
  clearText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
});
