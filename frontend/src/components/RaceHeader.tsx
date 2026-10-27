import { Div } from '@vkontakte/vkui';
import { RacePanelHeader, type RacePanelHeaderProps } from './RacePanelHeader';
import { RaceStageSelect, type RaceStageSelectProps } from './RaceStageSelect';
import { RaceTabs, type RaceTabsProps } from './RaceTabs';
export interface RaceHeaderProps {
  header: RacePanelHeaderProps;
  stage: RaceStageSelectProps;
  filters?: RaceTabsProps;
}
export function RaceHeader({ header, stage, filters }: RaceHeaderProps) {
  return <header><RacePanelHeader {...header} /><Div><RaceStageSelect {...stage} /></Div>{filters && <RaceTabs {...filters} />}</header>;
}
