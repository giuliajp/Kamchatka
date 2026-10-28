import { SimpleCell, Switch } from '@vkontakte/vkui';
export interface NotificationPreferencesProps {
  push: boolean;
  vk: boolean;
  disabled?: boolean;
  onPushChange: (enabled: boolean) => void;
  onVkChange: (enabled: boolean) => void;
}
export function NotificationPreferences({ push, vk, disabled, onPushChange, onVkChange }: NotificationPreferencesProps) {
  return <div>
    <SimpleCell Component="div" after={<Switch aria-label="Push-уведомления на телефон" checked={push} disabled={disabled} onChange={(event) => onPushChange(event.target.checked)} />}>Push-уведомления на телефон</SimpleCell>
    <SimpleCell Component="div" after={<Switch aria-label="VK уведомления" checked={vk} disabled={disabled} onChange={(event) => onVkChange(event.target.checked)} />}>VK уведомления</SimpleCell>
  </div>;
}
