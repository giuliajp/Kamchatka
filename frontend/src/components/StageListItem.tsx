import { CustomSelectOption, type CustomSelectOptionProps } from '@vkontakte/vkui';
import './race-kit.css';
export interface StageListItemProps extends CustomSelectOptionProps {
  label: string;
  details: string;
  upcoming?: boolean;
}
export function StageListItem({ label, details, upcoming, ...props }: StageListItemProps) {
  return <CustomSelectOption {...props}>{label} <span className={upcoming ? 'race-secondary' : undefined}>{details}</span></CustomSelectOption>;
}
