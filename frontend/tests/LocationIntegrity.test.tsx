import {render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import L from 'leaflet';
import {LocationsScreen} from '../src/screens/Content/LocationsScreen';
import {stage} from './fixtures';
import {spectatorLocation} from '../src/stories/contentFixtures';
vi.mock('leaflet',async original=>{
 const actual=await original<{default:typeof L}>();
 return {...actual,default:{...actual.default,map:vi.fn(()=>({fitBounds:vi.fn(),remove:vi.fn(),addLayer:vi.fn()})),tileLayer:vi.fn(()=>({addTo:vi.fn()})),circleMarker:vi.fn(()=>({bindPopup:vi.fn().mockReturnThis(),addTo:vi.fn().mockReturnThis(),on:vi.fn().mockReturnThis()})),featureGroup:vi.fn(()=>({getBounds:vi.fn()}))}};
});
it('keeps venue markers and navigation after malformed GeoJSON and removes the map on unmount',()=>{
 const select=vi.fn();
 const broken={...stage,route_geojson:{type:'Feature',geometry:{type:'LineString',coordinates:null},properties:{}} as unknown as typeof stage.route_geojson};
 const {unmount}=render(<LocationsScreen raceId={10} items={[spectatorLocation]} route={broken} onSelect={select}/>);
 expect(screen.getByText(/Маршрут недоступен/)).toBeVisible();expect(screen.getByLabelText('Карта зрительских локаций')).toBeVisible();
 const marker=vi.mocked(L.circleMarker).mock.results.at(-1)!.value;
 vi.mocked(marker.on).mock.calls[0][1]();expect(select).toHaveBeenCalledWith(spectatorLocation.id);
 const map=vi.mocked(L.map).mock.results.at(-1)!.value;
 unmount();expect(map.remove).toHaveBeenCalledOnce();
});
it('cleans up a partially initialized map when a layer fails',()=>{
 vi.mocked(L.tileLayer).mockImplementationOnce(()=>{throw new Error('Layer failed');});
 const {unmount}=render(<LocationsScreen raceId={10} items={[spectatorLocation]}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('Не удалось показать карту');
 const map=vi.mocked(L.map).mock.results.at(-1)!.value;
 expect(map.remove).toHaveBeenCalledOnce();unmount();expect(map.remove).toHaveBeenCalledOnce();
});
