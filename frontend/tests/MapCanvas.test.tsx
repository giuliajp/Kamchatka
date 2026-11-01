import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { MapCanvas } from '../src/screens/Map/MapCanvas';
import { positions, stage, track } from './fixtures';
import type { MapData } from '../src/screens/Map/mapData';

const mock = vi.hoisted(() => ({ instances: [] as unknown[], tiles: [] as unknown[], groups: [] as unknown[], lines: [] as unknown[] }));
// Leaflet owns layout in the browser. This harness records geographical inputs and layer lifecycle;
// the real Leaflet/cluster interaction is additionally checked in Playwright.
vi.mock('leaflet', () => {
  function layer() {
    return { addTo: vi.fn(function(this: unknown) { return this; }) };
  }
  return { default: {
    map: vi.fn((container: HTMLElement) => {
      let zoom = 9;
      const events: Record<string, () => void> = {};
      const instance = { container, events, attributionControl: { setPrefix: vi.fn() }, on: (name: string, callback: () => void) => { events[name] = callback; },
        getZoom: () => zoom, zoomIn: () => { zoom = 18; events.zoomend(); }, zoomOut: () => { zoom = 3; events.zoomend(); },
        fitBounds: vi.fn(), removeLayer: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn() };
      mock.instances.push(instance); return instance;
    }),
    tileLayer: vi.fn((url, options) => {
      const events: Record<string, () => void> = {};
      const tiles = { ...layer(), url, options, events, on: (name: string, callback: () => void) => { events[name] = callback; } };
      mock.tiles.push(tiles); return tiles;
    }),
    layerGroup: layer,
    divIcon: vi.fn(options => options),
    marker: vi.fn((coords, options) => {
      const marker = { coords, options, bindPopup: vi.fn(function(this: unknown) { return this; }), addTo: vi.fn() };
      return marker;
    }),
    markerClusterGroup: vi.fn(options => {
      const markers: { options: { icon: { html: HTMLElement } } }[] = [];
      const events: Record<string, (event: unknown) => void> = {};
      const group = { options, markers, events, addLayer: (marker: typeof markers[number]) => markers.push(marker),
        on: (name: string, callback: (event: unknown) => void) => { events[name] = callback; },
        addTo: (map: { container: HTMLElement }) => markers.forEach(m => map.container.append(m.options.icon.html)), getBounds: vi.fn() };
      mock.groups.push(group); return group;
    }),
    polyline: vi.fn((points, options) => { const line = { ...layer(), points, options }; mock.lines.push(line); return line; }),
  } };
});
vi.mock('leaflet.markercluster', () => ({}));
beforeEach(() => { vi.stubEnv('VITE_MAP_TILE_URL', ''); vi.stubEnv('VITE_MAP_ATTRIBUTION', ''); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function prepared(participants = positions.participants, checkpoints = stage.checkpoints) {
  return { route: { addTo: vi.fn().mockReturnThis() }, bounds: { isValid: () => true },
    hasRoute: true, participants, checkpoints } as unknown as MapData;
}

it('renders actual coordinates, markers, route, checkpoints and track and cleans up layers', async () => {
  const selected = vi.fn(); const clustered = vi.fn(); const refresh = vi.fn(); const resize = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize.mockImplementation(callback); } observe() {} disconnect() {} });
  const data = prepared();
  const { unmount, rerender } = render(<AppProviders><MapCanvas data={data} viewKey="103:route"
    threshold={45} track={track} onSelect={selected} onCluster={clustered} onRefresh={refresh} refreshing={false} /></AppProviders>);
  const instance = mock.instances.at(-1) as { fitBounds: ReturnType<typeof vi.fn>; invalidateSize: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; removeLayer: ReturnType<typeof vi.fn> };
  const group = mock.groups.at(-1) as { markers: { coords: number[] }[]; options: { iconCreateFunction: (c: unknown) => { html: HTMLElement } }; events: Record<string, (event: unknown) => void> };
  expect(group.markers[0].coords).toEqual([53.2, 158.5]); expect(instance.fitBounds).toHaveBeenCalledWith(data.bounds, { padding: [48, 64], maxZoom: 12 });
  expect((mock.lines.at(-1) as { points: number[][] }).points).toEqual([[53.2, 158.5]]);
  await userEvent.click(screen.getByRole('button', { name: /Участник 14,/ })); expect(selected).toHaveBeenCalledWith(positions.participants[0]);
  const icon = group.options.iconCreateFunction({ getChildCount: () => 2 }); expect(icon.html.textContent).toBe('+2'); expect(icon.html.querySelector('img')?.width).toBe(28);
  act(() => group.events.clusterclick({ layer: { getAllChildMarkers: () => group.markers } })); expect(clustered).toHaveBeenCalledWith(positions.participants);
  const preventDefault = vi.fn();
  for (const key of ['Enter', ' ', 'Escape']) act(() => group.events.clusterkeydown({ layer: { getAllChildMarkers: () => group.markers }, originalEvent: { key, preventDefault } }));
  expect(preventDefault).toHaveBeenCalledTimes(2); expect(clustered).toHaveBeenCalledTimes(3);
  await userEvent.click(screen.getByRole('button', { name: 'Увеличить масштаб' })); expect(screen.getByRole('button', { name: 'Увеличить масштаб' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Уменьшить масштаб' })); expect(screen.getByRole('button', { name: 'Уменьшить масштаб' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Обновить' })); expect(refresh).toHaveBeenCalledOnce();
  act(() => resize()); expect(instance.invalidateSize).toHaveBeenCalledOnce();
  const tiles = mock.tiles.at(-1) as { events: Record<string, () => void> };
  act(() => tiles.events.tileerror()); expect(screen.getByText(/Не удалось загрузить подложку/)).toBeVisible();
  expect(tiles.events.load).toBeUndefined(); // Leaflet emits load even when all tiles failed.
  act(() => tiles.events.loading()); expect(screen.queryByText(/Не удалось загрузить подложку/)).not.toBeInTheDocument();
  const count = instance.fitBounds.mock.calls.length;
  rerender(<AppProviders><MapCanvas data={prepared()} viewKey="103:route" threshold={45} onSelect={selected} onCluster={clustered} onRefresh={refresh} refreshing={false} /></AppProviders>);
  expect(instance.fitBounds.mock.calls.length).toBe(count);
  const next = prepared();
  rerender(<AppProviders><MapCanvas data={next} viewKey="104:route" threshold={45} onSelect={selected} onCluster={clustered} onRefresh={refresh} refreshing={false} /></AppProviders>);
  expect(instance.fitBounds).toHaveBeenLastCalledWith(next.bounds, { padding: [48, 64], maxZoom: 12 });
  unmount(); expect(instance.remove).toHaveBeenCalledOnce(); expect(instance.removeLayer).toHaveBeenCalled();
});
it('handles checkpoints without labels and allows another tile provider', () => {
  vi.stubEnv('VITE_MAP_TILE_URL', 'https://tiles.test/{z}/{x}/{y}'); vi.stubEnv('VITE_MAP_ATTRIBUTION', 'Our provider');
  const props = { data: prepared(positions.participants, []), viewKey: '103:positions', threshold: 45,
    onSelect: vi.fn(), onCluster: vi.fn(), onRefresh: vi.fn(), refreshing: true };
  const { rerender } = render(<AppProviders><MapCanvas {...props} /></AppProviders>);
  expect((mock.instances.at(-1) as { fitBounds: ReturnType<typeof vi.fn> }).fitBounds).toHaveBeenCalled();
  expect((mock.tiles.at(-1) as { options: { attribution: string } }).options.attribution).toBe('Our provider');
  rerender(<AppProviders><MapCanvas {...props} data={prepared([], [{ ...stage.checkpoints[0], label: null }])} /></AppProviders>);
  rerender(<AppProviders><MapCanvas {...props} data={prepared([], [])} /></AppProviders>);
});
it('renders supported marker sizes, generic checkpoints and finish flags, and connects the legend control', async () => {
  const legend = vi.fn();
  render(<AppProviders><MapCanvas data={prepared(positions.participants, [{ ...stage.checkpoints[0], role: 'checkpoint', label: null }, { ...stage.checkpoints[0], id: 301, role: 'finish' }])}
    viewKey="legend" threshold={45} supported={[9001]} onLegend={legend} onSelect={vi.fn()} onCluster={vi.fn()} onRefresh={vi.fn()} refreshing={false} /></AppProviders>);
  expect(screen.getByRole('button', { name: /Участник 14.*мой участник/ })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Условные обозначения' })); expect(legend).toHaveBeenCalledOnce();
});
it('uses the original OSM tiles and copyright without the optional Leaflet prefix', () => {
  render(<AppProviders><MapCanvas data={prepared()} viewKey="osm" threshold={45}
    onSelect={vi.fn()} onCluster={vi.fn()} onRefresh={vi.fn()} refreshing={false} /></AppProviders>);
  const tiles = mock.tiles.at(-1) as { url: string; options: { attribution: string } };
  expect(tiles.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  expect(tiles.options.attribution).toContain('https://www.openstreetmap.org/copyright');
  expect((mock.instances.at(-1) as { attributionControl: { setPrefix: ReturnType<typeof vi.fn> } }).attributionControl.setPrefix).toHaveBeenCalledWith(false);
});
it('fits the first GPS response once without recentering on every subsequent poll', () => {
  const props = { viewKey: 'initial-gps', threshold: 45, onSelect: vi.fn(), onCluster: vi.fn(), onRefresh: vi.fn(), refreshing: false };
  const { rerender } = render(<AppProviders><MapCanvas {...props} data={prepared([])} /></AppProviders>);
  const instance = mock.instances.at(-1) as { fitBounds: ReturnType<typeof vi.fn> };
  const initial = instance.fitBounds.mock.calls.length;
  const loaded = prepared();
  rerender(<AppProviders><MapCanvas {...props} data={loaded} /></AppProviders>);
  expect(instance.fitBounds.mock.calls.length).toBe(initial + 1);
  expect(instance.fitBounds).toHaveBeenLastCalledWith(loaded.bounds, expect.anything());
  rerender(<AppProviders><MapCanvas {...props} data={prepared()} /></AppProviders>);
  expect(instance.fitBounds.mock.calls.length).toBe(initial + 1);
});
it('omits invalid track coordinates and does not create an empty track layer', () => {
  const props = { data: prepared(), viewKey: 'track-validation', threshold: 45, onSelect: vi.fn(), onCluster: vi.fn(), onRefresh: vi.fn(), refreshing: false };
  const invalid = { ...track.points[0], latitude: 200 };
  const { rerender } = render(<AppProviders><MapCanvas {...props} track={{ ...track, points: [invalid, track.points[0]] }} /></AppProviders>);
  expect((mock.lines.at(-1) as { points: number[][] }).points).toEqual([[53.2, 158.5]]);
  const before = mock.lines.length;
  rerender(<AppProviders><MapCanvas {...props} track={{ ...track, points: [invalid] }} /></AppProviders>);
  expect(mock.lines).toHaveLength(before);
});
