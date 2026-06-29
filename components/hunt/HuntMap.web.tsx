/**
 * HuntMap (web) — Leaflet map with Mapbox raster tiles.
 *
 * Renders cache markers and, in hide mode, reports where you tap so the
 * hider can place a cache. Raw Leaflet (no react-leaflet) driven
 * imperatively, so there is no peer-version coupling to React. Web only;
 * the native bundle gets HuntMap.tsx.
 *
 * Token: EXPO_PUBLIC_MAPBOX_TOKEN (public pk. token, URL-restricted in
 * production). With no token the component renders a clear setup notice
 * instead of a broken grey grid.
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { HuntMapProps } from './HuntMap.types';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const STYLE = 'mapbox/streets-v12';

// Load Leaflet's stylesheet from CDN once, rather than importing the
// node_modules CSS (which would depend on Metro's web CSS handling).
let cssInjected = false;
function ensureLeafletCss() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.textContent =
    '@keyframes ht-you-pulse{0%{box-shadow:0 0 0 0 rgba(45,226,230,.5)}' +
    '70%{box-shadow:0 0 0 16px rgba(45,226,230,0)}100%{box-shadow:0 0 0 0 rgba(45,226,230,0)}}';
  document.head.appendChild(style);
}

export function HuntMap({
  center, markers = [], onPick, pin, you, zoom = 15, height = 320,
}: HuntMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const youRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Init once.
  useEffect(() => {
    if (!elRef.current || mapRef.current || !TOKEN) return;
    ensureLeafletCss();
    const map = L.map(elRef.current, { zoomControl: true }).setView(
      [center.lat, center.lng], zoom,
    );
    L.tileLayer(
      `https://api.mapbox.com/styles/v1/${STYLE}/tiles/512/{z}/{x}/{y}@2x?access_token=${TOKEN}`,
      {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
        attribution:
          '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Keep the view centred when center prop changes meaningfully.
  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], mapRef.current.getZoom());
  }, [center.lat, center.lng]);

  // Re-render markers when they change.
  useEffect(() => {
    const layer = markersLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const icon = L.divIcon({
        className: 'ht-cache-pin',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${m.color || '#2DE2E6'};border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.25)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker([m.lat, m.lng], { icon });
      if (m.label) marker.bindPopup(m.label);
      marker.addTo(layer);
    }
  }, [markers]);

  // The placed cache pin (hide mode).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pin) {
      if (!pinRef.current) {
        pinRef.current = L.marker([pin.lat, pin.lng]).addTo(map);
      } else {
        pinRef.current.setLatLng([pin.lat, pin.lng]);
      }
    } else if (pinRef.current) {
      map.removeLayer(pinRef.current);
      pinRef.current = null;
    }
  }, [pin?.lat, pin?.lng]);

  // The viewer's own position — a pulsing blue dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (you) {
      const icon = L.divIcon({
        className: 'ht-you',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#2DE2E6;border:2px solid #fff;animation:ht-you-pulse 2s infinite"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      if (!youRef.current) {
        youRef.current = L.marker([you.lat, you.lng], { icon, interactive: false }).addTo(map);
      } else {
        youRef.current.setLatLng([you.lat, you.lng]);
      }
    } else if (youRef.current) {
      map.removeLayer(youRef.current);
      youRef.current = null;
    }
  }, [you?.lat, you?.lng]);

  if (!TOKEN) {
    return (
      <div
        style={{
          height, width: '100%', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 16, boxSizing: 'border-box',
          background: '#1B1536', color: '#A9B4D9',
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
        }}
      >
        Map needs a Mapbox token. Set EXPO_PUBLIC_MAPBOX_TOKEN.
      </div>
    );
  }

  return (
    <div
      ref={elRef}
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
