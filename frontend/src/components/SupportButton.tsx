import { Icon24LikeOutline, Icon24Like } from '@vkontakte/icons';
import { Button, IconButton } from '@vkontakte/vkui';

export interface SupportButtonProps {
  selected: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function SupportButton({ selected, loading = false, disabled = false, onToggle, compact = false }: SupportButtonProps) {
  const label = selected ? 'Вы болеете' : 'Болею за';
  if(compact) return <IconButton label={label} aria-pressed={selected} disabled={disabled || loading} onClick={onToggle}>{selected ? <Icon24Like/> : <Icon24LikeOutline/>}</IconButton>;
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
