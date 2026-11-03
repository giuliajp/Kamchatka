import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ModalCard, SimpleCell } from '@vkontakte/vkui';
import { RaceHeader } from '../components/RaceHeader';
import { RaceTabbar, type RaceDestination } from '../components/RaceTabbar';
import { TopParticipantsCard } from '../components/TopParticipantsCard';
import { TimeBadge } from '../components/TimeBadge';
import { ParticipantSheet } from '../components/ParticipantSheet';
import { RequestState } from '../components/RequestState';
import { useApi } from '../hooks/useApi';
import { query } from '../api/client';
import { raceTime, stageOption, stale } from '../api/format';
import type { Participant, Position, Positions, Race, RaceDetail, Stage, StageDetail, Track } from '../types/api';
import { ParticipantsScreen } from '../screens/Participants/ParticipantsScreen';
import { ResultsScreen } from '../screens/Results/ResultsScreen';
import { MapCanvas } from '../screens/Map/MapCanvas';
import { StageContent } from '../screens/Map/StageContent';
import { prepareMapData } from '../screens/Map/mapData';
import '../screens/Map/map.css';
import { MapLegend } from '../components/MapLegend';
import { useUser } from './UserProvider';
import { ProgramScreen } from '../screens/Content/ProgramScreen';
import { MoreScreen } from '../screens/Content/MoreScreen';
import './content.css';
import { navigateRace, readRaceLink, resolveParticipantLink, type RaceLink } from '../api/navigation';

