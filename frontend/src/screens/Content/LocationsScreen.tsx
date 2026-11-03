import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { RequestState } from '../../components/RequestState';
import type { StageDetail } from '../../types/api';
import type { Location } from '../../types/content';
export function LocationsScreen({ raceId, items, route, onSelect }: { raceId: number; items?: Location[]; route?: StageDetail; onSelect?: (id: number) => void }) {
  const locations = useApi<Location[]>(items ? null : query('/locations', { race_id: raceId }))
  const places = items ?? locations.data;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !places?.length) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    const points = places.map(location => {
      const label = document.createElement('span'); label.textContent = location.name;
      const marker = L.circleMarker([location.latitude, location.longitude], { radius: 8, color: '#183451' }).bindPopup(label).addTo(map);
      if (onSelect) marker.on('click', () => onSelect(location.id));
      return marker;
    });
    if (route?.route_geojson) L.geoJSON(route.route_geojson).addTo(map);
    map.fitBounds(L.featureGroup(points).getBounds(), { padding: [24, 24], maxZoom: 13 });
    return () => { map.remove(); };
  }, [places, route, onSelect]);
  return <section className="race-content content-page">{!items && <h2>Зрительские локации</h2>}<RequestState resource={locations} />
    {Boolean(places?.length) && <div ref={container} className="content-map" aria-label="Карта зрительских локаций" />}
    {places?.length === 0 && <p>Локации пока не опубликованы.</p>}
    {(!items ? places : [])?.map(location => <article className="content-card" key={location.id}><h3>{location.name}</h3>
      {location.description && <p>{location.description}</p>}{location.address && <p>{location.address}</p>}{location.how_to_get_there && <p>{location.how_to_get_there}</p>}
      <p>{location.latitude}, {location.longitude}</p>
    </article>)}
  </section>;
}
