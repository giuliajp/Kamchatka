import { Button } from '@vkontakte/vkui';
import type { Resource } from '../hooks/useApi';
import { raceTime } from '../api/format';
import { DataState } from './DataState';

export function RequestState({ resource }: { resource: Resource<unknown> }) {
  if (resource.error) return <div className="request-message" role="alert">
    <p>{!navigator.onLine ? 'Нет соединения' : resource.data === undefined ? resource.error.message : 'Не удалось обновить данные'}</p>
    {resource.savedAt && <p>Сохранённые данные на {raceTime(resource.savedAt)} (Камчатка)</p>}
    <Button size="s" onClick={resource.refresh}>Повторить</Button>
  </div>;
  if (resource.loading && resource.data === undefined) return <DataState status="loading" />;
  return null;
}
