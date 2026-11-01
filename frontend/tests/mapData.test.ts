import { expect, it } from 'vitest';
import { prepareMapData, validCoordinates } from '../src/screens/Map/mapData';
import { positions, stage } from './fixtures';
import type { StageDetail } from '../src/types/api';

it('builds bounds from the actual route, checkpoints and GPS, including points outside the route', () => {
  const participant = { ...positions.participants[0], position: { ...positions.participants[0].position!, latitude: 54, longitude: 160 } };
  const data = prepareMapData(stage, [participant]);
  expect(data.hasRoute).toBe(true);
  expect(data.bounds.contains([53.1, 158.4])).toBe(true);
  expect(data.bounds.contains([54, 160])).toBe(true);
  expect(data.participants).toEqual([participant]); expect(data.checkpoints).toEqual(stage.checkpoints);
});
it.each([
  null,
  { type: 'FeatureCollection', features: [] },
  { type: 'Feature', geometry: null, properties: {} },
  { type: 'GeometryCollection', geometries: [] },
  { type: 'InvalidGeometry' },
])('does not invent a map extent for absent or empty geometry: %j', route => {
  const data = prepareMapData({ ...stage, route_geojson: route as StageDetail['route_geojson'], checkpoints: [] }, []);
  expect(data.hasRoute).toBe(false); expect(data.bounds.isValid()).toBe(false);
});
it('supports checkpoints alone, positions alone and discards unusable point coordinates', () => {
  const cp = prepareMapData({ ...stage, route_geojson: null }, []);
  expect(cp.bounds.getCenter().lat).toBe(stage.checkpoints[0].latitude);
  const gps = prepareMapData({ ...stage, route_geojson: null, checkpoints: [] }, positions.participants);
  expect(gps.bounds.contains([53.2, 158.5])).toBe(true); expect(gps.hasRoute).toBe(false);
  const invalid = prepareMapData({ ...stage, route_geojson: null, checkpoints: [{ ...stage.checkpoints[0], latitude: 100 }] }, [
    { ...positions.participants[0], position: null },
    { ...positions.participants[0], position: { ...positions.participants[0].position!, longitude: Infinity } },
  ]);
  expect(invalid.bounds.isValid()).toBe(false); expect(invalid.participants).toHaveLength(0); expect(invalid.checkpoints).toHaveLength(0);
  expect(validCoordinates(NaN, 158)).toBe(false); expect(validCoordinates(53, NaN)).toBe(false);
  expect(validCoordinates(-91, 158)).toBe(false); expect(validCoordinates(53, -181)).toBe(false);
  expect(validCoordinates(0, 0)).toBe(true); expect(validCoordinates(-90, 180)).toBe(true);
});
