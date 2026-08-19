/**
 * docx-text — pull the plain text out of a .docx, in the browser, with
 * no dependency.
 *
 * A .docx is a ZIP whose document body lives at word/document.xml. The
 * import screen only needs the words, so this walks the ZIP's central
 * directory by hand, inflates the one entry it wants through the
 * browser's own DecompressionStream, and strips the XML down to
 * paragraphs. ~2KB instead of a 400KB parsing library, and nothing
 * leaves the device.
 *
 * Scope is deliberate: text only. No styles, no tables-as-grids (their
 * cells arrive as paragraphs), no images. The CV parser downstream only
 * reads sentences anyway.
 */

const EOCD_SIG = 0x06054b50;
const CDIR_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function u16(v: DataView, o: number) { return v.getUint16(o, true); }
function u32(v: DataView, o: number) { return v.getUint32(o, true); }

/** Find word/document.xml in the central directory and inflate it. */
export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // End-of-central-directory: scan back from the tail (comment ≤ 64KB).
  let eocd = -1;
  const stop = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= stop; i--) {
    if (u32(view, i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a .docx (no ZIP directory).');

  const count = u16(view, eocd + 10);
  let off = u32(view, eocd + 16);

  // Walk the central directory to the entry we want.
  let localOff = -1;
  let method = 0;
  let compSize = 0;
  const nameWanted = 'word/document.xml';
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(view, off) !== CDIR_SIG) throw new Error('Damaged .docx directory.');
    const nameLen = u16(view, off + 28);
    const extraLen = u16(view, off + 30);
    const commentLen = u16(view, off + 32);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (name === nameWanted) {
      method = u16(view, off + 10);
      compSize = u32(view, off + 20);
      localOff = u32(view, off + 42);
      break;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  if (localOff < 0) throw new Error('No document body in this .docx.');

  // The local header repeats name/extra with its own lengths.
  if (u32(view, localOff) !== LOCAL_SIG) throw new Error('Damaged .docx entry.');
  const lNameLen = u16(view, localOff + 26);
  const lExtraLen = u16(view, localOff + 28);
  const dataStart = localOff + 30 + lNameLen + lExtraLen;
  const raw = bytes.subarray(dataStart, dataStart + compSize);

  let xmlBytes: Uint8Array;
  if (method === 0) {
    xmlBytes = raw;
  } else if (method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot unzip a .docx. Paste the text instead.');
    }
    const stream = new Blob([raw as any]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error('Unsupported .docx compression.');
  }

  return wordXmlToText(dec.decode(xmlBytes));
}

/** Word's XML → paragraphs. Tags carry the structure; only three matter. */
function wordXmlToText(xml: string): string {
  const text = xml
    // Paragraph and line-break boundaries become newlines BEFORE tags
    // are stripped, or every heading would fuse into its body.
    .replace(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g, (p) => `${p}\n`)
    .replace(/<w:br\/>|<w:cr\/>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
