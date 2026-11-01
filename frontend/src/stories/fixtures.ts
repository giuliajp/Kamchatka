// Isolated HTTP fixtures for tests and Storybook. Never imported by the application.
import type { Participant, ParticipantDetail, Positions, Protocols, RaceDetail, Results, StageDetail, Standing, Track } from '../types/api';
export const discipline = { id: 2, code: 'sled_8', name: 'Нарта, 8 собак' };
export const stage: StageDetail = { id: 103, number: 3, name: 'Налычево', distance_km: 40, start_at: '2026-10-27T01:00:00Z', finish_at: null, status: 'live', race_id: 10,
  description: 'Этап в природном парке Налычево.', route_geojson: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[158.4, 53.1], [158.5, 53.2], [158.6, 53.3]] }, properties: {} } as StageDetail['route_geojson'],
  route_updated_at: '2026-10-01T00:00:00Z', elevation_profile: [],
  checkpoints: [{ id: 300, order_index: 1, role: 'start', name: 'Светлый', label: 'Старт', latitude: 53.1, longitude: 158.4, elevation_m: null, km_from_start: 0, required_rest_minutes: 0, segment_description: null }] };
export const race: RaceDetail = { id: 10, name: 'Гонка Авача 2026', year: 2026, status: 'live', is_current: true, start_date: '2026-10-27', end_date: null, location: 'Камчатка',
  disciplines: [{ ...discipline, participants_count: 2 }, { id: 3, code: 'ski_2', name: 'Лыжи, 2 собаки', participants_count: 1 }],
  stages: [{ ...stage, id: 102, number: 2, start_at: '2026-10-26T01:00:00Z', status: 'finished', finish_at: '2026-10-26T05:00:00Z' }, stage,
    { ...stage, id: 104, number: 4, status: 'planned', start_at: '2027-03-01T00:00:00Z' }, { ...stage, id: 105, number: 5, status: 'cancelled' }] };
export const participant: Participant = { race_participant_id: 9001, participant_id: 501, start_number: 14, full_name: 'Алиса Иванова', last_name: 'Иванова', first_name: 'Алиса', photo_url: null, region: 'Камчатский край', discipline, dogs_count: 8, status: 'active', place: 2, total_time_seconds: 1000, total_time: '00:16:40' };
const positionAt = new Date().toISOString();
export const positions: Positions = { stage, generated_at: positionAt, tracking_interval_minutes: 20, stale_after_minutes: 45, route_length_km: 40, official_protocol_disciplines: [],
  participants: [{ race_participant_id: 9001, participant_id: 501, start_number: 14, full_name: 'Алиса Иванова', photo_url: null, discipline, position: { latitude: 53.2, longitude: 158.5, altitude_m: 20, position_at: positionAt }, previous_position: null, is_stale: false, km_on_route: 12.4, avg_speed_kmh: 9.4, gps_rank: 1, gap_to_leader_km: 0 },
    { race_participant_id: 9002, participant_id: 502, start_number: 22, full_name: 'Иван Петров', photo_url: null, discipline: race.disciplines[1], position: { latitude: 53.20001, longitude: 158.50001, altitude_m: null, position_at: positionAt }, previous_position: null, is_stale: true, km_on_route: 10, avg_speed_kmh: null, gps_rank: 1, gap_to_leader_km: null }] };
export const person: ParticipantDetail = { id: 501, full_name: participant.full_name, last_name: participant.last_name, first_name: participant.first_name, middle_name: null, photo_url: null, bio: 'Каюр из Камчатского края.', races: [{ ...participant, race, gap_to_leader_seconds: 45, penalty_total_seconds: 120 }] };
export const standing: Standing = { race_participant_id: 9001, participant_id: 501, place: 2, start_number: 14, full_name: participant.full_name, last_name: participant.last_name, first_name: participant.first_name, region: participant.region, discipline_code: discipline.code, status: 'finished', stages: [{ stage_number: 3, status: 'finished', time_seconds: 1000, time: '00:16:40', dogs_at_start: 8, dogs_at_finish: 8, is_corrected_after_final: true, note: 'По решению судей' }], total_time_seconds: 1000, total_time: '00:16:40', gap_to_leader_seconds: 45, gap_to_leader: '00:00:45', penalties: [{ seconds: 120, time: '00:02:00', reason: 'Нарушение правил', rule_reference: '14.11' }], penalty_total_seconds: 120, penalty_total: '00:02:00' };
export const results: Results = { race, up_to_stage: 3, penalty_included_in_stage_times: true, disciplines: [{ discipline, stages: [{ id: 103, number: 3, name: null, distance_km: 40, protocol_status: 'final', is_final: true }], rows: [standing] }] };
export const protocols: Protocols = { race_id: 10, stage, protocols: [{ discipline, status: 'final', is_final: true, published_at: stage.start_at, finalized_at: stage.start_at, weather: 'Ясно', chief_judge: 'Иванов', chief_secretary: 'Петрова', rows: [standing] }] };
export const track: Track = { race_participant_id: 9001, start_number: 14, full_name: participant.full_name, points: [{ ...positions.participants[0].position!, stage_number: 3 }] };
export function fixtureResponse(url: string): unknown {
  const parsed = new URL(url, 'http://localhost'); const path = parsed.pathname;
  if (path.endsWith('/current') || /\/races\/\d+$/.test(path)) return race;
  if (path.endsWith('/positions')) return { ...positions, participants: positions.participants.filter(p => !parsed.searchParams.get('discipline') || p.discipline.code === parsed.searchParams.get('discipline')) };
  if (path.endsWith('/participants')) return [participant].filter(p => p.full_name.includes(parsed.searchParams.get('q') || '') || String(p.start_number) === parsed.searchParams.get('q'));
  if (/\/participants\/\d+$/.test(path)) return person;
  if (path.endsWith('/protocols')) return protocols;
  if (path.endsWith('/results')) return results;
  if (path.endsWith('/track')) return track;
  if (/\/stages\/\d+$/.test(path)) return { ...stage, ...race.stages.find(s => path.endsWith('/' + s.id)) };
  throw new Error('Unexpected fixture URL: ' + url);
}
export function installStoryApi() {
  const original = globalThis.fetch;
  globalThis.fetch = async input => new Response(JSON.stringify({ data: fixtureResponse(String(input)), error: null }));
  return () => { globalThis.fetch = original; };
}
