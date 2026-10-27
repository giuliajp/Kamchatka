import { useId } from 'react';
import { FormItem, Input } from '@vkontakte/vkui';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  error?: string;
  disabled?: boolean;
}

export function TextField({ label, value, onChange, description, error, disabled }: TextFieldProps) {
  const id = useId();
  const message = error || description;
  return (
    <FormItem
      top={<FormItem.Top><FormItem.TopLabel htmlFor={id} className="supporting-text">{label}</FormItem.TopLabel></FormItem.Top>}
      status={error ? 'error' : 'default'}
      bottom={message && <span className="supporting-text" id={`${id}-message`}>{message}</span>}
    >
      <Input
        id={id} value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{ input: {
          'aria-invalid': Boolean(error),
          'aria-describedby': message ? `${id}-message` : undefined,
        } }}
      />
    </FormItem>
  );
}
