import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Stage, StageDetail } from '../types/api';

export const mockFeaturesEnabled = () => import.meta.env.VITE_MOCK_MISSING_FEATURES !== 'false';
export const preferencesKey = 'avacha-extras-v1';
export interface Preferences { supported: string[]; subscriptions: string[]; prompted: string[] }
export const participationKey = (raceId: number, entryId: number) => `${raceId}:${entryId}`;
const empty = (): Preferences => ({ supported: [], subscriptions: [], prompted: [] });
export function readPreferences(fallback: Preferences = empty()): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    if (value && ['supported', 'subscriptions', 'prompted'].every(key => Array.isArray(value[key]) && value[key].every((id: unknown) => typeof id === 'string' && /^\d+:\d+$/.test(id)))) return value;
  } catch { /* Private browsing and damaged storage do not stop the application. */ }
  return fallback;
}
interface PreferencesContext { value: Preferences; change: (key: keyof Preferences, id: string, selected: boolean) => void }
const Context = createContext<PreferencesContext | null>(null);
export function ExtrasProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(readPreferences);
  const storageWritable = useRef(true);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === preferencesKey || event.key === null) setValue(readPreferences()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const change: PreferencesContext['change'] = (key, id, selected) => {
    setValue(previous => {
      if (storageWritable.current) previous = readPreferences(previous);
      const next = { ...previous, [key]: [...previous[key].filter(item => item !== id), ...(selected ? [id] : [])] };
      try { localStorage.setItem(preferencesKey, JSON.stringify(next)); storageWritable.current = true; }
      catch { storageWritable.current = false; /* Retain this session in memory. */ }
      return next;
    });
  };
  return <Context.Provider value={{ value, change }}>{children}</Context.Provider>;
}
export function useExtras() {
  const context = useContext(Context);
  if (!context) throw new Error('ExtrasProvider is required');
  return context;
}
export function supporters(entryId: number, selected: boolean) {
  return { total: 1150 + entryId % 173 + Number(selected), daily: 12 + entryId % 83 };
}
export interface CheckpointVisit { id: number; index: number; title: string; arrivedAt: string; departedAt: string | null; restMinutes: number; status: 'Пройден' | 'Проходит' }
export function mockVisits(stage: StageDetail, entryId: number): CheckpointVisit[] {
  if (!mockFeaturesEnabled() || !stage.start_at || !['live', 'finished'].includes(stage.status)) return [];
  const start = Date.parse(stage.start_at);
  const end = stage.finish_at ? Date.parse(stage.finish_at) : start + 6 * 3600000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const points = [...stage.checkpoints].sort((a, b) => a.order_index - b.order_index);
  return points.map((point, index) => {
    const at = start + (end - start) * index / Math.max(1, points.length) + entryId % 10 * 60000;
    const passing = stage.status === 'live' && index === points.length - 1;
    return { id: point.id, index: index + 1, title: `${point.label || point.name}${point.km_from_start === null ? '' : ` · ${point.km_from_start} км`}`,
      arrivedAt: new Date(at).toISOString(), departedAt: passing ? null : new Date(at + point.required_rest_minutes * 60000).toISOString(), restMinutes: point.required_rest_minutes, status: passing ? 'Проходит' as const : 'Пройден' as const };
  }).reverse();
}
export function mockFinish(stage: Stage, status: string, duration: number | null): string | null {
  if (!mockFeaturesEnabled() || stage.status !== 'finished' || status !== 'finished' || !stage.start_at || duration === null) return null;
  const at = Date.parse(stage.start_at) + duration * 1000;
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}
export const stagePhotos = ['efbd4.png', '67f5d.png', 'd7616.png', 'f9ed3.png', '21228.png', '547f5.png', 'b1cb4.png', '02447.png', '63fc6.png', 'f31e1.png', 'c053b.png'];
export const stageAsset = (name: string) => `/figma/map-screen/${name}`;
