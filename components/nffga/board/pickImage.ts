/**
 * pickImage — choose one photo from the library and shrink it to a
 * sensible upload size (longest side 1600, JPEG). Returns null when the
 * person cancels.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { PickedImage } from '../../../lib/nffga/profile';

const MAX_SIDE = 1600;

export async function pickImage(opts: { square?: boolean } = {}): Promise<PickedImage | null> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    allowsEditing: !!opts.square,
    aspect: opts.square ? [1, 1] : undefined,
    quality: 0.9,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  try {
    const big = Math.max(a.width || 0, a.height || 0);
    const actions: ImageManipulator.Action[] = [];
    if (big > MAX_SIDE) {
      actions.push({ resize: (a.width || 0) >= (a.height || 0) ? { width: MAX_SIDE } : { height: MAX_SIDE } });
    }
    const out = await ImageManipulator.manipulateAsync(a.uri, actions, {
      compress: 0.85, format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: out.uri, mimeType: 'image/jpeg', fileName: 'photo.jpg' };
  } catch {
    return { uri: a.uri, mimeType: a.mimeType ?? null, fileName: a.fileName ?? null };
  }
}