export function currentStage(stages: Stage[], now = Date.now()) {
  const live = stages.filter(stage => stage.status === 'live');
  const started = stages.filter(stage => stage.start_at !== null && Date.parse(stage.start_at) <= now);
  return live.at(-1) ?? started.at(-1) ?? stages[0];
}
export function RaceApp() {
  const [incoming, setIncoming] = useState(readRaceLink);
  const [resolved, setResolved] = useState<{ incoming: RaceLink; link?: RaceLink; error?: string }>();
  const needsLookup = Boolean(incoming.entryId && !incoming.raceId);
  useEffect(() => {
    if (!incoming.entryId || incoming.raceId) return;
    const controller = new AbortController();
    void resolveParticipantLink(incoming.entryId, controller.signal).then(link => { if (!controller.signal.aborted) setResolved({ incoming, link }); }).catch(error => { if (!controller.signal.aborted) setResolved({ incoming, error: error instanceof Error ? error.message : 'Не удалось открыть ссылку' }); });
    return () => controller.abort();
  }, [incoming]);
  const link = useMemo(() => resolved?.incoming === incoming && resolved.link ? { ...incoming, ...resolved.link } : incoming, [incoming, resolved]);
  const [welcome, setWelcome] = useState(() => { try { return !localStorage.getItem('avacha:welcome'); } catch { return true; } });
  const dismissWelcome = () => { try { localStorage.setItem('avacha:welcome', '1'); } catch { /* Storage may be disabled in the webview. */ } setWelcome(false); };
  useEffect(() => { const update = () => setIncoming(readRaceLink()); window.addEventListener('popstate', update); window.addEventListener('hashchange', update); return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); }; }, []);
  const linkedStage = useApi<StageDetail>(!link.raceId && link.stageId ? `/stages/${link.stageId}` : null);
  const raceId = link.raceId ?? linkedStage.data?.race_id;
  const race = useApi<RaceDetail>(!link.raceId && link.stageId && !linkedStage.data ? null : raceId ? `/races/${raceId}` : '/races/current', 120000);
  const seasons = useApi<Race[]>('/races');
  if (needsLookup && resolved?.incoming !== incoming) return <main className="race-screen race-content"><p role="status">Открываем участника…</p></main>;
  if (!race.data) return <main className="race-screen race-content"><h1>Авача</h1><RequestState resource={linkedStage} /><RequestState resource={race} /></main>;
  return <><RaceView key={race.data.id} race={race.data} link={link} warning={<><RequestState resource={race} /><RequestState resource={linkedStage} />{resolved?.incoming === incoming && resolved.error && <p role="alert">{resolved.error}</p>}</>} season={<label className="season-select">Сезон<select value={race.data.id} onChange={event => navigateRace(`race=${event.target.value}`)}>{(seasons.data ?? [race.data]).map(season => <option key={season.id} value={season.id}>{season.year}</option>)}</select></label>} />
    <ModalCard open={welcome} onClose={dismissWelcome} title="Добро пожаловать в Авачу" aria-label="Первый запуск" dismissLabel="Закрыть знакомство" dismissButtonMode="inside">
      <p>Следите за гонкой на карте, болейте за участников и смотрите официальные результаты.</p><p>Время в приложении указано по Камчатке. GPS показывает положение на маршруте; итоговые места определяет судейский протокол.</p>
      <Button size="l" onClick={dismissWelcome}>Начать</Button>
    </ModalCard>
  </>;
}
function RaceView({ race, link, warning, season }: { race: RaceDetail; link: RaceLink; warning: React.ReactNode; season: React.ReactNode }) {
  const user = useUser();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [legend, setLegend] = useState(false);
  const supported = useMemo(() => user.supports.data?.filter(support => support.race_id === race.id).map(support => support.race_participant_id) ?? [], [user.supports.data, race.id]);
  const [section, setSection] = useState<RaceDestination>(link.section ?? 'map');
  const [stageId, setStageId] = useState<number | undefined>(link.stageId);
  const [allStages, setAllStages] = useState(link.section === 'results');
  const [discipline, setDiscipline] = useState('');
  const [selected, setSelected] = useState<{ participantId: number; entryId: number } | undefined>(link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined);
  useEffect(() => { setSection(link.section ?? 'map'); setAllStages(link.section === 'results'); setTab('all'); setDiscipline(''); setCluster([]); setLegend(false); setStageId(link.stageId); setSelected(link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined); }, [link]);
  const linkedParticipants = useApi<Participant[]>(link.entryId && !link.participantId ? `/races/${race.id}/participants` : null);
  useEffect(() => { const found = linkedParticipants.data?.find(person => person.race_participant_id === link.entryId); if (found) setSelected({ participantId: found.participant_id, entryId: found.race_participant_id }); }, [linkedParticipants.data, link.entryId]);
  const [cluster, setCluster] = useState<Position[]>([]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 1) { setSelected(undefined); setCluster([]); setLegend(false); }
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, []);
  const stage = race.stages.find(s => s.id === stageId) ?? currentStage(race.stages);
  const stageScreen = section === 'map' && stage && stage.status !== 'live';
  const positions = useApi<Positions>(section === 'map' && stage?.status === 'live' ? query(`/races/${race.id}/positions`, { stage: stage.number, discipline }) : null, 120000);
  const hasStageDetails = stage?.status === 'live' || stage?.status === 'finished';
  const detail = useApi<StageDetail>((section === 'map' && hasStageDetails) || (selected && stage) ? `/stages/${stage.id}` : null, 120000);
  const visible = useMemo(() => positions.data?.participants.filter(p => !positions.data!.official_protocol_disciplines.includes(p.discipline.code) && (tab === 'all' || supported.includes(p.race_participant_id))) ?? [], [positions.data, tab, supported]);
  const mapData = useMemo(() => detail.data ? prepareMapData(detail.data, visible) : undefined, [detail.data, visible]);
  const mapped = mapData?.participants ?? [];
  const selectedPosition = visible.find(p => p.race_participant_id === selected?.entryId && p.participant_id === selected.participantId);
  const track = useApi<Track>(section === 'map' && selectedPosition && stage ? query(`/race-participants/${selectedPosition.race_participant_id}/track`, { stage: stage.number }) : null, 120000, false);
  const selectPerson = useCallback((participantId: number, entryId: number) => setSelected({ participantId, entryId }), []);
  const selectMapPerson = useCallback((p: Position) => selectPerson(p.participant_id, p.race_participant_id), [selectPerson]);
  const chooseStage = (id: string) => {
    setAllStages(id === 'all');
    if (id !== 'all') setStageId(Number(id));
    setSelected(undefined); setCluster([]);
  };
  const leaders = discipline === '' ? race.disciplines.flatMap(d => mapped.filter(p => p.discipline.code === d.code && p.gps_rank === 1).map(p => ({ id: String(p.race_participant_id), number: String(p.start_number), label: d.name })))
    : mapped.filter(p => p.gps_rank !== null).sort((a, b) => a.gps_rank! - b.gps_rank!).slice(0, 3).map(p => ({ id: String(p.race_participant_id), number: String(p.start_number), label: p.full_name, place: p.gps_rank! }));
  const latestPosition = [...mapped].sort((a, b) => Date.parse(b.position!.position_at) - Date.parse(a.position!.position_at))[0];
  const latest = latestPosition?.position?.position_at;
  const threshold = positions.data?.stale_after_minutes ?? 45;
  const refresh = () => { positions.refresh(); detail.refresh(); track.refresh(); };
  const navigate = (value: RaceDestination) => { setSection(value); setSelected(undefined); setCluster([]); setLegend(false); };
  return <main className={stageScreen ? 'race-screen race-screen--stage' : 'race-screen'}>
    <div className="race-screen__header">{season}<RaceHeader
      header={{ title: race.name, onBack: section === 'map' ? undefined : () => navigate('map') }}
      stage={{ value: section === 'results' && allStages ? 'all' : String(stage?.id ?? ''),
        options: [...(section === 'results' ? [{ value: 'all', label: 'Общий зачёт', details: 'все опубликованные этапы' }] : []), ...race.stages.map(stageOption)], onChange: chooseStage, disabled: race.stages.length === 0 }}
      filters={stageScreen || section === 'program' || section === 'more' ? undefined : { tab, discipline, options: [{ value: '', label: 'все' }, ...race.disciplines.map(d => ({ value: d.code, label: d.name }))],
        mineCount: supported.length, onTabChange: selectedTab => { setTab(selectedTab); setSelected(undefined); }, onDisciplineChange: value => { setDiscipline(value); setSelected(undefined); setCluster([]); setLegend(false); }, showMine: Boolean(user.id) }} />
    </div>
    {warning}<RequestState resource={linkedParticipants} />{tab === 'mine' && <RequestState resource={user.supports} />}
    {linkedParticipants.data && !linkedParticipants.data.some(person => person.race_participant_id === link.entryId) && <p role="status">Участник не найден в этом сезоне. Выберите другой сезон.</p>}
    <div id="race-data">
      {section === 'map' && <>
        {!stage && <div className="race-content"><h2>Этапы пока не объявлены</h2><p>Список появится после публикации организаторами.</p></div>}
        {stage && stage.status !== 'live' && <StageContent stage={stage} liveStage={race.stages.find(s => s.status === 'live')}
          onStage={id => chooseStage(String(id))} onResults={() => { setAllStages(false); setSection('results'); }} />}
        <RequestState resource={detail} /><RequestState resource={positions} /><RequestState resource={track} />
        {detail.data && hasStageDetails && mapData && <>
          {stage?.status === 'live' && positions.data?.official_protocol_disciplines.length !== 0 && positions.data && <div className="race-content protocol-notice">
            <p>По дисциплинам {positions.data.official_protocol_disciplines.join(', ')} опубликован протокол. GPS-позиции скрыты.</p>
            <Button onClick={() => { setAllStages(false); setSection('results'); }}>Открыть протокол</Button>
          </div>}
          {stage.status === 'live' && mapData.bounds.isValid() ? <section className="race-screen__map" aria-label="Маршрут и позиции участников">
            <MapCanvas data={mapData} viewKey={`${stage.id}:${discipline}:${tab}:${detail.data.route_updated_at}:${mapData.hasRoute}:${mapData.checkpoints.length}`} threshold={threshold} track={track.data} onSelect={selectMapPerson} onCluster={setCluster} onRefresh={refresh} onLegend={() => setLegend(true)} supported={supported} refreshing={positions.loading || detail.loading} />
            {leaders.length > 0 && <div className="map-leaders-slot"><TopParticipantsCard compact title={discipline === '' ? 'Лидеры по GPS в дисциплинах' : 'Топ-3 по GPS в дисциплине'} entries={leaders}
              onSelect={id => selectMapPerson(visible.find(p => p.race_participant_id === Number(id))!)} /></div>}
            {stage.status === 'live' && positions.data && tab === 'all' && !latest && (positions.data.official_protocol_disciplines.length === 0 || visible.length > 0) && <div className="map-empty"><h2>Положения отсутствуют</h2><p>Координаты появятся после получения данных трекеров.</p></div>}
            {tab === 'mine' && mapped.length === 0 && <div className="map-empty"><h2>{supported.length ? 'У ваших участников пока нет координат' : 'Вы пока ни за кого не болеете'}</h2><p>Выберите участника во вкладке «Дисциплина: все» и нажмите «Болею за».</p></div>}
            {latest && <div className="map-time"><TimeBadge state={stale(latestPosition, threshold) ? 'stale' : 'position'}>{stale(latestPosition, threshold) ? 'Последняя подтверждённая точка' : 'Положение'} на {raceTime(latest)} (Камчатка)</TimeBadge></div>}
          </section> : stage.status === 'live' && !mapData.bounds.isValid() && positions.data && <div className="race-content map-unavailable" role="status">
            <p>Маршрут пока не опубликован.</p>
            {tab === 'mine' && <p>У поддерживаемых участников пока нет подтверждённых координат.</p>}
            {positions.data.official_protocol_disciplines.length === 0 && <p>Положения отсутствуют. Координаты появятся после получения данных трекеров.</p>}
          </div>}
          {stage.status === 'finished' && <section className="race-content stage-route" aria-label="Маршрут завершённого этапа"><h2>Маршрут {stage.number} этапа</h2>
            {detail.data.description && <p>{detail.data.description}</p>}
            {mapData.bounds.isValid() ? <div className="stage-route__map"><MapCanvas data={mapData} viewKey={`route:${stage.id}`} threshold={threshold} onSelect={selectMapPerson} onCluster={setCluster} onRefresh={refresh} refreshing={detail.loading} /></div> : <p>Маршрут пока не опубликован.</p>}
          </section>}
          {stage.status === 'live' && (detail.data.description || mapData.bounds.isValid()) && <div className="race-content route-description">
            {detail.data.description && <p>{detail.data.description}</p>}
            {mapData.bounds.isValid() && <>
              {!mapData.hasRoute && <p>Маршрут пока не опубликован.</p>}
              <p>Время указано по Камчатке (UTC+12). Позиции GPS не являются официальными результатами.</p>
            </>}
          </div>}
        </>}
      </>}
      {section === 'program' && <ProgramScreen key={race.id} raceId={race.id} />}
      {section === 'more' && <MoreScreen key={race.id} race={race} />}
      {section === 'participants' && <ParticipantsScreen raceId={race.id} discipline={discipline} mine={tab === 'mine'} onSelect={selectPerson} />}
      {section === 'results' && <ResultsScreen raceId={race.id} discipline={discipline} mine={tab === 'mine'} stageId={allStages ? undefined : stage?.id} stageNumber={allStages ? undefined : stage?.number} onSelect={selectPerson} />}
    </div>
    <footer className="race-screen__footer"><RaceTabbar value={section} onChange={navigate} /></footer>
    {selected && <ParticipantSheet raceId={race.id} key={selected.entryId} {...selected} position={selectedPosition} threshold={threshold} stage={section === 'results' && allStages ? undefined : detail.data ?? stage} showOfficial={section === 'results'} onClose={() => setSelected(undefined)} />}
    <MapLegend open={legend} onClose={() => setLegend(false)} />
    <ModalCard dismissButtonMode="inside" open={cluster.length > 0} onClose={() => setCluster([])} title="Участники рядом" aria-label="Участники рядом" dismissLabel="Закрыть список">
      {cluster.map(p => <SimpleCell key={p.race_participant_id} Component="button" className="race-native-action" onClick={() => { setCluster([]); selectMapPerson(p); }}>{p.full_name} · №{p.start_number}</SimpleCell>)}
    </ModalCard>
  </main>;
}
