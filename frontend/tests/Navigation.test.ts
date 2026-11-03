import { afterEach, expect, it, vi } from 'vitest';
import { readRaceLink, raceLink, shareRace } from '../src/api/navigation';
afterEach(() => { history.replaceState(null, '', '/'); vi.unstubAllGlobals(); });
it('validates link IDs and round trips the race, stage, identity and participation', () => {
  history.replaceState(null, '', '/?race=-1&stage=1.5&person=NaN&entry=0');
  expect(readRaceLink()).toEqual({ raceId: undefined, stageId: undefined, participantId: undefined, entryId: undefined });
  history.replaceState(null, '', '/?other=x#old');
  const url = raceLink(10, 103, 501, 9001); history.replaceState(null, '', url);
  expect(readRaceLink()).toEqual({ raceId: 10, stageId: 103, participantId: 501, entryId: 9001 }); expect(location.hash).toContain('participant=9001');
  expect(raceLink(10, undefined, 501, 9001)).not.toContain('stage=');
});
it('shares natively, handles dismissal, copies if unavailable or failed, and leaves a manual link if copying fails', async () => {
  const share = vi.fn().mockResolvedValue(undefined); const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { share, clipboard: { writeText } });
  expect(await shareRace('url', 'title')).toBe('Ссылка отправлена'); expect(share).toHaveBeenCalledWith({ url: 'url', title: 'title' });
  share.mockRejectedValueOnce(new DOMException('', 'AbortError')); expect(await shareRace('url', 'title')).toBe(''); expect(writeText).not.toHaveBeenCalled();
  share.mockRejectedValueOnce('unavailable'); expect(await shareRace('url', 'title')).toBe('Ссылка скопирована');
  vi.stubGlobal('navigator', { clipboard: { writeText } }); expect(await shareRace('url', 'title')).toBe('Ссылка скопирована');
  writeText.mockRejectedValueOnce(new Error('denied')); expect(await shareRace('url', 'title')).toBe('Ссылка: url');
});
