import { Button, FormStatus, Spacing, Text } from '@vkontakte/vkui';

export interface DataFreshnessProps {
  offline?: boolean;
  stale?: boolean;
  hasCachedData?: boolean;
  lastUpdated?: string;
  onRetry: () => void;
}

export function DataFreshness({ offline = false, stale = false, hasCachedData = true, lastUpdated, onRetry }: DataFreshnessProps) {
  if (!offline && !stale) return null;
  return (
    <div className="freshness">
      {offline && (
        <FormStatus role="status" title="Нет соединения">
          <Text>{hasCachedData ? 'Показаны сохранённые данные.' : 'Сохранённых данных нет. Подключитесь к интернету и повторите попытку.'}</Text>
          {hasCachedData && lastUpdated && <Text>Обновлено: {lastUpdated}</Text>}
          <Spacing size={12} />
          <Button size="l" mode="secondary" appearance="accent" onClick={onRetry}>Повторить</Button>
        </FormStatus>
      )}
      {stale && (
        <FormStatus role="status" title="Координата устарела">
          {lastUpdated ? `Последняя подтверждённая точка: ${lastUpdated}` : 'Время последней точки неизвестно.'}
        </FormStatus>
      )}
    </div>
  );
}
