export interface RaceLink { raceId?: number; stageId?: number; participantId?: number; entryId?: number }
export function readRaceLink(): RaceLink {
  const params = new URLSearchParams(location.search);
  const positive = (key: string) => { const value = Number(params.get(key)); return Number.isSafeInteger(value) && value > 0 ? value : undefined; };
  return { raceId: positive('race'), stageId: positive('stage'), participantId: positive('person'), entryId: positive('entry') };
}
export function raceLink(raceId: number, stageId: number | undefined, participantId: number, entryId: number) {
  const url = new URL(location.href);
  url.search = new URLSearchParams({ race: String(raceId), person: String(participantId), entry: String(entryId), ...(stageId === undefined ? {} : { stage: String(stageId) }) }).toString();
  url.hash = '';
  return url.href;
}
export async function shareRace(url: string, title: string): Promise<string> {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'Ссылка отправлена'; }
    catch (error) { if ((error as { name?: string } | null)?.name === 'AbortError') return ''; }
  }
  try { await navigator.clipboard.writeText(url); return 'Ссылка скопирована'; }
  catch { return `Ссылка: ${url}`; }
}
