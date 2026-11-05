import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { RequestState } from '../../components/RequestState';
import type { StageDetail } from '../../types/api';
import type { Location } from '../../types/content';
import { prepareMapData } from '../Map/mapData';
export function LocationsScreen({ raceId, items, route, onSelect }: { raceId: number; items?: Location[]; route?: StageDetail; onSelect?: (id: number) => void }) {
  const locations = useApi<Location[]>(items ? null : query('/locations', { race_id: raceId }))
  const places = items ?? locations.data;
  const container = useRef<HTMLDivElement>(null);
  const prepared = useMemo(() => route ? prepareMapData(route, []) : undefined, [route]);
  const [mapError,setMapError] = useState(false);
  useEffect(() => {
    if (!container.current || !places?.length) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    setMapError(false);
    try {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    // The route is a backdrop: venue markers must receive clicks even on the line.
    if (prepared?.hasRoute) prepared.route.setStyle({interactive:false}).addTo(map);
    const points = places.map(location => {
      const label = document.createElement('span'); label.textContent = location.name;
      const marker = L.circleMarker([location.latitude, location.longitude], { radius: 8, color: '#183451' }).bindPopup(label).addTo(map);
      if (onSelect) marker.on('click', () => onSelect(location.id));
      return marker;
    });
    map.fitBounds(L.featureGroup(points).getBounds(), { padding: [24, 24], maxZoom: 13 });
    } catch { setMapError(true); map.remove(); return; }
    return () => { map.remove(); };
  }, [places, prepared, onSelect]);
  return <section className="race-content content-page">{!items && <h2>Зрительские локации</h2>}<RequestState resource={locations} />
    {route?.route_geojson && !prepared?.hasRoute && <p role="status">Маршрут недоступен: данные повреждены или пусты. Локации доступны на карте.</p>}
    {mapError && <p role="alert">Не удалось показать карту. Локации доступны в списке.</p>}
    {Boolean(places?.length) && <div ref={container} className="content-map" aria-label="Карта зрительских локаций" />}
    {places?.length === 0 && <p>Локации пока не опубликованы.</p>}
    {(!items ? places : [])?.map(location => <article className="content-card" key={location.id}><h3>{location.name}</h3>
      {location.description && <p>{location.description}</p>}{location.address && <p>{location.address}</p>}{location.how_to_get_there && <p>{location.how_to_get_there}</p>}
      <p>{location.latitude}, {location.longitude}</p>
    </article>)}
  </section>;
}
