/**
 * CropPhotoModal — the one edit a photo book actually needs.
 *
 * Web only, like the rest of the babybook's editing surface. The image
 * renders fit-to-screen, a crop rectangle rides it — drag inside to
 * move, drag a corner to resize — and Save re-encodes the cropped
 * region to JPEG and hands the blob back. The caller owns what happens
 * next (upload, row update). Cancel costs nothing.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { Type, Radius } from '../../constants/design';

interface Rect { x: number; y: number; w: number; h: number }

const HANDLE = 22;
const MIN = 40;

export function CropPhotoModal({
  visible, imageUrl, onCancel, onSave, saving,
}: {
  visible: boolean;
  imageUrl: string | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving: boolean;
}) {
  const s = makeStyles();
  const frameRef = useRef<any>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgBox, setImgBox] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const drag = useRef<{ mode: string; startX: number; startY: number; start: Rect } | null>(null);

  // Lay out the image fit-contain inside the frame and start the crop
  // at a 6% inset — visibly a crop, trivially adjustable.
  const place = () => {
    const frame = frameRef.current as HTMLElement | null;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth) return;
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const scale = Math.min(fw / img.naturalWidth, fh / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const box = { x: (fw - w) / 2, y: (fh - h) / 2, w, h };
    setImgBox(box);
    const inset = 0.06;
    setCrop({ x: box.x + box.w * inset, y: box.y + box.h * inset, w: box.w * (1 - 2 * inset), h: box.h * (1 - 2 * inset) });
  };

  useEffect(() => {
    if (!visible) { setImgBox(null); setCrop(null); }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || !imgBox) return;
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      const r = { ...d.start };
      if (d.mode === 'move') {
        r.x = Math.min(Math.max(d.start.x + dx, imgBox.x), imgBox.x + imgBox.w - r.w);
        r.y = Math.min(Math.max(d.start.y + dy, imgBox.y), imgBox.y + imgBox.h - r.h);
      } else {
        if (d.mode.includes('e')) r.w = Math.min(Math.max(d.start.w + dx, MIN), imgBox.x + imgBox.w - r.x);
        if (d.mode.includes('s')) r.h = Math.min(Math.max(d.start.h + dy, MIN), imgBox.y + imgBox.h - r.y);
        if (d.mode.includes('w')) {
          const nx = Math.min(Math.max(d.start.x + dx, imgBox.x), d.start.x + d.start.w - MIN);
          r.w = d.start.w + (d.start.x - nx); r.x = nx;
        }
        if (d.mode.includes('n')) {
          const ny = Math.min(Math.max(d.start.y + dy, imgBox.y), d.start.y + d.start.h - MIN);
          r.h = d.start.h + (d.start.y - ny); r.y = ny;
        }
      }
      setCrop(r);
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [visible, imgBox]);

  const startDrag = (mode: string) => (e: any) => {
    if (!crop) return;
    e.preventDefault?.();
    const pe = e.nativeEvent ?? e;
    drag.current = { mode, startX: pe.clientX, startY: pe.clientY, start: { ...crop } };
  };

  const save = () => {
    const img = imgRef.current;
    if (!img || !imgBox || !crop) return;
    const scale = img.naturalWidth / imgBox.w;
    const sx = (crop.x - imgBox.x) * scale;
    const sy = (crop.y - imgBox.y) * scale;
    const sw = crop.w * scale;
    const sh = crop.h * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, 'image/jpeg', 0.92);
  };

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onCancel}>
      <View style={s.root}>
        <View style={s.frame} ref={frameRef}>
          {imageUrl && (
            // Plain DOM img: the crop math needs naturalWidth and the
            // canvas needs a drawable source. crossOrigin so toBlob is
            // not tainted by the storage CDN.
            React.createElement('img', {
              ref: imgRef,
              src: imageUrl,
              crossOrigin: 'anonymous',
              onLoad: place,
              style: imgBox
                ? { position: 'absolute', left: imgBox.x, top: imgBox.y, width: imgBox.w, height: imgBox.h, userSelect: 'none', pointerEvents: 'none' }
                : { opacity: 0 },
            })
          )}
          {!imgBox && <ActivityIndicator color="#FFF" style={{ marginTop: 120 }} />}
          {crop && (
            <>
              <View pointerEvents="none" style={[s.shade, { left: 0, top: 0, right: 0, height: crop.y }]} />
              <View pointerEvents="none" style={[s.shade, { left: 0, top: crop.y + crop.h, right: 0, bottom: 0 }]} />
              <View pointerEvents="none" style={[s.shade, { left: 0, top: crop.y, width: crop.x, height: crop.h }]} />
              <View pointerEvents="none" style={[s.shade, { left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }]} />
              <View
                style={[s.cropRect, { left: crop.x, top: crop.y, width: crop.w, height: crop.h }]}
                onPointerDown={startDrag('move')}
              />
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <View
                  key={corner}
                  style={[s.handle, {
                    left: crop.x + (corner.includes('e') ? crop.w : 0) - HANDLE / 2,
                    top: crop.y + (corner.includes('s') ? crop.h : 0) - HANDLE / 2,
                  }]}
                  onPointerDown={startDrag(corner)}
                />
              ))}
            </>
          )}
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.btn} onPress={onCancel} disabled={saving} accessibilityLabel="Cancel">
            <Text style={s.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={save} disabled={saving || !crop} accessibilityLabel="Save crop">
            {saving
              ? <ActivityIndicator color={Colors.onPrimary} size="small" />
              : <Text style={[s.btnText, s.btnTextPrimary]}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  frame: { flex: 1, overflow: 'hidden' },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  cropRect: {
    position: 'absolute',
    borderWidth: 1.5, borderColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ cursor: 'move', touchAction: 'none' } as any) : {}),
  },
  handle: {
    position: 'absolute', width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ touchAction: 'none' } as any) : {}),
  },
  actions: {
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: '#000',
  },
  btn: {
    flex: 1, minHeight: 46, borderRadius: Radius.control,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#444',
  },
  btnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  btnText: { color: '#FFF', fontSize: Type.ui.size, fontWeight: '600' },
  btnTextPrimary: { color: Colors.onPrimary },
}); }
