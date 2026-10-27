import { Flex, IconButton, Spinner } from '@vkontakte/vkui';
import { Icon24Add, Icon24MinusOutline, Icon24RefreshOutline } from '@vkontakte/icons';
export interface MapControlsProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  refreshing: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRefresh: () => void;
}
export function MapControls({ canZoomIn, canZoomOut, refreshing, onZoomIn, onZoomOut, onRefresh }: MapControlsProps) {
  return <Flex direction="column" align="start">
    <IconButton label="Увеличить масштаб" disabled={!canZoomIn} onClick={onZoomIn}><Icon24Add /></IconButton>
    <IconButton label="Уменьшить масштаб" disabled={!canZoomOut} onClick={onZoomOut}><Icon24MinusOutline /></IconButton>
    <IconButton label="Обновить" disabled={refreshing} aria-busy={refreshing} onClick={onRefresh}>{refreshing ? <Spinner size="s" aria-hidden="true" /> : <Icon24RefreshOutline />}</IconButton>
  </Flex>;
}
