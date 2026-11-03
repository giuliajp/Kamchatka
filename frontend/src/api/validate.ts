// Public API shapes, checked once before network or stored data reaches React.
// Keep these aligned with backend/app/schemas/{races,tracking}.py.
type Check = (value: unknown) => boolean;
const text: Check = value => typeof value === 'string';
const number: Check = value => typeof value === 'number' && Number.isFinite(value);
const boolean: Check = value => typeof value === 'boolean';
const date: Check = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nullable = (check: Check): Check => value => value === null || check(value);
const list = (check: Check): Check => value => Array.isArray(value) && value.every(check);
const oneOf = (...values: string[]): Check => value => values.some(option => option === value);
const object = (fields: Record<string, Check>): Check => value =>
  typeof value === 'object' && value !== null && !Array.isArray(value) &&
  Object.entries(fields).every(([key, check]) => check((value as Record<string, unknown>)[key]));

const disciplineFields = { id: number, code: text, name: text };
const discipline = object(disciplineFields);
const raceFields = { id: number, name: text, year: number, status: oneOf('upcoming', 'live', 'finished'),
  is_current: boolean, start_date: nullable(date), end_date: nullable(date), location: nullable(text) };
const race = object(raceFields);
const stageFields = { id: number, number, name: nullable(text), distance_km: nullable(number),
  start_at: nullable(date), finish_at: nullable(date), status: oneOf('planned', 'live', 'finished', 'cancelled') };
const stage = object(stageFields);
const checkpoint = object({ id: number, order_index: number, role: oneOf('start', 'checkpoint', 'finish'),
  label: nullable(text), name: text, latitude: number, longitude: number, elevation_m: nullable(number),
  km_from_start: nullable(number), required_rest_minutes: number, segment_description: nullable(text) });
const pointFields = { latitude: number, longitude: number, altitude_m: nullable(number), position_at: date };
const point = object(pointFields);
const participationFields = { race_participant_id: number, start_number: number, region: nullable(text),
  discipline, dogs_count: nullable(number), status: text, place: nullable(number),
  total_time_seconds: nullable(number), total_time: nullable(text) };
const participant = object({ ...participationFields, participant_id: number, full_name: text,
  last_name: text, first_name: text, photo_url: nullable(text) });
const stageCell = object({ stage_number: number, status: nullable(text), time_seconds: nullable(number),
  time: nullable(text), dogs_at_start: nullable(number), dogs_at_finish: nullable(number),
  is_corrected_after_final: boolean, note: nullable(text) });
const penalty = object({ seconds: number, time: text, reason: nullable(text), rule_reference: nullable(text) });
const standing = object({ race_participant_id: number, participant_id: number, place: nullable(number),
  start_number: number, full_name: text, last_name: text, first_name: text, region: nullable(text),
  discipline_code: text, status: text, stages: list(stageCell), total_time_seconds: nullable(number),
  total_time: nullable(text), gap_to_leader_seconds: nullable(number), gap_to_leader: nullable(text),
  penalties: list(penalty), penalty_total_seconds: number, penalty_total: nullable(text) });
const resultStage = object({ id: number, number, name: nullable(text), distance_km: nullable(number),
  protocol_status: text, is_final: boolean });
const position = object({ race_participant_id: number, participant_id: number, start_number: number,
  full_name: text, photo_url: nullable(text), discipline, position: nullable(point), previous_position: nullable(point),
  is_stale: boolean, km_on_route: nullable(number), avg_speed_kmh: nullable(number), gps_rank: nullable(number),
  gap_to_leader_km: nullable(number) });

const endpoints: [RegExp, Check][] = [
  [/^\/races\/(current|\d+)$/, object({ ...raceFields,
    disciplines: list(object({ ...disciplineFields, participants_count: number })), stages: list(stage) })],
  [/^\/stages\/\d+$/, object({ ...stageFields, race_id: number, description: nullable(text),
    checkpoints: list(checkpoint), route_geojson: nullable(object({ type: text })), route_updated_at: nullable(date),
    elevation_profile: list(object({ km: number, elevation_m: number })) })],
  [/^\/races\/\d+\/participants$/, list(participant)],
  [/^\/participants\/\d+$/, object({ id: number, full_name: text, last_name: text, first_name: text,
    middle_name: nullable(text), photo_url: nullable(text), bio: nullable(text),
    races: list(object({ ...participationFields, race, gap_to_leader_seconds: nullable(number), penalty_total_seconds: number })) })],
  [/^\/races\/\d+\/positions$/, object({ stage, generated_at: date, tracking_interval_minutes: number,
    stale_after_minutes: number, route_length_km: nullable(number), official_protocol_disciplines: list(text), participants: list(position) })],
  [/^\/races\/\d+\/results$/, object({ race, up_to_stage: nullable(number), penalty_included_in_stage_times: boolean,
    disciplines: list(object({ discipline, stages: list(resultStage), rows: list(standing) })) })],
  [/^\/stages\/\d+\/protocols$/, object({ stage, race_id: number,
    protocols: list(object({ discipline, status: text, is_final: boolean, published_at: nullable(date),
      finalized_at: nullable(date), weather: nullable(text), chief_judge: nullable(text), chief_secretary: nullable(text), rows: list(standing) })) })],
  [/^\/race-participants\/\d+\/track$/, object({ race_participant_id: number, start_number: number, full_name: text,
    points: list(object({ ...pointFields, stage_number: nullable(number) })) })],
];

export function validApiData(path: string, value: unknown): boolean {
  const endpoint = endpoints.find(([pattern]) => pattern.test(path.split('?')[0]));
  return endpoint ? endpoint[1](value) : true;
}
