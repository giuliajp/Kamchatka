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
  discipline, dogs_count: nullable(number), dog_breed: nullable(text), status: text, place: nullable(number),
  total_time_seconds: nullable(number), total_time: nullable(text) };
const participant = object({ ...participationFields, participant_id: number, full_name: text,
  last_name: text, first_name: text, photo_url: nullable(text), supporters_count: number, supporters_change_24h: number });
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
  [/^\/races$/, list(race)],
  [/^\/races\/(current|\d+)$/, object({ ...raceFields,
    disciplines: list(object({ ...disciplineFields, participants_count: number })), stages: list(stage), protocol_pdf_url: nullable(text) })],
  [/^\/stages\/\d+$/, object({ ...stageFields, race_id: number, protocol_pdf_url: nullable(text), description: nullable(text),
    checkpoints: list(checkpoint), route_geojson: nullable(object({ type: text })), route_updated_at: nullable(date),
    elevation_profile: list(object({ km: number, elevation_m: number })) })],
  [/^\/races\/\d+\/participants$/, list(participant)],
  [/^\/participants\/\d+$/, object({ id: number, full_name: text, last_name: text, first_name: text,
    middle_name: nullable(text), photo_url: nullable(text), bio: nullable(text),
    races: list(object({ ...participationFields, race, gap_to_leader_seconds: nullable(number), penalty_total_seconds: number, penalties: list(penalty) })) })],
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

const support = object({ race_participant_id: number, supporters_count: number, change_24h: number, is_supported: nullable(boolean), notifications_enabled: nullable(boolean) });
const locationFields = { id: number, race_id: number, stage_id: nullable(number), location_type: oneOf('start', 'finish', 'festival', 'viewpoint', 'checkpoint'), name: text, description: nullable(text), latitude: number, longitude: number, address: nullable(text), how_to_get_there: nullable(text), image_urls: list(text), sort_order: number };
const bookmark = object({ kind: oneOf('news', 'photo', 'protocol'), item_id: text, title: nullable(text), url: nullable(text), image_url: nullable(text), created_at: date });
endpoints.push(
  [/^\/race-participants\/\d+\/support$/, support],
  [/^\/me\/visit$/, object({ vk_user_id: number })],
  [/^\/me\/notifications$/, object({ notifications_allowed: boolean })],
  [/^\/me\/supports\/\d+$/, support],
  [/^\/me\/supports$/, list(object({ race_participant_id: number, race_id: number, start_number: number, full_name: text, photo_url: nullable(text), discipline, notifications_enabled: boolean, supported_since: date }))],
  [/^\/races\/\d+\/support-rating$/, list(object({ rank: number, race_participant_id: number, start_number: number, full_name: text, photo_url: nullable(text), discipline, supporters_count: number, change_24h: number }))],
  [/^\/race-participants\/\d+\/checkpoint-passes$/, list(object({ stage_id: number, stage_number: number, stage_checkpoint_id: number, order_index: number, role: oneOf('start', 'checkpoint', 'finish'), label: nullable(text), name: text, km_from_start: nullable(number), required_rest_minutes: number, arrived_at: date, departed_at: nullable(date) }))],
  [/^\/locations$/, list(object(locationFields))],
  [/^\/program$/, list(object({ id: number, race_id: number, stage_id: nullable(number), event_type: oneOf('stage_start', 'stage_finish', 'festival', 'master_class', 'meeting'), title: text, description: nullable(text), start_at: date, end_at: nullable(date), location: nullable(object(locationFields)), image_urls: list(text), sort_order: number }))],
  [/^\/faq$/, list(object({ id: number, question: text, answer: text, sort_order: number }))],
  [/^\/contacts$/, list(object({ id: number, title: text, name: nullable(text), phone: nullable(text), email: nullable(text), url: nullable(text), sort_order: number }))],
  [/^\/news$/, object({ items: list(object({ id: text, owner_id: number, post_id: number, date, title: text, preview: text, cover_url: nullable(text), url: text })), total: number, stale: boolean })],
  [/^\/photos$/, object({ days: list(object({ date, photos: list(object({ id: text, date, text: nullable(text), url: nullable(text), vk_url: text })) })), stale: boolean })],
  [/^\/me\/bookmarks$/, list(bookmark)],
);

const windowFields = { from: date, to: date };
const notificationSettings = object({ notifications_allowed: boolean, checkpoints: boolean, results: boolean, news: boolean });
endpoints.push(
  [/^\/me$/, object({ vk_user_id: number, participant_id: nullable(number), race_entries: list(object({ race_participant_id: number, race_id: number, start_number: number })) })],
  [/^\/me\/notification-settings$/, notificationSettings],
  [/^\/me\/reminders$/, object({ program_event_ids: list(number) })],
  [/^\/program\/\d+\/reminder$/, object({ program_event_id: number, reminder: boolean })],
  [/^\/guest-info$/, object(Object.fromEntries(['how_to_get_there', 'what_to_bring', 'safety'].map(key => [key, list(object({ id: number, title: nullable(text), text }))])))],
  [/^\/photos\/albums$/, object({ items: list(object({ id: number, title: nullable(text), size: number, cover_url: nullable(text), url: text })), stale: boolean })],
  [/^\/stages\/\d+\/arrival-estimate$/, object({ stage_id: number, generated_at: date, tracking_interval_minutes: number, first: nullable(object(windowFields)), note: text,
    leaders: list(object({ discipline, race_participant_id: number, start_number: number, full_name: text, remaining_km: number, position_at: date, expected_at: date, ...windowFields })) })],
);

export function validApiData(path: string, value: unknown, method = 'GET'): boolean {
  if (method === 'PUT' && path === '/me/bookmarks') return bookmark(value);
  if (method === 'DELETE' && path.startsWith('/me/bookmarks/')) return object({ deleted: number })(value);
  if (method === 'DELETE' && path.split('?')[0] === '/me/supports') return object({ cancelled: number })(value);
  const endpoint = endpoints.find(([pattern]) => pattern.test(path.split('?')[0]));
  return endpoint ? endpoint[1](value) : true;
}
