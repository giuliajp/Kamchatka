import { afterEach, expect, it, vi } from 'vitest';
import { apiBase, readCache, request } from '../src/api/client';
import { race, stage, participant, person, positions, protocols, results, track } from './fixtures';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
const endpoints: [string, unknown][] = [
  ['/races/current', race], ['/races/10', race], ['/stages/103', stage],
  ['/races/10/participants?sort=name', [participant]], ['/participants/501', person],
  ['/races/10/positions?stage=3', positions], ['/stages/103/protocols', protocols],
  ['/races/10/results?stage=3', results], ['/race-participants/9001/track?stage=3', track],
];
function respond(data: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data }))));
}
it.each(endpoints)('rejects malformed %s without overwriting a usable cache', async (path, data) => {
  respond(data);
  const saved = await request(path, new AbortController().signal);
  respond(Array.isArray(data) ? {} : []);
  await expect(request(path, new AbortController().signal)).rejects.toThrow('Данные сервера не соответствуют формату API');
  expect(readCache(path)).toEqual(saved);
});
it('ignores damaged cached data, including valid envelopes with null or wrong nested values', () => {
  for (const data of [null, [], { ...race, disciplines: null }, { ...race, stages: [{ ...stage, start_at: 'not-a-date' }] }]) {
    localStorage.setItem(`avacha-api-v1:${apiBase}/races/current`, JSON.stringify({ data, savedAt: new Date().toISOString() }));
    expect(readCache('/races/current')).toBeUndefined();
  }
});
it('rejects broken nested arrays and dates before they reach the UI', async () => {
  const broken: [string, unknown][] = [
    ['/races/current', { ...race, stages: [null] }],
    ['/stages/103', { ...stage, checkpoints: [null] }],
    ['/races/10/positions', { ...positions, participants: [{ ...positions.participants[0], position: { latitude: 'bad' } }] }],
    ['/participants/501', { ...person, races: [null] }],
    ['/races/10/results', { ...results, disciplines: [{ ...results.disciplines[0], rows: [null] }] }],
    ['/stages/103/protocols', { ...protocols, protocols: [{ ...protocols.protocols[0], rows: 'bad' }] }],
    ['/race-participants/9001/track', { ...track, points: [{ ...track.points[0], position_at: 'bad' }] }],
  ];
  for (const [path, data] of broken) {
    respond(data);
    await expect(request(path, new AbortController().signal)).rejects.toThrow('Данные сервера не соответствуют формату API');
  }
});
