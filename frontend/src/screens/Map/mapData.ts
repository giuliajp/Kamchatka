import L from 'leaflet';
import type { Position, StageDetail } from '../../types/api';

export function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

// Leaflet can prepare layers and bounds without creating a map or requesting tiles.
export function prepareMapData(stage: StageDetail, participants: Position[]) {
  const route = L.geoJSON(undefined, { style: { color: '#0c4388', weight: 4 } });
  try {
    if (stage.route_geojson) route.addData(stage.route_geojson);
  } catch { route.clearLayers(); }
  const bounds = route.getBounds();
  const hasRoute = bounds.isValid();
  const checkpoints = stage.checkpoints.filter(cp => validCoordinates(cp.latitude, cp.longitude));
  const positioned = participants.filter(p => p.position !== null && validCoordinates(p.position.latitude, p.position.longitude));
  for (const cp of checkpoints) bounds.extend([cp.latitude, cp.longitude]);
  for (const p of positioned) bounds.extend([p.position!.latitude, p.position!.longitude]);
  return { route, bounds, hasRoute, checkpoints, participants: positioned };
}
export type MapData = ReturnType<typeof prepareMapData>;
