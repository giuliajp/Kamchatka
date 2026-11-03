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

it('resolves participant-only push links in an archived season and honours cancellation', async () => {
  const { resolveParticipantLink } = await import('../src/api/navigation');
  const { vi } = await import('vitest');
  const { race, participant } = await import('./fixtures');
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>new Response(JSON.stringify({data:input.endsWith('/races')?[race,{...race,id:11,is_current:false}]:input.includes('/races/11/')?[{...participant,race_participant_id:55}]:[],error:null}))));
  const controller=new AbortController();
  expect(await resolveParticipantLink(55,controller.signal)).toMatchObject({raceId:11,participantId:501,entryId:55});
  expect(await resolveParticipantLink(999,controller.signal)).toBeUndefined();
  controller.abort();expect(await resolveParticipantLink(55,controller.signal)).toBeUndefined();
  vi.unstubAllGlobals();
});
