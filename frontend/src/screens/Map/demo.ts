// Screen fixtures, not an HTTP contract. IDs/statuses follow the backend domain.
export const asset = (name: string) => '/figma/map-screen/' + name;
export const demoNow = Date.parse('2027-02-09T02:36:00Z');
export const race = { name: 'Гонка Авача 2027' } as const;
export const disciplines = [
  { id: 1, name: 'Нарта, 8 собак' }, { id: 2, name: 'Нарта, более 8 собак' }, { id: 3, name: 'Лыжи, 2 собаки' },
];
export const liveStage = { id: 3, number: 3, status: 'live', start_at: '2027-02-08T21:00:00Z', finish_at: null, details: '09.02 09:00 — продолжается' } as const;
export const stages = [
  { id: 1, number: 1, status: 'finished', start_at: '2027-02-06T21:00:00Z', finish_at: '2027-02-07T06:00:00Z', details: '07.02 09:00 — 18:00, завершён' },
  { id: 2, number: 2, status: 'finished', start_at: '2027-02-07T21:00:00Z', finish_at: '2027-02-08T06:00:00Z', details: '08.02 09:00 — 18:00, завершён' },
  liveStage,
  { id: 4, number: 4, status: 'planned', start_at: '2027-02-09T21:00:00Z', finish_at: null, details: 'начнётся 10.02 09:00' },
] as const;
export type DemoStage = typeof stages[number];
export const stageOptions = stages.map(s => ({ value: String(s.id), label: 'Этап ' + s.number + ',', details: s.details, upcoming: s.status === 'planned' }));
export const biography = [
  'Алиса родилась в Усть-Большерецке, на западном побережье Камчатки, в семье лесника и школьной учительницы. Детство прошло на краю тайги: зимой дом заносило по самые окна, и единственным надёжным транспортом до соседнего посёлка были собачьи упряжки местных охотников. Первого щенка лайки ей подарил дед на десятилетие. Он же научил её ставить собак в «цуг» и читать их настроение по хвосту и ушам.',
  'После школы Алиса уехала в Петропавловск-Камчатский, где окончила ветеринарный колледж, и несколько лет работала в клинике. Но каждые выходные она возвращалась к собакам. Когда в питомнике стало шесть лаек, она впервые записалась на зимний фестиваль «Авача» и приехала на него на старых дедовых нартах, заняв предпоследнее место. Это её не остановило, а раззадорило.',
  'Сегодня у Алисы 12 ездовых лаек. Вожак упряжки, опытная сука Нерпа, ведёт стаю уже пятый сезон. Алиса сама выращивает щенков, сама составляет рационы и тренирует собак круглый год, даже летом, на специальных тележках.',
  'В 2024 году она взяла бронзу на дистанции 10 км, а в 2025-м выиграла свою первую «Авачу» в классе упряжек из 12 собак. Сейчас она готовится защищать титул.',
];
export interface MapParticipant {
  id: number; discipline_id: number; start_number: number;
  name: string; region: string; place: number; gap: string;
  position: { x: number; y: number; position_at: string; stale: boolean };
  supporters: number; speed: string; distance: string; biography: string[]; photoUrl?: string;
}
const entries = [
  [21, 'Алексей Вершинин', 1, 1, 117, 200], [2, 'Игорь Мельников', 3, 1, 151, 259],
  [4, 'Павел Воронов', 1, 2, 129, 290], [14, 'Алиса Иванова', 2, 2, 189, 327],
  [9, 'Роман Кузнецов', 3, 2, 262, 388], [7, 'Ольга Иванова', 2, 1, 280, 424],
  [11, 'Дмитрий Лесной', 1, 3, 143, 227], [12, 'Анна Морозова', 2, 3, 143, 227],
  [15, 'Сергей Петров', 3, 3, 143, 227], [18, 'Мария Белова', 1, 4, 143, 227],
  [22, 'Максим Орлов', 3, 4, 215, 356], [24, 'Ирина Соколова', 2, 4, 215, 356],
] as const;
export const participants: MapParticipant[] = entries.map(([id, name, discipline_id, place, x, y]) => ({
  id, start_number: id, name, discipline_id, place,
  region: 'Камчатский край', gap: place === 1 ? '—' : '+03:42',
  position: { x, y, position_at: id === 14 || id === 7 ? '2027-02-09T01:48:00Z' : '2027-02-09T02:36:00Z', stale: id === 14 || id === 7 },
  supporters: id === 14 ? 1240 : 218, speed: '9,4 км/ч', distance: '124 км',
  biography: id === 14 ? biography : ['Биография участника пока не опубликована.'],
  photoUrl: id === 14 ? '/figma/339-7951/14c71.png' : undefined,
}));
export const clusters = [{ id: 'north', x: 143, y: 227, members: [11, 12, 15, 18] }, { id: 'south', x: 215, y: 356, members: [22, 24] }];
export const route = [
  { id: '4', index: 4, title: 'КП-3 — КП-4 · 150 км', time: '9 февраля 14:24 — —:—', status: 'Проходит' },
  { id: '3', index: 3, title: 'КП-2 — КП-3 · 124 км', time: '8 февраля 12:52 — 14:12', status: 'Пройден' },
  { id: '2', index: 2, title: 'КП-1 — КП-2 · 78 км', time: '7 февраля 11:45 — 12:39', status: 'Пройден' },
  { id: '1', index: 1, title: 'Старт — КП-1 · 42 км', time: '6 февраля 08:30 — 10:00', status: 'Пройден' },
];
export const photos = ["efbd4.png","67f5d.png","d7616.png","f9ed3.png","21228.png","547f5.png","b1cb4.png","02447.png","63fc6.png","f31e1.png","f31e1.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png","c053b.png"];
export const report = 'Второй этап гонки «Авача» успешно завершён: участники преодолели непростые участки маршрута, продемонстрировав невероятную выносливость и волю к победе. Теперь спортсменов ждёт заслуженный отдых и подготовка к новым, ещё более сложным испытаниям.';
export const storageKey = 'avacha-map-demo-v1';
export interface Preferences { supported: number[]; prompted: number[]; notifications: number[] }
export function readPreferences(): Preferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (saved && typeof saved === 'object' && ['supported', 'prompted', 'notifications'].every(k =>
      Array.isArray((saved as Record<string, unknown>)[k]) && (saved as Record<string, unknown[]>)[k].every(id => participants.some(p => p.id === id)))) return saved as Preferences;
  } catch { /* Storage may be unavailable; the demo still works in memory. */ }
  return { supported: [], prompted: [], notifications: [] };
}
export function writePreferences(value: Preferences) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); return true; }
  catch { return false; }
}
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Kamchatka', hour: '2-digit', minute: '2-digit' });
export function raceTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}
