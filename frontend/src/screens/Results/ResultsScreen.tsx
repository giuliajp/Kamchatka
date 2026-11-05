import { Icon16Chevron, Icon20LikeOutline } from '@vkontakte/icons';
import { useRoute } from '../../hooks/useRoute';
import { updateRoute } from '../../api/navigation';
import { externalUrl } from '../../api/links';
import { raceDate, raceTime } from '../../api/format';
import type { Albums, CheckpointPass, Me, Photos } from '../../types/content';
import { BookmarkButton } from '../Content/MediaScreen';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { statusLabel } from '../../api/format';
import type { Participant, Protocols, Race, RaceDetail, Results, StageDetail, Standing } from '../../types/api';
import { RequestState } from '../../components/RequestState';
import { useUser } from '../../app/UserProvider';
import { DataState } from '../../components/DataState';

export function StandingTable({ rows, onSelect }: { rows: Standing[]; onSelect: (participantId: number, entryId: number) => void }) {
  return <div className="results-scroll" tabIndex={0} role="region" aria-label="Таблица результатов"><table>
    <thead><tr><th>Место</th><th>Участник</th><th>Регион</th><th>Статус</th><th>Этапы</th><th>Итог</th><th>Отставание</th><th>Штрафы за гонку</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.race_participant_id}>
      <td>{row.place ?? '—'}</td><th scope="row"><button className="text-action" onClick={() => onSelect(row.participant_id, row.race_participant_id)}>№{row.start_number} · {row.full_name}</button></th>
      <td>{row.region ?? '—'}</td><td>{statusLabel(row.status)}</td><td>{row.stages.map(stage => <div key={stage.stage_number}>Этап {stage.stage_number}: {stage.time ?? '—'}
        {stage.status && stage.status !== 'finished' && ` (${statusLabel(stage.status)})`}
        <p>Собаки на старте: {stage.dogs_at_start ?? '—'}</p>
        <p>Собаки на финише: {stage.dogs_at_finish ?? '—'}</p>
        {stage.is_corrected_after_final && <span className="result-correction"> Исправлено после утверждения</span>}
        {stage.note && <p>{stage.note}</p>}
      </div>)}</td><td>{row.total_time ?? '—'}</td><td>{row.gap_to_leader ?? '—'}</td>
      <td>{row.penalty_total ?? '—'}{row.penalties.map((penalty, index) => <p key={index}>{penalty.time}{penalty.reason && ` · ${penalty.reason}`}{penalty.rule_reference && ` · ${penalty.rule_reference}`}</p>)}</td>
    </tr>)}</tbody>
  </table></div>;
}
export function ResultsScreen({ raceId, race, stageNumber, stageId, discipline, onSelect, mine = false }: {
  mine?: boolean; race?: RaceDetail; raceId: number; stageNumber: number | undefined; stageId: number | undefined; discipline: string;
  onSelect: (participantId: number, entryId: number) => void;
}) {
  const user = useUser();
  const results = useApi<Results>(query(`/races/${raceId}/results`, { stage: stageNumber, discipline }), 120000);
  const protocols = useApi<Protocols>(stageId === undefined ? null : `/stages/${stageId}/protocols`, 120000);
  const route = useRoute();
  const view = route.view || 'summaries';
  const participants = useApi<Participant[]>(view === 'summaries' ? query(`/races/${raceId}/participants`, {discipline}) : null);
  const participantById = new Map(participants.data?.map(person => [person.race_participant_id, person]));
  const me = useApi<Me>(user.id ? '/me' : null, 0, false);
  const own = me.data?.race_entries.find(entry => entry.race_id === raceId);
  const ownRow = results.data?.disciplines.flatMap(group => group.rows).find(row => row.race_participant_id === own?.race_participant_id && row.participant_id === me.data?.participant_id);
  const stageDetail = useApi<StageDetail>(stageId ? `/stages/${stageId}` : null);
  const publishedStage = results.data?.disciplines.some(group => group.stages.some(stage => stage.id === stageId));
  const pdf = stageId ? (stageDetail.data?.status === 'finished' || publishedStage ? stageDetail.data?.protocol_pdf_url : null) : race?.status === 'finished' ? race.protocol_pdf_url : null;
  return <section className="race-content results-page" aria-label="Результаты гонки">
    <nav className="content-tabs" aria-label="Вкладки результатов">{[['summaries','Итоги'],['protocol','Протокол'],['archive','Архив прошлых лет']].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => updateRoute({ view: key, albumId: undefined })}>{label}</button>)}</nav>
    {view === 'archive' ? <ArchiveScreen currentRaceId={raceId} /> : view === 'protocol' ? <><h2>Протокол результатов</h2><RequestState resource={stageDetail} />{externalUrl(pdf ?? null) ? <div className="venue-card"><a href={externalUrl(pdf!)} target="_blank" rel="noreferrer">Скачать протокол в формате .pdf</a><BookmarkButton item={{kind:'protocol',item_id:stageId ? `stage:${stageId}` : `race:${raceId}`,title:stageId ? `Протокол этапа ${stageNumber}` : 'Протокол гонки',url:pdf!,image_url:null}} /></div> : <p>PDF протокола пока не опубликован.</p>}<button className="text-action" onClick={() => updateRoute({ view: 'archive' })}>Архив протоколов прошлых лет</button></> : <>
    <h2 className="results-context-title">{stageNumber === undefined ? 'Общий зачёт' : `Зачёт после этапа ${stageNumber}`}</h2>
    <RequestState resource={results} /><RequestState resource={protocols} />
    <RequestState resource={me} />
    {ownRow && <OwnResult participant={participantById.get(ownRow.race_participant_id)} raceId={raceId} row={ownRow} stageId={stageId} onSelect={onSelect} />}
    {results.data && <>
      <details className="results-explanation"><summary>Об официальных результатах</summary><p className="supporting-text">Официальные результаты по опубликованным протоколам. {results.data.penalty_included_in_stage_times ? 'Штрафы уже включены во время этапов.' : 'Итоговое время рассчитано организаторами с учётом штрафов.'}</p></details>
      {results.data.disciplines.length === 0 && <DataState status="empty" />}
      {results.data.disciplines.map(group => <section key={group.discipline.id} className="discipline-results">
<h3>{results.data!.disciplines.length>1 ? group.discipline.name : stageId ? 'Итоги этапа' : 'Итоги гонки'}</h3><details className="protocol-details"><summary>Сведения о протоколе</summary>
        {group.stages.map(stage => <p key={stage.id}>Этап {stage.number}: {stage.is_final ? 'окончательный протокол' : 'предварительный протокол'}</p>)}
        {protocols.data?.protocols.filter(p => p.discipline.code === group.discipline.code).map(protocol => <div key={protocol.discipline.id} className="protocol-meta">
          {protocol.chief_judge && <p>Главный судья: {protocol.chief_judge}</p>}
          {protocol.chief_secretary && <p>Главный секретарь: {protocol.chief_secretary}</p>}
          {protocol.weather && <p>Погода: {protocol.weather}</p>}
        </div>)}
        </details>
        {group.rows.some(row => !mine || user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === row.race_participant_id)) ? <><ol className="results-cards">{group.rows.filter(row => !mine || user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === row.race_participant_id)).map(row => <li key={row.race_participant_id} className="venue-card" data-own={row.race_participant_id === ownRow?.race_participant_id}>{row.race_participant_id===ownRow?.race_participant_id && <span className="result-own-label">Вы</span>}<button className="result-row" aria-label={`${row.place ?? statusLabel(row.status)}. ${row.full_name}`} onClick={() => onSelect(row.participant_id, row.race_participant_id)}><span className="result-row__place">{row.place ?? '—'}.</span><img src={externalUrl(participantById.get(row.race_participant_id)?.photo_url ?? null) || '/participant-placeholder.svg'} alt=""/><span className="result-row__person"><strong>{row.full_name}</strong><small>{group.discipline.name}</small><small>№{row.start_number}</small></span><span className="result-row__time"><strong>{row.total_time ?? statusLabel(row.status)}</strong><Icon16Chevron aria-hidden/></span></button></li>)}</ol><details><summary>Подробная таблица</summary><StandingTable rows={group.rows.filter(row => !mine || user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === row.race_participant_id))} onSelect={onSelect} /></details></> : group.rows.length > 0 ? <p role="status">Среди опубликованных результатов нет поддерживаемых вами участников.</p> : <DataState status="empty" />}
      </section>)}
    </>}
    </>}
  </section>;
}

