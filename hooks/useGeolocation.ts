/**
 * useGeolocation — live position via the browser Geolocation API (web).
 * Native has no expo-location dep yet, so it reports unsupported there;
 * the hunt UI degrades to a clear message rather than crashing.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface GeoCoords { lat: number; lng: number; accuracy: number; }
export type GeoError = 'denied' | 'unavailable' | 'unsupported' | null;

export function useGeolocation(active = true) {
  const supported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'geolocation' in navigator;

  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<GeoError>(supported ? null : 'unsupported');

  useEffect(() => {
    if (!active || !supported) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setCoords({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
      },
      (e) => setError(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, supported]);

  return { coords, error, supported };
}
