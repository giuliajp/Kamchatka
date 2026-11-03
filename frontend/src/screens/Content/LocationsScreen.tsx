import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { RequestState } from '../../components/RequestState';
import type { Location } from '../../types/content';
export function LocationsScreen({ raceId }: { raceId: number }) {
  const locations = useApi<Location[]>(query('/locations', { race_id: raceId }));
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !locations.data?.length) return;
    const map = L.map(container.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    const points = locations.data.map(location => {
      const label = document.createElement('span'); label.textContent = location.name;
      return L.circleMarker([location.latitude, location.longitude], { radius: 8, color: '#183451' }).bindPopup(label).addTo(map);
    });
    map.fitBounds(L.featureGroup(points).getBounds(), { padding: [24, 24], maxZoom: 13 });
    return () => { map.remove(); };
  }, [locations.data]);
  return <section className="race-content content-page"><h2>Зрительские локации</h2><RequestState resource={locations} />
    {Boolean(locations.data?.length) && <div ref={container} className="content-map" aria-label="Карта зрительских локаций" />}
    {locations.data?.length === 0 && <p>Локации пока не опубликованы.</p>}
    {locations.data?.map(location => <article className="content-card" key={location.id}><h3>{location.name}</h3>
      {location.description && <p>{location.description}</p>}{location.address && <p>{location.address}</p>}{location.how_to_get_there && <p>{location.how_to_get_there}</p>}
      <p>{location.latitude}, {location.longitude}</p>
    </article>)}
  </section>;
}