function OwnResult({ raceId, row, stageId, onSelect, participant }: { participant?:Participant; raceId: number; row: Standing; stageId?: number; onSelect: (person: number, entry: number) => void }) {
  const passes = useApi<CheckpointPass[]>(query(`/race-participants/${row.race_participant_id}/checkpoint-passes`, { stage_id: stageId }));
  const finish = passes.data?.filter(pass => pass.role === 'finish' && (stageId !== undefined ? pass.stage_id === stageId : row.stages.some(stage => stage.stage_number === pass.stage_number)))
    .sort((a,b) => Date.parse(b.arrived_at) - Date.parse(a.arrived_at))[0];
  return <section className="own-result"><h3>Мой результат</h3><div className="own-result__banner"><img src={externalUrl(participant?.photo_url ?? null) || '/participant-placeholder.svg'} alt=""/><div><strong>{row.full_name}</strong>{participant && <><small>{participant.discipline.name}</small><small className="own-result__fans"><Icon20LikeOutline width={16} height={16} aria-hidden/>{participant.supporters_count} болельщиков</small></>}</div><span>№{row.start_number}</span></div><div className="own-result__position"><span className="map-place">{row.place === null ? statusLabel(row.status) : `${row.place} место`}</span>{finish && <span className="own-result__finish">⚑ Финиш этапа {finish.stage_number} · {raceDate(finish.arrived_at)}, {raceTime(finish.arrived_at)}</span>}</div>
    <details className="own-result__checkpoints"><summary>Прохождение контрольных пунктов (КП)</summary><RequestState resource={passes} />{passes.data?.map(pass => <p key={pass.stage_checkpoint_id}>{pass.label || pass.name}: {raceDate(pass.arrived_at)} {raceTime(pass.arrived_at)}</p>)}{passes.data?.length === 0 && <p>Судейских отметок пока нет.</p>}<button className="text-action" onClick={() => updateRoute({ raceId, section: 'results', view: 'track', stageId, participantId: row.participant_id, entryId: row.race_participant_id })}>Мой трек</button></details>
    <button className="route-link" onClick={() => onSelect(row.participant_id, row.race_participant_id)}>Моя карточка</button>
  </section>;
}
function ArchiveScreen({ currentRaceId }: { currentRaceId: number }) {
  const route = useRoute();
  const races = useApi<Race[]>('/races');
  const albums = useApi<Albums>('/photos/albums');
  const archiveId = route.archiveRaceId;
  const archive = useApi<RaceDetail>(archiveId ? `/races/${archiveId}` : null);
  const photos = useApi<Photos>(route.albumId ? query('/photos', { album_id: route.albumId }) : null);
  return <section className="content-page"><h2>Архив прошлых лет</h2><RequestState resource={races} /><RequestState resource={albums} /><RequestState resource={archive} /><RequestState resource={photos} />
    {races.data?.filter(race => race.id !== currentRaceId).map(race => <button className="text-action" key={race.id} onClick={() => updateRoute({archiveRaceId:race.id})}>{race.name} · {race.year}</button>)}
    {archive.data && <div className="venue-card"><h3>{archive.data.name}</h3>{archive.data.status === 'finished' && externalUrl(archive.data.protocol_pdf_url) ? <a href={externalUrl(archive.data.protocol_pdf_url)} target="_blank" rel="noreferrer">Скачать архив протокола .pdf</a> : <p>PDF протокола пока не опубликован.</p>}<button className="text-action" onClick={() => updateRoute({raceId:archiveId,section:'results',view:'summaries',stageId:undefined,entryId:undefined,participantId:undefined})}>Открыть результаты сезона</button></div>}
    <h3>Альбомы изображений</h3>{albums.data?.stale && <p>Сохранённая версия альбомов VK</p>}{albums.data?.items.length === 0 && <p>Альбомы пока не опубликованы.</p>}{albums.data?.items.map(album => <button className="text-action album-link" key={album.id} onClick={() => updateRoute({albumId:album.id})}>{album.title || 'Фото гонки'} · {album.size}</button>)}
    {photos.data?.stale && <p>Сохранённая версия фото VK</p>}{photos.data?.days.length === 0 && <p>Фотографий пока нет.</p>}{photos.data?.days.map(day => <section key={day.date}><h4>{raceDate(day.date)}</h4><div className="photo-grid">{day.photos.map(photo => <a key={photo.id} href={externalUrl(photo.vk_url)} target="_blank" rel="noreferrer">{externalUrl(photo.url) && <img className="content-image" src={externalUrl(photo.url)} alt={photo.text || 'Фото гонки'} loading="lazy" />}{photo.text || 'Открыть фото в VK'}</a>)}</div></section>)}
  </section>;
}
