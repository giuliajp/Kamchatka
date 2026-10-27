import { useRef, useState } from 'react';
import { MapControls } from '../../components/MapControls';
import { RaceMapMarker } from '../../components/RaceMapMarker';
import { ParticipantCluster } from '../../components/ParticipantCluster';
import { Checkpoint } from '../../components/Checkpoint';
import { asset, clusters, type MapParticipant } from './demo';

interface MapCanvasProps {
  participants: MapParticipant[]; supported: number[]; stale: boolean;
  onSelect: (id: number) => void; onCluster: (ids: number[]) => void;
  onCheckpoint: (label: string) => void; onRefresh: () => void;
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const steps: Record<string, [number, number]> = { ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] };
export function MapCanvas({ participants, supported, stale, onSelect, onCluster, onCheckpoint, onRefresh }: MapCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const move = (x: number, y: number, scale = zoom) => {
    const width = viewport.current!.clientWidth || 360;
    const height = viewport.current!.clientHeight || 550;
    const offset = Math.max(0, height - 685);
    // Bounds of the original 754 × 999 Figma image, including its crop offset.
    setPan({ x: clamp(x, width / 2 - 433 * scale, 321 * scale - width / 2),
      y: clamp(y, height - offset - 275 - 410 * scale, 589 * scale - 275 - offset) });
  };
  const changeZoom = (next: number) => { setZoom(next); move(pan.x, pan.y, next); };
  const participantIds = new Set(participants.map(p => p.id));
  const grouped = clusters.map(c => ({ ...c, members: c.members.filter(id => participantIds.has(id)) })).filter(c => c.members.length > 1);
  const clusteredIds = new Set(grouped.flatMap(c => c.members));
  return <>
    <div ref={viewport} role="region" aria-label="Карта маршрута. Перемещение стрелками, масштаб кнопками" tabIndex={0} className="map-viewport"
      onKeyDown={e => {
        if (e.target === e.currentTarget && steps[e.key]) { e.preventDefault(); const [x, y] = steps[e.key]; move(pan.x + x, pan.y + y); }
      }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }}
      onPointerMove={e => { if (drag.current) move(drag.current.panX + e.clientX - drag.current.x, drag.current.panY + e.clientY - drag.current.y); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="map-scene" style={{ transform: 'translate(calc(-50% + ' + pan.x + 'px), ' + pan.y + 'px) scale(' + zoom + ')' }}>
        <img className="map-scene__base" src={asset('268b2.png')} alt="" draggable={false} />
        <img className="map-scene__route" src={asset('5adbc.png')} alt="Маршрут гонки от Светлого до Пиначево" draggable={false} />
        <button className="map-pin-hit map-pin-hit--start" aria-label="Старт маршрута" onClick={() => onCheckpoint('Старт маршрута')} />
        <button className="map-pin-hit map-pin-hit--finish" aria-label="Финиш маршрута" onClick={() => onCheckpoint('Финиш маршрута')} />
        {participants.filter(p => !clusteredIds.has(p.id)).map(p =>
          <div className="map-anchor" key={p.id} style={{ left: p.position.x, top: p.position.y }}>
            <RaceMapMarker number={String(p.start_number)} position={stale || p.position.stale ? 'stale' : 'confirmed'}
              supported={supported.includes(p.id)} leader={p.place === 1} onSelect={() => onSelect(p.id)} />
          </div>)}
        {grouped.map(c => <div key={c.id} className="map-anchor" style={{ left: c.x, top: c.y }}>
          <ParticipantCluster count={c.members.length} onSelect={() => onCluster(c.members)} /></div>)}
        <div className="map-anchor" style={{ left: 254, top: 355 }}><Checkpoint label="КП-1" onSelect={() => onCheckpoint('КП-1')} /></div>
        <div className="map-anchor" style={{ left: 144, top: 320 }}><Checkpoint label="КП-2" onSelect={() => onCheckpoint('КП-2')} /></div>
      </div>
    </div>
    <div className="map-controls"><MapControls canZoomIn={zoom < 2} canZoomOut={zoom > 1} refreshing={false}
      onZoomIn={() => changeZoom(Math.min(2, zoom + .25))} onZoomOut={() => changeZoom(Math.max(1, zoom - .25))} onRefresh={onRefresh} /></div>
  </>;
}
