import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ModalCard, SimpleCell } from '@vkontakte/vkui';
import { RaceHeader } from '../../components/RaceHeader';
import { RaceTabbar, type RaceDestination } from '../../components/RaceTabbar';
import { TopParticipantsCard } from '../../components/TopParticipantsCard';
import { TimeBadge } from '../../components/TimeBadge';
import { ParticipantSheet } from '../../components/ParticipantSheet';
import { RequestState } from '../../components/RequestState';
import { useApi } from '../../hooks/useApi';
import { query } from '../../api/client';
import { raceTime, stageOption, stale } from '../../api/format';
import type { Position, Positions, RaceDetail, Stage, StageDetail, Track } from '../../types/api';
import { ParticipantsScreen } from '../Participants/ParticipantsScreen';
import { ResultsScreen } from '../Results/ResultsScreen';
import { MapCanvas } from './MapCanvas';
import { StageContent } from './StageContent';
import { prepareMapData } from './mapData';
import './map.css';
import { MapLegend } from '../../components/MapLegend';
import { mockFeaturesEnabled, participationKey, useExtras } from '../../mocks/extras';
import { readRaceLink, type RaceLink } from '../../api/navigation';

export function currentStage(stages: Stage[], now = Date.now()) {
  const live = stages.filter(stage => stage.status === 'live');
  const started = stages.filter(stage => stage.start_at !== null && Date.parse(stage.start_at) <= now);
  return live.at(-1) ?? started.at(-1) ?? stages[0];
}
export function MapScreen() {
  const [link, setLink] = useState(readRaceLink);
  useEffect(() => { const update = () => setLink(readRaceLink()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const race = useApi<RaceDetail>(link.raceId ? `/races/${link.raceId}` : '/races/current', 120000);
  if (!race.data) return <main className="race-screen race-content"><h1>Авача</h1><RequestState resource={race} /></main>;
  return <RaceView key={race.data.id} race={race.data} link={link} warning={<RequestState resource={race} />} />;
}
function RaceView({ race, link, warning }: { race: RaceDetail; link: RaceLink; warning: React.ReactNode }) {
  const { value } = useExtras();
  const enabled = mockFeaturesEnabled();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [legend, setLegend] = useState(false);
  const [feedback, setFeedback] = useState('');
  const supported = useMemo(() => (enabled ? value.supported : []).filter(key => key.startsWith(`${race.id}:`)).map(key => Number(key.split(':')[1])), [value.supported, race.id, enabled]);
  const [section, setSection] = useState<RaceDestination>('map');
  const [stageId, setStageId] = useState<number | undefined>(link.stageId);
  const [allStages, setAllStages] = useState(false);
  const [discipline, setDiscipline] = useState('');
  const [selected, setSelected] = useState<{ participantId: number; entryId: number } | undefined>(link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined);
  useEffect(() => { setSection('map'); setAllStages(false); setTab('all'); setDiscipline(''); setCluster([]); setLegend(false); setFeedback(''); setStageId(link.stageId); setSelected(link.participantId && link.entryId ? { participantId: link.participantId, entryId: link.entryId } : undefined); }, [link]);
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
  const visible = useMemo(() => positions.data?.participants.filter(p => !positions.data!.official_protocol_disciplines.includes(p.discipline.code) && (tab === 'all' || value.supported.includes(participationKey(race.id, p.race_participant_id)))) ?? [], [positions.data, tab, value.supported, race.id]);
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
  const navigate = (value: RaceDestination) => { if (value === 'program' || value === 'more') { setFeedback(value === 'program' ? 'Раздел «Программа» пока не реализован.' : 'Раздел «Ещё» пока не реализован.'); return; } setSection(value); setSelected(undefined); setCluster([]); setLegend(false); };
  return <main className={stageScreen ? 'race-screen race-screen--stage' : 'race-screen'}>
    <div className="race-screen__header"><RaceHeader
      header={{ title: race.name, onBack: section === 'map' ? undefined : () => navigate('map') }}
      stage={{ value: section === 'results' && allStages ? 'all' : String(stage?.id ?? ''),
        options: [...(section === 'results' ? [{ value: 'all', label: 'Общий зачёт', details: 'все опубликованные этапы' }] : []), ...race.stages.map(stageOption)], onChange: chooseStage, disabled: race.stages.length === 0 }}
      filters={stageScreen ? undefined : { tab, discipline, options: [{ value: '', label: 'все' }, ...race.disciplines.map(d => ({ value: d.code, label: d.name }))],
        mineCount: supported.length, onTabChange: selectedTab => { setTab(selectedTab); setSelected(undefined); }, onDisciplineChange: value => { setDiscipline(value); setSelected(undefined); setCluster([]); setLegend(false); }, showMine: enabled }} />
    </div>
    {warning}
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
      {section === 'participants' && <ParticipantsScreen raceId={race.id} discipline={discipline} mine={tab === 'mine'} onSelect={selectPerson} />}
      {section === 'results' && <ResultsScreen raceId={race.id} discipline={discipline} mine={tab === 'mine'} stageId={allStages ? undefined : stage?.id} stageNumber={allStages ? undefined : stage?.number} onSelect={selectPerson} />}
    </div>
    <footer className="race-screen__footer"><RaceTabbar value={section} onChange={navigate} /></footer>
    {selected && <ParticipantSheet raceId={race.id} key={selected.entryId} {...selected} position={selectedPosition} threshold={threshold} stage={section === 'results' && allStages ? undefined : detail.data ?? stage} showOfficial={section === 'results'} onClose={() => setSelected(undefined)} />}
    <MapLegend open={legend} onClose={() => setLegend(false)} />
    <ModalCard dismissButtonMode="inside" open={Boolean(feedback)} onClose={() => setFeedback('')} title="Информация" aria-label="Информация" dismissLabel="Закрыть сообщение"><p>{feedback}</p></ModalCard>
    <ModalCard dismissButtonMode="inside" open={cluster.length > 0} onClose={() => setCluster([])} title="Участники рядом" aria-label="Участники рядом" dismissLabel="Закрыть список">
      {cluster.map(p => <SimpleCell key={p.race_participant_id} Component="button" className="race-native-action" onClick={() => { setCluster([]); selectMapPerson(p); }}>{p.full_name} · №{p.start_number}</SimpleCell>)}
    </ModalCard>
  </main>;
}
