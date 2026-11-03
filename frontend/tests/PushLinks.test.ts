import { afterEach, expect, it } from 'vitest';
import { raceLink, readRaceLink } from '../src/api/navigation';
afterEach(() => history.replaceState(null, '', '/'));
it('reads server push fragments and keeps signed launch parameters out of sharing', () => {
  history.replaceState(null, '', '/?vk_user_id=7&sign=a%2Bb#map&stage=103');
  expect(readRaceLink()).toMatchObject({ stageId: 103, section: 'map' });
  history.replaceState(null, '', '/?vk_user_id=7&sign=a%2Bb#participant=9001');
  expect(readRaceLink()).toMatchObject({ entryId: 9001 });
  const link = raceLink(10, 103, 501, 9001);
  expect(new URL(link).search).toBe('');
  expect(new URL(link).hash).toContain('participant=9001');
  expect(location.search).toBe('?vk_user_id=7&sign=a%2Bb');
  history.replaceState(null, '', '/#results');
  expect(readRaceLink()).toMatchObject({ section: 'results' });
});
