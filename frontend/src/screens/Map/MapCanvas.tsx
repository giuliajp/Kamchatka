import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { RaceMapMarker } from '../../components/RaceMapMarker';
import { MapControls } from '../../components/MapControls';
import { stale } from '../../api/format';
import type { Position, Track } from '../../types/api';
import type { MapData } from './mapData';

export interface MapCanvasProps {
  data: MapData; viewKey: string; threshold: number; track?: Track;
  supported?: number[]; onLegend?: () => void;
  refreshing: boolean; onSelect: (entry: Position) => void;
  onCluster: (entries: Position[]) => void; onRefresh: () => void;
}
export function MapCanvas({ data, viewKey, threshold, track, refreshing, onSelect, onCluster, onRefresh, supported = [], onLegend }: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const fitted = useRef('');
  const [zoom, setZoom] = useState(9);
  const [tileError, setTileError] = useState(false);
  const markers = useMemo(() => data.participants.map(p => ({ p, element: document.createElement('div') })), [data.participants]);
  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false, minZoom: 3, maxZoom: 18 });
    instance.attributionControl.setPrefix(false);
    instance.fitBounds(data.bounds, { padding: [48, 64], maxZoom: 12 });
    setZoom(instance.getZoom());
    fitted.current = viewKey;
    map.current = instance;
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 18,
    }).addTo(instance);
    tiles.on('loading', () => setTileError(false));
    tiles.on('tileerror', () => setTileError(true));
    instance.on('zoomend', () => setZoom(instance.getZoom()));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current!;
    const route = data.route.addTo(instance);
    const checkpoints = L.layerGroup().addTo(instance);
    for (const cp of data.checkpoints) {
      const node = document.createElement('span');
      node.className = `race-checkpoint race-checkpoint--${cp.role}`; node.textContent = cp.label || cp.name;
      if (cp.role === 'start' || cp.role === 'finish') {
        node.setAttribute('aria-label', cp.role === 'start' ? 'Старт маршрута' : 'Финиш маршрута');
        const flag = document.createElement('img'); flag.src = `/icons/flag-${cp.role}.svg`; flag.alt = ''; flag.width = 24; flag.height = 24; node.prepend(flag);
      }
      const label = document.createElement('div'); label.textContent = cp.name;
      L.marker([cp.latitude, cp.longitude], { icon: L.divIcon({ html: node, className: 'map-checkpoint', iconSize: [cp.role === 'checkpoint' ? 44 : cp.role === 'start' ? 64 : 74, 28] }), title: cp.name }).bindPopup(label).addTo(checkpoints);
    }
    if (fitted.current !== viewKey) {
      instance.fitBounds(data.bounds, { padding: [48, 64], maxZoom: 12 }); fitted.current = viewKey;
    }
    return () => { instance.removeLayer(route); instance.removeLayer(checkpoints); };
  }, [data, viewKey]);
  useEffect(() => {
    const instance = map.current!;
    const entries = new Map<L.Marker, Position>();
    const group = L.markerClusterGroup({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false, showCoverageOnHover: false, animate: false,
      iconCreateFunction: cluster => {
        const node = document.createElement('div'); node.className = 'race-participant-cluster';
        node.setAttribute('role', 'img'); node.setAttribute('aria-label', `Открыть список: ${cluster.getChildCount()} участников рядом`);
        const img = document.createElement('img'); img.src = '/figma/276-5012/cc3ee.svg'; img.width = 28; img.height = 28; img.alt = '';
        const text = document.createElement('span'); text.textContent = '+' + cluster.getChildCount(); node.append(img, text);
        return L.divIcon({ html: node, className: 'map-cluster', iconSize: [28, 28] });
      },
    });
    for (const { p, element } of markers) {
      const marker = L.marker([p.position!.latitude, p.position!.longitude], {
        icon: L.divIcon({ html: element, className: 'map-marker', iconSize: supported.includes(p.race_participant_id) ? [44, 44] : [36, 36], iconAnchor: supported.includes(p.race_participant_id) ? [22, 22] : [18, 18] }), keyboard: false,
      });
      entries.set(marker, p); group.addLayer(marker);
    }
    const openCluster = (cluster: L.MarkerCluster) => onCluster(cluster.getAllChildMarkers().map(marker => entries.get(marker)!));
    group.on('clusterclick', event => openCluster(event.layer));
    group.on('clusterkeydown', event => {
      const keyboard = event as L.LeafletEvent & { originalEvent: KeyboardEvent };
      if (keyboard.originalEvent.key === 'Enter' || keyboard.originalEvent.key === ' ') {
        keyboard.originalEvent.preventDefault(); openCluster(event.layer);
      }
    });
    group.addTo(instance);
    return () => { instance.removeLayer(group); };
  }, [markers, onCluster, supported]);
  useEffect(() => {
    if (!track) return;
    const instance = map.current!;
    const line = L.polyline(track.points.map(p => [p.latitude, p.longitude]), { color: '#ff4c3e', weight: 3 }).addTo(instance);
    return () => { instance.removeLayer(line); };
  }, [track]);
  return <>
    <div ref={container} className="map-viewport" role="region" aria-label="Карта маршрута. Масштаб кнопками, перемещение стрелками" />
    {markers.map(({ p, element }) => createPortal(<RaceMapMarker number={String(p.start_number)} supported={supported.includes(p.race_participant_id)}
      position={stale(p, threshold) ? 'stale' : 'confirmed'} leader={p.gps_rank === 1} onSelect={() => onSelect(p)} />, element, p.race_participant_id))}
    {tileError && <p className="map-tile-error" role="status">Не удалось загрузить подложку карты</p>}
    <div className="map-controls"><MapControls canZoomIn={zoom < 18} canZoomOut={zoom > 3} refreshing={refreshing}
      onInfo={onLegend} onZoomIn={() => map.current!.zoomIn()} onZoomOut={() => map.current!.zoomOut()} onRefresh={onRefresh} /></div>
  </>;
}
