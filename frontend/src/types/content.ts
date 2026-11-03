import type { Discipline } from './api';

export interface SupportState { race_participant_id: number; supporters_count: number; change_24h: number; is_supported: boolean | null; notifications_enabled: boolean | null }
export interface MySupport { race_participant_id: number; race_id: number; start_number: number; full_name: string; photo_url: string | null; discipline: Discipline; notifications_enabled: boolean; supported_since: string }
export interface SupportRating { rank: number; race_participant_id: number; start_number: number; full_name: string; photo_url: string | null; discipline: Discipline; supporters_count: number; change_24h: number }
export interface CheckpointPass { stage_id: number; stage_number: number; stage_checkpoint_id: number; order_index: number; role: string; label: string | null; name: string; km_from_start: number | null; required_rest_minutes: number; arrived_at: string; departed_at: string | null }
export interface Location { id: number; race_id: number; stage_id: number | null; location_type: 'start' | 'finish' | 'festival' | 'viewpoint' | 'checkpoint'; name: string; description: string | null; latitude: number; longitude: number; address: string | null; how_to_get_there: string | null; image_urls: string[]; sort_order: number }
export interface ProgramEvent { id: number; race_id: number; stage_id: number | null; event_type: 'stage_start' | 'stage_finish' | 'festival' | 'master_class' | 'meeting'; title: string; description: string | null; start_at: string; end_at: string | null; location: Location | null; image_urls: string[]; sort_order: number }
export interface Faq { id: number; question: string; answer: string; sort_order: number }
export interface Contact { id: number; title: string; name: string | null; phone: string | null; email: string | null; url: string | null; sort_order: number }
export interface NewsItem { id: string; owner_id: number; post_id: number; date: string; title: string; preview: string; cover_url: string | null; url: string }
export interface News { items: NewsItem[]; total: number; stale: boolean }
export interface Photo { id: string; date: string; text: string | null; url: string | null; vk_url: string }
export interface Photos { days: { date: string; photos: Photo[] }[]; stale: boolean }
export interface Bookmark { kind: 'news' | 'photo' | 'protocol'; item_id: string; title: string | null; url: string | null; image_url: string | null; created_at: string }

export interface GuestInfo { how_to_get_there: GuestItem[]; what_to_bring: GuestItem[]; safety: GuestItem[] }
export interface GuestItem { id: number; title: string | null; text: string }
export interface NotificationSettings { notifications_allowed: boolean; checkpoints: boolean; results: boolean; news: boolean }
export interface Me { vk_user_id: number; participant_id: number | null; race_entries: { race_participant_id: number; race_id: number; start_number: number }[] }
export interface Reminders { program_event_ids: number[] }
export interface Albums { items: { id: number; title: string | null; size: number; cover_url: string | null; url: string }[]; stale: boolean }
export interface ArrivalEstimate { stage_id: number; generated_at: string; tracking_interval_minutes: number; first: { from: string; to: string } | null; leaders: { discipline: Discipline; race_participant_id: number; start_number: number; full_name: string; remaining_km: number; position_at: string; expected_at: string; from: string; to: string }[]; note: string }
