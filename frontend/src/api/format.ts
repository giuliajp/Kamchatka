import type { Position, Stage } from '../types/api';

const timeFormat = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Kamchatka', hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Kamchatka', day: '2-digit', month: '2-digit' });
export const raceTime = (iso: string) => timeFormat.format(new Date(iso));
export const raceDate = (iso: string) => dateFormat.format(new Date(iso));
const longDateFormat = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Kamchatka', day: 'numeric', month: 'long' });
// «6 февраля» — как в макетах карточки участника.
export const raceLongDate = (iso: string) => longDateFormat.format(new Date(iso));
// «1 собака», «2 собаки», «5 собак», «12 собак».
export function dogsLabel(count: number): string {
  const tens = count % 100, units = count % 10;
  const word = tens >= 11 && tens <= 14 ? 'собак' : units === 1 ? 'собака' : units >= 2 && units <= 4 ? 'собаки' : 'собак';
  return `${count} ${word}`;
}
export function metric(value: number | null, unit: string) { return value === null ? '—' : `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${unit}`; }
export function stale(position: Position, threshold: number, now = Date.now()) {
  return position.is_stale || (position.position !== null && now - Date.parse(position.position.position_at) > threshold * 60000);
}
export const stageStatus = { planned: 'ожидает старта', live: 'продолжается', finished: 'завершён', cancelled: 'отменён' };
export function stageOption(stage: Stage) {
  return { value: String(stage.id), label: `Этап ${stage.number},`, upcoming: stage.status === 'planned',
    details: `${stage.start_at ? `${raceDate(stage.start_at)} ${raceTime(stage.start_at)}, ` : ''}${stageStatus[stage.status]}` };
}
export const statusLabel = (status: string) => ({ registered: 'Заявлен', active: 'На дистанции', finished: 'Финишировал',
  dnf: 'DNF', dns: 'DNS', dsq: 'DSQ', out_of_competition: 'Вне зачёта' }[status] || status);
