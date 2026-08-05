/**
 * The frame takes the artwork's shape, not the other way around.
 *
 * Every art surface used to be a fixed box with resizeMode="cover",
 * which crops anything that is not box-shaped — a portrait WPA poster
 * in the 88px banner showed as a horizontal sliver of its middle, and
 * the 4:3 feed slot beheaded most of the poster rule's own gallery.
 *
 * The rows carry the museum's pixel dimensions, so the container can
 * usually adopt the piece's exact ratio: then "cover" fills it edge to
 * edge with zero loss. The clamp stops a hand scroll or a panorama from
 * owning the whole screen; only when it engages — or when a row has no
 * dimensions — does the image fall back to "contain", trading letterbox
 * for crop. Nothing is ever cut.
 */

/** Tightest and widest frame a slot will take. 0.72 keeps a full-height
 *  poster under ~890px in the 640 column; 3.6 letterboxes panoramas. */
const MIN_RATIO = 0.72;
const MAX_RATIO = 3.6;

export function artAspect(
  width: number | null | undefined,
  height: number | null | undefined,
  fallback: number,
): { aspectRatio: number; resizeMode: 'cover' | 'contain' } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { aspectRatio: fallback, resizeMode: 'contain' };
  }
  const native = width / height;
  const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, native));
  return {
    aspectRatio: clamped,
    resizeMode: clamped === native ? 'cover' : 'contain',
  };
}
