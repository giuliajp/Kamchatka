import { Icon24LikeOutline } from '@vkontakte/icons';
import { Button } from '@vkontakte/vkui';

export interface SupportButtonProps {
  selected: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function SupportButton({ selected, loading = false, disabled = false, onToggle }: SupportButtonProps) {
  const label = selected ? 'Вы болеете' : 'Болею за';
  return (
    <Button
      size="l"
      appearance="accent"
      before={<Icon24LikeOutline />}
      mode={selected ? 'secondary' : 'primary'}
      aria-pressed={selected}
      aria-busy={loading}
      loading={loading}
      loadingLabel={label}
      disabled={disabled || loading}
      onClick={onToggle}
    >
      {label}
    </Button>
  );
}
