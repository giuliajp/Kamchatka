import {StrictMode} from 'react';
import {render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import L from 'leaflet';
import {LocationsScreen} from '../src/screens/Content/LocationsScreen';
import {stage} from './fixtures';
import {spectatorLocation} from '../src/stories/contentFixtures';
const svg=L.Browser.svg;
afterEach(()=>{Object.defineProperty(L.Browser,'svg',{value:svg});});
it('keeps real Leaflet layers local across StrictMode replay, rerender and remount',()=>{
 // jsdom can create SVG paths but does not implement the SVG capability probe.
 Object.defineProperty(L.Browser,'svg',{value:true});
 const items=[spectatorLocation];const onSelect=vi.fn();
 const view=(select=onSelect)=><StrictMode><LocationsScreen raceId={10} items={items} route={stage} onSelect={select}/></StrictMode>;
 const first=render(view());
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(first.container.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
 first.rerender(view(vi.fn()));
 expect(first.container.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
 first.unmount();
 const second=render(view());
 expect(second.container.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
 second.unmount();
});
