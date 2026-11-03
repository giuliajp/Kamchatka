import bridge from '@vkontakte/vk-bridge';
export interface RaceLink { raceId?: number; stageId?: number; participantId?: number; entryId?: number; section?: 'map' | 'results' }
export function readRaceLink(): RaceLink {
  const params = new URLSearchParams(location.hash ? location.hash.slice(1) : location.search);
  const positive = (key: string) => { const value = Number(params.get(key)); return Number.isSafeInteger(value) && value > 0 ? value : undefined; };
  return { raceId: positive('race'), stageId: positive('stage'), participantId: positive('person'), entryId: positive('participant') ?? positive('entry'),
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
