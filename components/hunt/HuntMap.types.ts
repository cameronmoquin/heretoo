/** Shared props for the platform-split HuntMap (web Leaflet / native stub). */
import type { LatLng } from '../../lib/geo';

export interface HuntMarker {
  id: string;
  lat: number;
  lng: number;
  /** Marker tint. Defaults to the cache accent. */
  color?: string;
  /** Label shown in the popup. */
  label?: string;
}

export interface HuntMapProps {
  center: LatLng;
  markers?: HuntMarker[];
  /** When set, tapping the map reports the picked coordinate (hide mode). */
  onPick?: (p: LatLng) => void;
  /** A single draggable/placed pin (the cache being dropped). */
  pin?: LatLng | null;
  zoom?: number;
  height?: number;
}
