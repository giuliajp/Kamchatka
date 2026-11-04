import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ModalCard, SimpleCell, Search } from '@vkontakte/vkui';
import { RacePanelHeader } from '../components/RacePanelHeader';
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
import { StageMedia, type StageMediaViewModel } from '../screens/Map/StageMedia';
import { StageContent } from '../screens/Map/StageContent';
import { prepareMapData } from '../screens/Map/mapData';
import '../screens/Map/map.css';
import { NotificationPrompt } from '../components/NotificationPrompt';
import { useAction } from '../hooks/useAction';
import { Onboarding } from '../components/Onboarding';
import { TrackScreen } from '../screens/Content/TrackScreen';
import { MapLegend } from '../components/MapLegend';
import { useUser } from './UserProvider';
import { ProgramScreen } from '../screens/Content/ProgramScreen';
import { MoreScreen } from '../screens/Content/MoreScreen';
import './content.css';
import { closeRoute, updateRoute, navigateRace, readRaceLink, resolveParticipantLink, type RaceLink } from '../api/navigation';

export function currentStage(stages: Stage[], now = Date.now()) {
  const live = stages.filter(stage => stage.status === 'live');
  const started = stages.filter(stage => stage.start_at !== null && Date.parse(stage.start_at) <= now);
  return live.at(-1) ?? started.at(-1) ?? stages[0];
}
export function RaceApp({stageMedia}:{stageMedia?:Record<number,StageMediaViewModel>} = {}) {
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
  const [notification,setNotification] = useState<{number:number;photoUrl?:string}>();
  const [welcome, setWelcome] = useState(() => { try { return !localStorage.getItem('avacha:welcome'); } catch { return true; } });
  const dismissWelcome = () => { try { localStorage.setItem('avacha:welcome', '1'); } catch { /* Storage may be disabled in the webview. */ } setWelcome(false); };
  useEffect(() => { const update = () => setIncoming(readRaceLink()); window.addEventListener('popstate', update); window.addEventListener('hashchange', update); return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); }; }, []);
  const linkedStage = useApi<StageDetail>(!link.raceId && link.stageId ? `/stages/${link.stageId}` : null);
  const raceId = link.raceId ?? linkedStage.data?.race_id;
  const race = useApi<RaceDetail>(!link.raceId && link.stageId && !linkedStage.data ? null : raceId ? `/races/${raceId}` : '/races/current', 120000);
  const seasons = useApi<Race[]>('/races');
  if (needsLookup && resolved?.incoming !== incoming) return <main className="race-screen race-content"><p role="status">Открываем участника…</p></main>;
  if (!race.data) return <main className="race-screen race-content"><h1>Авача</h1><RequestState resource={linkedStage} /><RequestState resource={race} /></main>;
  return <><RaceView notification={notification} onNotificationRequest={setNotification} stageMedia={stageMedia} key={race.data.id} race={race.data} link={link} warning={<><RequestState resource={race} /><RequestState resource={linkedStage} />{resolved?.incoming === incoming && resolved.error && <p role="alert">{resolved.error}</p>}</>} season={<label className="season-select">Сезон<select value={race.data.id} onChange={event => navigateRace(`race=${event.target.value}`)}>{(seasons.data ?? [race.data]).map(season => <option key={season.id} value={season.id}>{season.year}</option>)}</select></label>} />
    {welcome && <Onboarding onFinish={dismissWelcome} />}
  </>;
}
function RaceView({ race, link, warning, season, stageMedia, notification, onNotificationRequest }: { notification?:{number:number;photoUrl?:string}; onNotificationRequest:(value:{number:number;photoUrl?:string}|undefined)=>void; stageMedia?:Record<number,StageMediaViewModel>; race: RaceDetail; link: RaceLink; warning: React.ReactNode; season: React.ReactNode }) {
  const user = useUser();
  const [search,setSearch] = useState('');
  const notificationAction = useAction();
  const [tab, setTab] = useState<'all' | 'mine'>(link.mine ? 'mine' : 'all');
  const [legend, setLegend] = useState(false);
  const supported = useMemo(() => user.supports.data?.filter(support => support.race_id === race.id).map(support => support.race_participant_id) ?? [], [user.supports.data, race.id]);
  const [section, setSection] = useState<RaceDestination>(link.section ?? 'map');
  const [stageId, setStageId] = useState<number | undefined>(link.stageId);
  const [allStages, setAllStages] = useState(Boolean(link.allStages || (link.section === 'results' && !link.stageId)));
  const [mapDiscipline, setMapDiscipline] = useState((!link.section || link.section === 'map') ? link.discipline ?? '' : '');
  const firstDiscipline = race.disciplines[0]?.code ?? '';
  const [participantDiscipline, setParticipantDiscipline] = useState(link.section === 'participants' ? link.discipline ?? firstDiscipline : firstDiscipline);
  const discipline = link.discipline ?? (section === 'participants' ? participantDiscipline : mapDiscipline);
  const setDiscipline = (value: string) => { if (section === 'map') setMapDiscipline(value); if (section === 'participants') setParticipantDiscipline(value); updateRoute({ raceId: race.id, section, discipline: value }); };
  const [selected, setSelected] = useState<{ participantId: number; entryId: number } | undefined>(link.view !== 'track' && link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined);
  useEffect(() => { setSection(link.section ?? 'map'); setAllStages(Boolean(link.allStages || (link.section === 'results' && !link.stageId))); setTab(link.mine ? 'mine' : 'all'); setCluster([]); setLegend(false); setStageId(link.stageId); setSelected(link.view !== 'track' && link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined); }, [link]);
  const linkedParticipants = useApi<Participant[]>(link.entryId && !link.participantId ? `/races/${race.id}/participants` : null);
  useEffect(() => { const found = linkedParticipants.data?.find(person => person.race_participant_id === link.entryId); if (found && link.view !== 'track') setSelected({ participantId: found.participant_id, entryId: found.race_participant_id }); }, [linkedParticipants.data, link.entryId, link.view]);
  const [cluster, setCluster] = useState<Position[]>([]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 1) { setSelected(undefined); if (readRaceLink().entryId) closeRoute({ entryId: undefined, participantId: undefined }); setCluster([]); setLegend(false); }
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
  const selectPerson = useCallback((participantId: number, entryId: number) => { setSelected({ participantId, entryId }); updateRoute({raceId:race.id,section,stageId:stage?.id,allStages:section === 'results' && allStages,participantId,entryId}); }, [race.id, section, stage?.id, allStages]);
  const selectMapPerson = useCallback((p: Position) => selectPerson(p.participant_id, p.race_participant_id), [selectPerson]);
  const chooseStage = (id: string) => {
    setAllStages(id === 'all');
    if (id !== 'all') setStageId(Number(id));
    updateRoute({ raceId: race.id, section, stageId: id === 'all' ? stage?.id : Number(id), allStages: id === 'all', entryId: undefined, participantId: undefined });
    setSelected(undefined); setCluster([]);
  };
  const leaders = discipline === '' ? race.disciplines.flatMap(d => mapped.filter(p => p.discipline.code === d.code && p.gps_rank === 1).map(p => ({ id: String(p.race_participant_id), number: String(p.start_number), label: d.name })))
    : mapped.filter(p => p.gps_rank !== null).sort((a, b) => a.gps_rank! - b.gps_rank!).slice(0, 3).map(p => ({ id: String(p.race_participant_id), number: String(p.start_number), label: p.full_name, place: p.gps_rank! }));
  const latestPosition = [...mapped].sort((a, b) => Date.parse(b.position!.position_at) - Date.parse(a.position!.position_at))[0];
  const latest = latestPosition?.position?.position_at;
  const threshold = positions.data?.stale_after_minutes ?? 45;
  const refresh = () => { positions.refresh(); detail.refresh(); track.refresh(); };
  const navigate = (value: RaceDestination) => { setSection(value); updateRoute({ raceId: race.id, section: value, allStages: false, stageId: stage?.id, discipline: value === 'map' ? mapDiscipline : value === 'participants' ? participantDiscipline : undefined, entryId: undefined, participantId: undefined, view: undefined, page: undefined, eventId: undefined, locationId: undefined, expanded: undefined, reminders: undefined, allEvents: undefined }); setSelected(undefined); setCluster([]); setLegend(false); };
  return <main data-section={section} className={stageScreen ? 'race-screen race-screen--stage' : 'race-screen'}>
    <div className="race-screen__header">{section === 'program' || section === 'more' ? <RacePanelHeader title={section === 'program' ? (link.allEvents ? 'Назад' : 'Программа') : link.page ? 'Назад' : race.name} onBack={() => section==='program' && link.allEvents ? closeRoute({allEvents:undefined}) : section==='more' && link.page ? updateRoute({page:undefined}) : navigate('map')}/> : <RaceHeader
      header={{ title: race.name, onBack: section === 'map' ? undefined : () => navigate('map') }}
      stage={{ value: section === 'results' && allStages ? 'all' : String(stage?.id ?? ''),
        options: [...(section === 'results' ? [{ value: 'all', label: 'Общий зачёт', details: 'все опубликованные этапы' }] : []), ...race.stages.map(stageOption)], onChange: chooseStage, disabled: race.stages.length === 0 }}
      beforeFilters={section === 'participants' && <Search className="participants-search" slotProps={{input:{'aria-label':'Поиск участника'}}} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Поиск по имени" />}
      filters={stageScreen ? undefined : { tab, discipline, options: [...(section === 'participants' ? [] : [{ value: '', label: 'все' }]), ...race.disciplines.map(d => ({ value: d.code, label: d.name }))],
        mineCount: supported.length, onTabChange: selectedTab => { setTab(selectedTab); updateRoute({raceId:race.id,section,mine:selectedTab === 'mine',entryId:undefined,participantId:undefined}); setSelected(undefined); }, onDisciplineChange: value => { setDiscipline(value); setSelected(undefined); setCluster([]); setLegend(false); }, showMine: Boolean(user.id) }} />}
    </div>
    {warning}<RequestState resource={linkedParticipants} />{tab === 'mine' && <RequestState resource={user.supports} />}
    {linkedParticipants.data && !linkedParticipants.data.some(person => person.race_participant_id === link.entryId) && <p role="status">Участник не найден в этом сезоне. Выберите другой сезон.</p>}
    <div id="race-data">
      {section === 'map' && <>
        {!stage && <div className="race-content"><h2>Этапы пока не объявлены</h2><p>Список появится после публикации организаторами.</p></div>}
        {stage && stage.status !== 'live' && <StageContent stage={stage} liveStage={race.stages.find(s => s.status === 'live')}
          onStage={id => chooseStage(String(id))} onResults={() => navigate('results')} />}
        <RequestState resource={detail} /><RequestState resource={positions} /><RequestState resource={track} />
        {detail.data && hasStageDetails && mapData && <>
          {stage?.status === 'live' && mapData.bounds.isValid() && !mapData.hasRoute && <p className="race-content" role="status">Маршрут пока не опубликован.</p>}
          {stage?.status === 'live' && positions.loading && !mapData.bounds.isValid() && detail.data.description && <p className="race-content">{detail.data.description}</p>}
          {stage?.status === 'live' && positions.data?.official_protocol_disciplines.length !== 0 && positions.data && <div className="race-content protocol-notice">
            <p>По дисциплинам {positions.data.official_protocol_disciplines.join(', ')} опубликован протокол. GPS-позиции скрыты.</p>
            <Button onClick={() => navigate('results')}>Открыть протокол</Button>
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
          {stage.status==='finished' && stageMedia?.[stage.id] && <StageMedia media={stageMedia[stage.id]}/>}
          {stage.status === 'finished' && <section className="race-content stage-route" aria-label="Маршрут завершённого этапа"><h2>Маршрут {stage.number} этапа</h2>
            {detail.data.description && <p>{detail.data.description}</p>}
            {mapData.bounds.isValid() ? <div className="stage-route__map"><MapCanvas data={mapData} viewKey={`route:${stage.id}`} threshold={threshold} onSelect={selectMapPerson} onCluster={setCluster} onRefresh={refresh} refreshing={detail.loading} /></div> : <p>Маршрут пока не опубликован.</p>}
          </section>}

        </>}
      </>}
      {section === 'program' && <ProgramScreen embedded key={race.id} raceId={race.id} race={race} />}
      {section === 'more' && <MoreScreen embedded key={race.id} race={race} season={season} />}
      {section === 'participants' && <ParticipantsScreen search={search} raceId={race.id} discipline={discipline} mine={tab === 'mine'} onSelect={selectPerson} />}
      {section === 'results' && link.view === 'track' && link.entryId ? <TrackScreen race={race} stageId={stage?.id} entryId={link.entryId} /> : section === 'results' && <ResultsScreen race={race} raceId={race.id} discipline={discipline} mine={tab === 'mine'} stageId={allStages ? undefined : stage?.id} stageNumber={allStages ? undefined : stage?.number} onSelect={selectPerson} />}
    </div>
    <footer className="race-screen__footer"><RaceTabbar value={section} onChange={navigate} /></footer>
    {selected && <ParticipantSheet raceId={race.id} key={selected.entryId} {...selected} position={selectedPosition} threshold={threshold} stage={section === 'results' && allStages ? undefined : detail.data ?? stage} showOfficial={section === 'results'} onNotificationRequest={section === 'map' ? onNotificationRequest : undefined} onClose={() => { setSelected(undefined); closeRoute({entryId:undefined,participantId:undefined}); }} />}
    <MapLegend open={legend} onClose={() => setLegend(false)} description={detail.data?.description ?? undefined} />
    {notification && !selected && <NotificationPrompt open number={String(notification.number)} photoUrl={notification.photoUrl} loading={notificationAction.busy} onConfirm={()=>{void notificationAction.run(()=>user.setNotifications(true)).then(ok=>{if(ok)onNotificationRequest(undefined);});}} onLater={()=>onNotificationRequest(undefined)} onClose={()=>onNotificationRequest(undefined)} error={notificationAction.error}/>}

    <ModalCard dismissButtonMode="inside" open={cluster.length > 0} onClose={() => setCluster([])} title="Участники рядом" aria-label="Участники рядом" dismissLabel="Закрыть список">
      {cluster.map(p => <SimpleCell key={p.race_participant_id} Component="button" className="race-native-action" onClick={() => { setCluster([]); selectMapPerson(p); }}>{p.full_name} · №{p.start_number}</SimpleCell>)}
    </ModalCard>
  </main>;
}
