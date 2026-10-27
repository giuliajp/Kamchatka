import { Button, Div, Placeholder, Skeleton, Spacing, Text, VisuallyHidden } from '@vkontakte/vkui';

export type DataStateProps =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; onRetry: () => void };

export function DataState(props: DataStateProps) {
  if (props.status === 'loading') {
    return (
      <Div role="status" aria-busy="true">
        <VisuallyHidden>Загружаем данные</VisuallyHidden>
        <div aria-hidden="true">
          <Skeleton width="60%" height={24} />
          <Spacing size={12} />
          <Skeleton width="100%" height={80} />
        </div>
      </Div>
    );
  }
  if (props.status === 'empty') {
    return <Placeholder title="Пока нет данных"><Text className="supporting-text">Данные появятся после публикации организаторами.</Text></Placeholder>;
  }
  return (
    <Placeholder role="alert" title="Не удалось загрузить данные"
      action={<Button size="l" appearance="accent" onClick={props.onRetry}>Повторить</Button>}>
      <Text className="supporting-text">Попробуйте ещё раз.</Text>
    </Placeholder>
  );
}
