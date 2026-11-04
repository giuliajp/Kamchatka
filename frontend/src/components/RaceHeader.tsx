import type { ReactNode } from 'react';
import { Div } from '@vkontakte/vkui';
import { RacePanelHeader, type RacePanelHeaderProps } from './RacePanelHeader';
import { RaceStageSelect, type RaceStageSelectProps } from './RaceStageSelect';
import { RaceTabs, type RaceTabsProps } from './RaceTabs';
export interface RaceHeaderProps {
  header: RacePanelHeaderProps;
  stage: RaceStageSelectProps;
  filters?: RaceTabsProps;
  beforeFilters?: ReactNode;
}
export function RaceHeader({ header, stage, filters, beforeFilters }: RaceHeaderProps) {
  return <header><RacePanelHeader {...header} /><Div><RaceStageSelect {...stage} /></Div>{beforeFilters}{filters && <RaceTabs {...filters} />}</header>;
}
