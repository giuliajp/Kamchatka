import './race-kit.css';
import './TopParticipantsCard.css';
import { useId } from 'react';
import { Card, Div, Footnote, Header, SimpleCell } from '@vkontakte/vkui';
export interface TopParticipant {
  id: string;
  number: string;
  label: string;
  place?: number;
  time?: string;
}
export interface TopParticipantsCardProps {
  title: string;
  compact?: boolean;
  entries: TopParticipant[];
  onSelect: (id: string) => void;
}
export function TopParticipantsCard({ title, entries, onSelect, compact = false }: TopParticipantsCardProps) {
  const titleId = useId();
  if (compact) return <section className="map-leaders" aria-labelledby={titleId}>
    <h2 id={titleId}>{title}</h2>
    {entries.length === 0 ? <Footnote>Результатов пока нет</Footnote> : entries.map(entry =>
      <button key={entry.id} className="map-leaders__row" onClick={() => onSelect(entry.id)}>
        <span>{entry.place && String(entry.place) + '. '}{entry.label}</span><span>№{entry.number}</span>{entry.time && <span>{entry.time}</span>}
      </button>)}
  </section>;
  return (
    <Card Component="section" aria-labelledby={titleId}>
      <Header Component="h3" id={titleId}>{title}</Header>
      {entries.length === 0 ? <Div><Footnote>Результатов пока нет</Footnote></Div> : entries.map((entry) => (
        <SimpleCell key={entry.id} Component="button" className="race-native-action race-list-action" multiline
          before={entry.place && <span>{entry.place}.</span>} after={entry.time}
          subtitle={`№${entry.number}`} onClick={() => onSelect(entry.id)}>
          {entry.label}
        </SimpleCell>
      ))}
    </Card>
  );
}
