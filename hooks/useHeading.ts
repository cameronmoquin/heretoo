/**
 * useHeading — device compass heading via DeviceOrientation (web).
 *
 * iOS 13+ requires explicit permission triggered by a user gesture, so
 * the listener attaches when start() is called (wire it to the "Begin
 * hunt" tap). Android attaches immediately. Heading is degrees clockwise
 * from north, or null when no compass is available (distance still works).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const handlerRef = useRef<((e: any) => void) | null>(null);

  const start = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const DOE = (window as any).DeviceOrientationEvent;
    const handler = (e: any) => {
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
      if (h !== null) setHeading(h);
    };
    handlerRef.current = handler;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const s = await DOE.requestPermission();
        if (s === 'granted') window.addEventListener('deviceorientation', handler, true);
        else setDenied(true);
      } catch {
        setDenied(true);
      }
    } else if (typeof window.addEventListener === 'function') {
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
    }
  }, []);

  useEffect(() => () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && handlerRef.current) {
      window.removeEventListener('deviceorientation', handlerRef.current, true);
      window.removeEventListener('deviceorientationabsolute', handlerRef.current, true);
    }
  }, []);

  return { heading, denied, start };
}
