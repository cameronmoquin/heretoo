/**
 * geo — great-circle distance + bearing, ported from the Wayfinder
 * prototype so the in-app seek UI and the server-side find gate
 * (claim_hunt_find) compute the same metres.
 */

export interface LatLng { lat: number; lng: number; }

const R = 6371000; // earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Distance between two points in metres (haversine). */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Initial bearing from a to b, degrees clockwise from north (0–360). */
export function bearing(a: LatLng, b: LatLng): number {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x =
    Math.cos(la1) * Math.sin(la2) -
    Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Human distance readout. */
export function formatDistance(m: number, units: 'imperial' | 'metric' = 'imperial'): string {
  if (units === 'imperial') {
    const ft = m * 3.28084;
    return ft < 1000 ? `${Math.round(ft)} ft` : `${(ft / 5280).toFixed(2)} mi`;
  }
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

/** Hot/cold label for a distance, matching the Wayfinder ladder. */
export function temperature(m: number): 'on_target' | 'burning' | 'hot' | 'warm' | 'cool' | 'cold' {
  if (m <= 3) return 'on_target';
  if (m <= 8) return 'burning';
  if (m <= 20) return 'hot';
  if (m <= 60) return 'warm';
  if (m <= 150) return 'cool';
  return 'cold';
}

/** The server's find gate: within radius plus 25m GPS-noise forgiveness.
 *  Mirrors claim_hunt_find() so the UI can predict the gate. */
export function withinFindGate(distanceM: number, radiusM: number): boolean {
  return distanceM <= radiusM + 25;
}
