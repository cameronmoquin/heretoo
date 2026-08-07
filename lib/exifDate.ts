/**
 * exifDate — pull the taken-at date out of a JPEG, nothing else.
 *
 * Reads the APP1/EXIF segment for DateTimeOriginal (0x9003), falling
 * back to DateTime (0x0132). No library: the whole job is one segment
 * walk and two IFD scans, and the bundle carries not one byte more
 * than that. Anything that isn't a JPEG with EXIF — PNG, HEIC the
 * browser re-encoded, screenshots, stripped uploads — returns null,
 * and the caller asks the person instead.
 */

/** "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD", or null. */
function exifStringToIso(s: string): string | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (y === '0000') return null;
  return `${y}-${mo}-${d}`;
}

/** The date a JPEG says it was taken, as YYYY-MM-DD. Null when it doesn't say. */
export async function exifDateOf(file: File | Blob): Promise<string | null> {
  try {
    // EXIF lives in the first kilobytes; 256KB covers pathological writers.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

    // Walk JPEG segments to APP1 "Exif\0\0".
    let offset = 2;
    let tiff = -1;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda) break; // start of scan — no EXIF past here
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1
        && offset + 10 <= view.byteLength
        && view.getUint32(offset + 4) === 0x45786966 /* "Exif" */) {
        tiff = offset + 10;
        break;
      }
      offset += 2 + size;
    }
    if (tiff < 0 || tiff + 8 > view.byteLength) return null;

    const little = view.getUint16(tiff) === 0x4949;
    const u16 = (o: number) => view.getUint16(o, little);
    const u32 = (o: number) => view.getUint32(o, little);

    const readAscii = (valOffset: number, count: number): string => {
      // Values over 4 bytes live at an offset from the TIFF header.
      const at = count <= 4 ? valOffset : tiff + u32(valOffset);
      let out = '';
      for (let i = 0; i < count - 1 && at + i < view.byteLength; i++) {
        out += String.fromCharCode(view.getUint8(at + i));
      }
      return out;
    };

    // Scan one IFD; returns {tag → ascii value} for the tags asked about,
    // plus the ExifIFD pointer if present.
    const scanIfd = (ifd: number, want: Set<number>) => {
      const found = new Map<number, string>();
      let exifIfd = -1;
      if (ifd + 2 > view.byteLength) return { found, exifIfd };
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        const tag = u16(e);
        if (tag === 0x8769) exifIfd = tiff + u32(e + 8);
        else if (want.has(tag) && u16(e + 2) === 2 /* ASCII */) {
          found.set(tag, readAscii(e + 8, u32(e + 4)));
        }
      }
      return { found, exifIfd };
    };

    const ifd0 = tiff + u32(tiff + 4);
    const first = scanIfd(ifd0, new Set([0x0132]));
    if (first.exifIfd > 0) {
      const sub = scanIfd(first.exifIfd, new Set([0x9003, 0x9004]));
      const original = sub.found.get(0x9003) ?? sub.found.get(0x9004);
      if (original) return exifStringToIso(original);
    }
    const modified = first.found.get(0x0132);
    return modified ? exifStringToIso(modified) : null;
  } catch {
    return null;
  }
}
