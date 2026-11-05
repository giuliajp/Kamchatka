import bridge from '@vkontakte/vk-bridge';
import { request } from './client';
import type { Participant, Race } from '../types/api';
export interface RaceLink { raceId?: number; stageId?: number; participantId?: number; entryId?: number; section?: 'map' | 'results' | 'participants' | 'program' | 'more'; page?: string; photo?: string; view?: string; day?: string; category?: string; eventId?: number; locationId?: number; albumId?: number; archiveRaceId?: number; expanded?: boolean; reminders?: boolean; allEvents?: boolean; discipline?: string; mine?: boolean; track?: boolean; allStages?: boolean }
export function readRaceLink(): RaceLink {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const params = ['map','results','race','stage','participant','person','entry','section','page','photo','view','day','category','event','location','album','archiveRace','expanded','reminders','allEvents','mine','track','allStages'].some(key => fragment.has(key)) ? fragment : new URLSearchParams(location.search);
  const positive = (key: string) => { const value = Number(params.get(key)); return Number.isSafeInteger(value) && value > 0 ? value : undefined; };
  return { raceId: positive('race'), stageId: positive('stage'), participantId: positive('person'), entryId: positive('participant') ?? positive('entry'),
    ...Object.fromEntries(['page','photo','view','day','category','discipline'].filter(key => params.has(key) && (key !== 'day' || (/^\d{4}-\d{2}-\d{2}$/.test(params.get(key)!) && Number.isFinite(Date.parse(params.get(key)!)) && new Date(params.get(key)!).toISOString().slice(0,10) === params.get(key)))).map(key => [key, params.get(key)!])),
    ...Object.fromEntries(['event','location','album','archiveRace'].filter(key => positive(key)).map(key => [key + 'Id', positive(key)])),
    ...Object.fromEntries(['expanded','reminders','allEvents','mine','track','allStages'].filter(key => params.get(key) === '1').map(key => [key, true])),
    ...(['map','participants','results','program','more'].includes(params.get('section') || '') ? {section: params.get('section') as RaceLink['section']} : {}),
    ...(params.has('results') ? { section: 'results' as const } : params.has('map') ? { section: 'map' as const } : {}) };
}
export function navigateRace(fragment: string) { location.hash = fragment; }
export function raceLink(raceId: number, stageId: number | undefined, participantId: number, entryId: number) {
  const appId = new URLSearchParams(location.search).get('vk_app_id');
  const url = new URL(appId && /^\d+$/.test(appId) ? `https://vk.com/app${appId}` : location.href);
  url.search = '';
  url.hash = new URLSearchParams({ race: String(raceId), person: String(participantId), participant: String(entryId), ...(stageId === undefined ? {} : { stage: String(stageId) }) }).toString();
  return url.href;
}
export async function shareRace(url: string, title: string): Promise<string> {
  if (bridge.isEmbedded()) {
    try { await bridge.send('VKWebAppShare', { link: url }); return 'Ссылка отправлена'; }
    catch { return ''; }
  }
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'Ссылка отправлена'; }
    catch (error) { if ((error as { name?: string } | null)?.name === 'AbortError') return ''; }
  }
  try { await navigator.clipboard.writeText(url); return 'Ссылка скопирована'; }
  catch { return `Ссылка: ${url}`; }
}

export async function resolveParticipantLink(entryId: number, signal: AbortSignal): Promise<RaceLink | undefined> {
  if (signal.aborted) return;
  const seasons = await request<Race[]>('/races', signal);
  for (const race of [...seasons.data].sort((a,b) => Number(b.is_current) - Number(a.is_current))) {
    if (signal.aborted) return;
    const people = await request<Participant[]>(`/races/${race.id}/participants`, signal);
    const person = people.data.find(person => person.race_participant_id === entryId);
    if (person) return { raceId: race.id, entryId, participantId: person.participant_id };
  }
}

export function updateRoute(patch: Partial<RaceLink>, replace = false) {
  const next = { ...readRaceLink(), ...patch };
  const keys: Record<string, string> = { raceId: 'race', stageId: 'stage', participantId: 'person', entryId: 'participant', eventId: 'event', locationId: 'location', albumId: 'album', archiveRaceId: 'archiveRace' };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) if (value !== undefined && value !== false && value !== '') params.set(keys[key] || key, value === true ? '1' : String(value));
  const previous = readRaceLink();
  const panel = (route: RaceLink) => route.view === 'stage-gallery' ? 'stage-gallery' : route.view === 'track' ? 'track' : route.eventId ? 'event:' + route.eventId : route.locationId ? (route.allEvents ? 'venue-events:' : 'location:') + route.locationId : route.entryId ? 'entry:' + route.entryId : undefined;
  const samePanel = Boolean(panel(next) && panel(next) === panel(previous));
  const state = replace ? history.state : { avachaPrevious: samePanel ? history.state?.avachaPrevious : location.hash };
  history[replace || samePanel ? 'replaceState' : 'pushState'](state, '', '#' + params);
  window.dispatchEvent(new Event('hashchange'));
}
export function viewLink(route: {raceId:number; participantId:number; entryId:number; stageId?:number}) {
  const url = new URL(raceLink(route.raceId!, route.stageId, route.participantId!, route.entryId!));
  const params = new URLSearchParams(url.hash.slice(1));
  params.set('section', 'results'); params.set('view', 'track');
  url.hash = params.toString(); return url.href;
}

export function closeRoute(patch: Partial<RaceLink>) {
  if (typeof history.state?.avachaPrevious === 'string') history.back();
  else updateRoute(patch, true);
}
