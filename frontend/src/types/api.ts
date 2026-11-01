import type { GeoJsonObject } from 'geojson';

export interface Discipline { id: number; code: string; name: string }
export interface Stage {
  id: number; number: number; name: string | null; distance_km: number | null;
  start_at: string | null; finish_at: string | null; status: 'planned' | 'live' | 'finished' | 'cancelled';
}
export interface Race {
  id: number; name: string; year: number; status: 'upcoming' | 'live' | 'finished';
  is_current: boolean; start_date: string | null; end_date: string | null; location: string | null;
}
export interface RaceDetail extends Race {
  disciplines: (Discipline & { participants_count: number })[]; stages: Stage[];
}
export interface Checkpoint {
  id: number; order_index: number; role: 'start' | 'checkpoint' | 'finish'; label: string | null;
  name: string; latitude: number; longitude: number; elevation_m: number | null;
  km_from_start: number | null; required_rest_minutes: number; segment_description: string | null;
}
export interface StageDetail extends Stage {
  race_id: number; description: string | null; checkpoints: Checkpoint[];
  route_geojson: GeoJsonObject | null; route_updated_at: string | null;
  elevation_profile: { km: number; elevation_m: number }[];
}
export interface Point { latitude: number; longitude: number; altitude_m: number | null; position_at: string }
export interface Position {
  race_participant_id: number; participant_id: number; start_number: number; full_name: string;
  photo_url: string | null; discipline: Discipline; position: Point | null; previous_position: Point | null;
  is_stale: boolean; km_on_route: number | null; avg_speed_kmh: number | null;
  gps_rank: number | null; gap_to_leader_km: number | null;
}
export interface Positions {
  stage: Stage; generated_at: string; tracking_interval_minutes: number; stale_after_minutes: number;
  route_length_km: number | null; official_protocol_disciplines: string[]; participants: Position[];
}
export interface Participant {
  race_participant_id: number; participant_id: number; start_number: number; full_name: string;
  last_name: string; first_name: string; photo_url: string | null; region: string | null;
  discipline: Discipline; dogs_count: number | null; status: string; place: number | null;
  total_time_seconds: number | null; total_time: string | null;
}
export interface ParticipantRace extends Omit<Participant, 'participant_id' | 'full_name' | 'last_name' | 'first_name' | 'photo_url'> {
  race: Race; gap_to_leader_seconds: number | null; penalty_total_seconds: number;
}
export interface ParticipantDetail {
  id: number; full_name: string; last_name: string; first_name: string; middle_name: string | null;
  photo_url: string | null; bio: string | null; races: ParticipantRace[];
}
export interface Track { race_participant_id: number; start_number: number; full_name: string; points: (Point & { stage_number: number | null })[] }
export interface Standing {
  race_participant_id: number; participant_id: number; place: number | null; start_number: number;
  full_name: string; last_name: string; first_name: string; region: string | null; discipline_code: string; status: string;
  stages: { stage_number: number; status: string | null; time_seconds: number | null; time: string | null;
    dogs_at_start: number | null; dogs_at_finish: number | null; is_corrected_after_final: boolean; note: string | null }[];
  total_time_seconds: number | null; total_time: string | null; gap_to_leader_seconds: number | null;
  gap_to_leader: string | null; penalties: { seconds: number; time: string; reason: string | null; rule_reference: string | null }[];
  penalty_total_seconds: number; penalty_total: string | null;
}
export interface Results {
  race: Race; up_to_stage: number | null; penalty_included_in_stage_times: boolean;
  disciplines: { discipline: Discipline; stages: { id: number; number: number; name: string | null;
    distance_km: number | null; protocol_status: string; is_final: boolean }[]; rows: Standing[] }[];
}
export interface Protocols { stage: Stage; race_id: number; protocols: {
  discipline: Discipline; status: string; is_final: boolean; published_at: string | null;
  finalized_at: string | null; weather: string | null; chief_judge: string | null;
  chief_secretary: string | null; rows: Standing[];
}[] }
