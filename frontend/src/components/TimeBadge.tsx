import type { ReactNode } from 'react';
import { Caption, IconButton } from '@vkontakte/vkui';
import './race-kit.css';
const icons = {
  fresh: 'ce3e0.svg', stale: '041ed.svg', position: 'e8d94.svg',
  unavailable: '48fd5.svg', offline: '041ed.svg',
};
export interface TimeBadgeProps { state: keyof typeof icons; children: ReactNode; onRetry?: () => void }
export function TimeBadge({ state, children, onRetry }: TimeBadgeProps) {
  return <div className="race-time-badge" data-state={state}>
    <Caption role="status" className="race-time-badge__content">
      <img src={`/figma/122-9315/${icons[state]}`} width={20} height={20} alt="" />
      <span>{children}</span>
    </Caption>
    {state === 'offline' && onRetry && <IconButton className="race-time-badge__retry" label="Обновить данные" onClick={onRetry}>
      <img src="/figma/122-9315/fc3e1.svg" width={24} height={24} alt="" />
    </IconButton>}
  </div>;
}
