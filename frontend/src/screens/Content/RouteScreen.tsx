import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { RequestState } from '../../components/RequestState';
import { MapCanvas } from '../Map/MapCanvas';
import { prepareMapData } from '../Map/mapData';
import { metric } from '../../api/format';
import type { RaceDetail, StageDetail } from '../../types/api';
export function RouteScreen({ race }: { race: RaceDetail }) {
  const [id, setId] = useState(race.stages[0]?.id);
  const stage = useApi<StageDetail>(id ? `/stages/${id}` : null);
  const map = useMemo(() => stage.data ? prepareMapData(stage.data, []) : undefined, [stage.data]);
  const profile = stage.data?.elevation_profile ?? [];
  const maxKm = Math.max(1, ...profile.map(point => point.km));
  const minHeight = Math.min(...profile.map(point => point.elevation_m));
  const maxHeight = Math.max(...profile.map(point => point.elevation_m));
  const heightRange = Math.max(1, maxHeight - minHeight);
  return <section className="race-content content-page"><h2>Маршрут и высоты</h2>
    <label>Этап маршрута<select value={id ?? ''} onChange={e => setId(Number(e.target.value))}>{race.stages.map(stage => <option value={stage.id} key={stage.id}>Этап {stage.number} · {stage.name}</option>)}</select></label>
    <RequestState resource={stage} />{stage.data && <><p>{stage.data.description}</p><p>Длина: {metric(stage.data.distance_km, 'км')}</p>
      {map?.bounds.isValid() ? <div className="content-map"><MapCanvas data={map} viewKey={`info:${id}`} threshold={45} onSelect={() => undefined} onCluster={() => undefined} onRefresh={stage.refresh} refreshing={stage.loading} /></div> : <p>Маршрут пока не опубликован.</p>}
      {profile.length > 0 ? <figure><figcaption>Профиль высот · {metric(minHeight, 'м')} — {metric(maxHeight, 'м')}</figcaption><svg className="elevation-chart" viewBox="0 0 600 180" role="img" aria-label="Профиль высот маршрута"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={profile.map(point => `${point.km / maxKm * 600},${170 - (point.elevation_m - minHeight) / heightRange * 160}`).join(' ')} /></svg><p>0 — {metric(maxKm, 'км')}</p></figure> : <p>Профиль высот пока не опубликован.</p>}
      {stage.data.checkpoints.map(cp => <article className="content-card" key={cp.id}><h3>{cp.label || cp.name}</h3><p>{metric(cp.km_from_start, 'км')} · Обязательный отдых: {cp.required_rest_minutes} мин</p>{cp.segment_description && <p>{cp.segment_description}</p>}</article>)}
    </>}
  </section>;
}
