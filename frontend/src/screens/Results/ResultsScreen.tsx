import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { statusLabel } from '../../api/format';
import type { Protocols, Results, Standing } from '../../types/api';
import { RequestState } from '../../components/RequestState';
import { participationKey, useExtras } from '../../mocks/extras';
import { DataState } from '../../components/DataState';

export function StandingTable({ rows, onSelect }: { rows: Standing[]; onSelect: (participantId: number, entryId: number) => void }) {
  return <div className="results-scroll" tabIndex={0} role="region" aria-label="Таблица результатов"><table>
    <thead><tr><th>Место</th><th>Участник</th><th>Статус</th><th>Этапы</th><th>Итог</th><th>Отставание</th><th>Штрафы за гонку</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.race_participant_id}>
      <td>{row.place ?? '—'}</td><th scope="row"><button className="text-action" onClick={() => onSelect(row.participant_id, row.race_participant_id)}>№{row.start_number} · {row.full_name}</button></th>
      <td>{statusLabel(row.status)}</td><td>{row.stages.map(stage => <div key={stage.stage_number}>Этап {stage.stage_number}: {stage.time ?? '—'}
        {stage.status && stage.status !== 'finished' && ` (${statusLabel(stage.status)})`}
        {stage.is_corrected_after_final && <span className="result-correction"> Исправлено после утверждения</span>}
        {stage.note && <p>{stage.note}</p>}
      </div>)}</td><td>{row.total_time ?? '—'}</td><td>{row.gap_to_leader ?? '—'}</td>
      <td>{row.penalty_total ?? '—'}{row.penalties.map((penalty, index) => <p key={index}>{penalty.time}{penalty.reason && ` · ${penalty.reason}`}{penalty.rule_reference && ` · ${penalty.rule_reference}`}</p>)}</td>
    </tr>)}</tbody>
  </table></div>;
}
export function ResultsScreen({ raceId, stageNumber, stageId, discipline, onSelect, mine = false }: {
  mine?: boolean; raceId: number; stageNumber: number | undefined; stageId: number | undefined; discipline: string;
  onSelect: (participantId: number, entryId: number) => void;
}) {
  const { value } = useExtras();
  const results = useApi<Results>(query(`/races/${raceId}/results`, { stage: stageNumber, discipline }), 120000);
  const protocols = useApi<Protocols>(stageId === undefined ? null : `/stages/${stageId}/protocols`, 120000);
  return <section className="race-content" aria-label="Результаты гонки">
    <h2>{stageNumber === undefined ? 'Общий зачёт' : `Зачёт после этапа ${stageNumber}`}</h2>
    <RequestState resource={results} /><RequestState resource={protocols} />
    {results.data && <>
      <p className="supporting-text">Официальные результаты по опубликованным протоколам. {results.data.penalty_included_in_stage_times ? 'Штрафы уже включены во время этапов.' : 'Итоговое время рассчитано организаторами с учётом штрафов.'}</p>
      {results.data.disciplines.length === 0 && <DataState status="empty" />}
      {results.data.disciplines.map(group => <section key={group.discipline.id} className="discipline-results">
        <h3>{group.discipline.name}</h3>
        {group.stages.map(stage => <p key={stage.id}>Этап {stage.number}: {stage.is_final ? 'окончательный протокол' : 'предварительный протокол'}</p>)}
        {protocols.data?.protocols.filter(p => p.discipline.code === group.discipline.code).map(protocol => <div key={protocol.discipline.id} className="protocol-meta">
          {protocol.chief_judge && <p>Главный судья: {protocol.chief_judge}</p>}
          {protocol.chief_secretary && <p>Главный секретарь: {protocol.chief_secretary}</p>}
          {protocol.weather && <p>Погода: {protocol.weather}</p>}
        </div>)}
        {group.rows.some(row => !mine || value.supported.includes(participationKey(raceId, row.race_participant_id))) ? <StandingTable rows={group.rows.filter(row => !mine || value.supported.includes(participationKey(raceId, row.race_participant_id)))} onSelect={onSelect} /> : group.rows.length > 0 ? <p role="status">Среди опубликованных результатов нет поддерживаемых вами участников.</p> : <DataState status="empty" />}
      </section>)}
    </>}
  </section>;
}
