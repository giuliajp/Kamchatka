import { useEffect, useEffectEvent, useState } from 'react';
import { Button, ModalCard, SimpleCell } from '@vkontakte/vkui';
import { RaceHeader } from '../../components/RaceHeader';
import { RaceTabbar } from '../../components/RaceTabbar';
import { TopParticipantsCard } from '../../components/TopParticipantsCard';
import { TimeBadge } from '../../components/TimeBadge';
import { ParticipantSheet } from '../../components/ParticipantSheet';
import { NotificationPrompt } from '../../components/NotificationPrompt';
import { DataState } from '../../components/DataState';
import { MapCanvas } from './MapCanvas';
import { StageContent } from './StageContent';
import { disciplines, liveStage, participants, race, raceTime, readPreferences, route, stageOptions, stages, writePreferences, type Preferences } from './demo';
import './map.css';

const disciplineOptions = [{ value: 'all', label: 'все' }, ...disciplines.map(d => ({ value: String(d.id), label: d.name }))];
const disciplineLeaders = disciplines.flatMap(d => participants.filter(p => p.discipline_id === d.id && p.place === 1)
  .map(p => ({ id: String(p.id), number: String(p.start_number), label: d.name })));

export interface MapScreenProps {
  initialStage?: number; initialDiscipline?: string; initialTab?: 'all' | 'mine';
  initialParticipant?: number; initialExpanded?: boolean; initialGalleryExpanded?: boolean;
  initialPrompt?: number; initialSupported?: number[];
  scenario?: 'ready' | 'loading' | 'error' | 'empty' | 'stale' | 'offline';
  now?: number; persist?: boolean;
}
export function MapScreen({ initialStage = liveStage.id, initialDiscipline = 'all', initialTab = 'all', initialParticipant,
  initialExpanded = false, initialGalleryExpanded = false, initialPrompt, initialSupported,
  scenario = 'ready', now, persist = true }: MapScreenProps) {
  const [stageId, setStageId] = useState(initialStage);
  const [discipline, setDiscipline] = useState(initialDiscipline);
  const [tab, setTab] = useState(initialTab);
  const [selected, setSelected] = useState(initialParticipant);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [cluster, setCluster] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [state, setState] = useState(scenario);
  const [offline, setOffline] = useState(scenario === 'offline' || !navigator.onLine);
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const saved = persist ? readPreferences() : { supported: [], prompted: [], notifications: [] };
    return { ...saved, supported: initialSupported ?? saved.supported };
  });
  useEffect(() => {
    const disconnected = () => setOffline(true);
    const connected = () => setOffline(false);
    window.addEventListener('offline', disconnected); window.addEventListener('online', connected);
    return () => { window.removeEventListener('offline', disconnected); window.removeEventListener('online', connected); };
  }, []);
  const save = (next: Preferences) => {
    setPreferences(next);
    if (persist && !writePreferences(next)) setFeedback('Не удалось сохранить выбор. Он действует до закрытия страницы.');
  };
  const unavailable = () => setFeedback('Это действие недоступно в демонстрации. API и функции VK ещё не подключены.');
  const refresh = () => { setState('ready'); setFeedback('Показан демонстрационный набор. Новые координаты с сервера не запрашивались.'); };
  const chooseStage = (value = String(liveStage.id)) => { setStageId(Number(value)); setSelected(undefined); setCluster([]); };
  const support = (id: number) => {
    const supported = preferences.supported.includes(id);
    save({ ...preferences, supported: supported ? preferences.supported.filter(v => v !== id) : [...preferences.supported, id],
      notifications: supported ? preferences.notifications.filter(v => v !== id) : preferences.notifications });
    if (!supported && !preferences.prompted.includes(id)) { setSelected(undefined); setPrompt(id); }
  };
  const finishPrompt = (notify: boolean) => {
    const id = prompt!;
    save({ ...preferences, prompted: [...preferences.prompted, id], notifications: notify ? [...preferences.notifications, id] : preferences.notifications });
    setPrompt(undefined);
    if (notify) setFeedback('Выбор сохранён только для демонстрации. Настоящие push-уведомления не отправляются.');
  };
  // Also close when a demo message temporarily holds focus outside the VKUI modal.
  const close = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    setSelected(undefined); setCluster([]); setFeedback('');
    if (prompt !== undefined) finishPrompt(false);
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => close(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const stage = stages.find(s => s.id === stageId) ?? liveStage;
  const participant = participants.find(p => p.id === selected);
  const participantDiscipline = participant ? disciplines.find(d => d.id === participant.discipline_id)!.name : '';
  const participantSupported = participant !== undefined && preferences.supported.includes(participant.id);
  const promptParticipant = participants.find(p => p.id === prompt);
  const disciplineParticipants = participants.filter(p => discipline === 'all' || String(p.discipline_id) === discipline);
  const visible = state === 'empty' ? [] : tab === 'mine' ? participants.filter(p => preferences.supported.includes(p.id)) : disciplineParticipants;
  const showDisciplineLeaders = discipline === 'all' || tab === 'mine';
  const leaders = showDisciplineLeaders
    ? disciplineLeaders
    : [...disciplineParticipants].sort((a, b) => a.place - b.place).slice(0, 3).map(p => ({ id: String(p.id), number: String(p.start_number), label: p.name, place: p.place }));
  const note = (label: string) => setFeedback(label + '. Демонстрационные отметки; официальные результаты публикуются отдельно.');
  return <main className="race-screen">
    <div className="race-screen__header"><RaceHeader
      header={{ title: race.name, onBack: () => chooseStage(), onMenu: () => setFeedback('Демонстрационные данные. Карта и фотографии из Figma; время — Камчатка (UTC+12). Поддержка хранится в этом браузере.'), onClose: unavailable }}
      stage={{ value: String(stage.id), options: stageOptions, onChange: chooseStage }}
      filters={stage.status === 'live' ? { tab, discipline, options: disciplineOptions, mineCount: preferences.supported.length, onTabChange: setTab, onDisciplineChange: setDiscipline } : undefined} />
    </div>
    {stage.status === 'live' ? <section className="race-screen__map" aria-label="Трансляция гонки">
      {state === 'loading' || state === 'error' ? <div className="map-state"><DataState status={state} onRetry={refresh} />{state === 'loading' && <Button onClick={refresh}>Показать демоданные</Button>}</div> : <>
        <MapCanvas participants={visible} supported={preferences.supported} stale={state === 'stale'} onSelect={setSelected} onCluster={setCluster} onCheckpoint={note} onRefresh={refresh} />
        {visible.length > 0 ? <div className="map-leaders-slot"><TopParticipantsCard compact title={showDisciplineLeaders ? 'Лидеры по дисциплинам' : 'Топ-3 по дисциплине'} entries={leaders} onSelect={id => setSelected(Number(id))} /></div>
          : <div className="map-empty" role="status"><h2>{tab === 'mine' ? 'Вы пока ни за кого не болеете' : 'Положения отсутствуют'}</h2><p>{tab === 'mine' ? 'Выберите участника на карте и нажмите «Болею за».' : 'Координаты появятся после получения данных трекеров.'}</p>{tab === 'mine' && <Button onClick={() => setTab('all')}>Все участники</Button>}</div>}
        <div className="map-time"><TimeBadge state={offline ? 'offline' : state === 'empty' ? 'unavailable' : state === 'stale' ? 'stale' : 'position'} onRetry={refresh}>
          {offline ? 'Нет соединения. Сохранённые данные на 14:36' : state === 'empty' ? 'Положения отсутствуют' : state === 'stale' ? 'Обновлено 48 минут назад' : 'Положение на 14:36'}
        </TimeBadge></div>
      </>}
    </section> : <StageContent key={stage.id} stage={stage} now={now} galleryExpanded={initialGalleryExpanded} onLive={() => chooseStage()} onUnavailable={unavailable} />}
    <footer className="race-screen__footer"><RaceTabbar value="map" onChange={destination => destination === 'map' ? chooseStage() : unavailable()} /><small>Демонстрационные данные</small></footer>
    {participant && <ParticipantSheet key={participant.id} open onClose={() => setSelected(undefined)} onShare={unavailable}
      participant={{ name: participant.name, number: participant.start_number, region: participant.region, discipline: participantDiscipline,
        photoUrl: participant.photoUrl, supported: participantSupported, onSupportToggle: () => support(participant.id) }}
      position={{ place: participant.place, gap: participant.gap }}
      details={{ disciplineLabel: participantDiscipline, biography: participant.biography, supporters: participant.supporters + Number(participantSupported), speed: participant.speed, distance: participant.distance, expanded: initialExpanded }}
      freshness={[{ state: participant.position.stale || state === 'stale' ? 'stale' : 'position', children: 'Положение на ' + raceTime(participant.position.position_at) }]}
      route={route.map(point => ({ ...point, onSelect: () => note(point.title) }))} />}
    {promptParticipant && <NotificationPrompt open number={String(promptParticipant.start_number)} photoUrl={promptParticipant.photoUrl} onConfirm={() => finishPrompt(true)} onLater={() => finishPrompt(false)} onClose={() => finishPrompt(false)} demo />}
    <ModalCard open={cluster.length > 0} onClose={() => setCluster([])} title="Участники рядом" aria-label="Участники рядом" dismissLabel="Закрыть список">
      {participants.filter(p => cluster.includes(p.id)).map(p => <SimpleCell key={p.id} Component="button" className="race-native-action" onClick={() => { setCluster([]); setSelected(p.id); }}>{p.name} · №{p.start_number}</SimpleCell>)}
    </ModalCard>
    {feedback && <div className="map-feedback" role="status"><span>{feedback}</span><Button size="s" mode="tertiary" aria-label="Закрыть сообщение" onClick={() => setFeedback('')}>Понятно</Button></div>}
  </main>;
}
