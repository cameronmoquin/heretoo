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
import 'leaflet/dist/leaflet.css';
import type { HuntMapProps } from './HuntMap.types';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const STYLE = 'mapbox/streets-v12';

export function HuntMap({
  center, markers = [], onPick, pin, zoom = 15, height = 320,
}: HuntMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Init once.
  useEffect(() => {
    if (!elRef.current || mapRef.current || !TOKEN) return;
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
