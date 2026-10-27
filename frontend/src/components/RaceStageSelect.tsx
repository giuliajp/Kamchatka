import { CustomSelect } from '@vkontakte/vkui';
import './RaceStageSelect.css';
import { StageListItem } from './StageListItem';

export interface RaceStageOption {
  value: string;
  label: string;
  details: string;
  upcoming?: boolean;
}

export interface RaceStageSelectProps {
  value: string;
  options: RaceStageOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RaceStageSelect({ value, options, onChange, disabled }: RaceStageSelectProps) {
  return (
    <CustomSelect
      className="race-stage-select"
      value={value}
      disabled={disabled}
      options={options.map((option) => ({ ...option, stageLabel: option.label, label: `${option.label} ${option.details}` }))}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{ input: { 'aria-label': 'Этап гонки', className: 'race-stage-select__input' } }}
      renderOption={({ option, ...props }) => {
        // VKUI also spreads custom option fields into the render props.
        Reflect.deleteProperty(props, 'stageLabel');
        return <StageListItem {...props} label={option.stageLabel} details={option.details} upcoming={option.upcoming} />;
      }}
      multiline
    />
  );
}
