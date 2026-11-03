import { useApi } from '../../hooks/useApi';
import { RequestState } from '../../components/RequestState';
import { raceTime } from '../../api/format';
import type { ArrivalEstimate as Estimate } from '../../types/content';

export function ArrivalEstimate({ stageId }: { stageId: number }) {
  const estimate = useApi<Estimate>(`/stages/${stageId}/arrival-estimate`, 120000);
  return <aside className="arrival-estimate"><h4>Ожидаемое время прибытия лидеров</h4><RequestState resource={estimate} />
    {estimate.data && (estimate.data.first ? <><strong>≈{raceTime(estimate.data.first.from)} – {raceTime(estimate.data.first.to)}</strong><p>{estimate.data.note}</p><small>Время по Камчатке · оценка по GPS</small></> : <p>Оценка прибытия пока недоступна.</p>)}
  </aside>;
}
