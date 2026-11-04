import './MapLegend.css';
import { ModalPage } from '@vkontakte/vkui';
import { RaceMapMarker } from './RaceMapMarker';
import { ParticipantCluster } from './ParticipantCluster';

export function MapLegend({ open, onClose, description }: { open: boolean; onClose: () => void; description?: string }) {
  return <ModalPage hideCloseButton className="legend-sheet" style={{ bottom: 'calc(3rem + 24px)' }} open={open} onClose={onClose} aria-label="Условные обозначения" height="390px" settlingHeight={100}>
    <div className="map-legend"><button className="sheet-dismiss" aria-label="Закрыть легенду" onClick={onClose}>×</button>
      <h2>Условные обозначения</h2><h3>Мой участник</h3>
      <div className="map-legend__grid">{(['confirmed', 'leader', 'estimated', 'stale'] as const).map(state => <div key={state}>
        <RaceMapMarker number="21" supported position={state === 'leader' ? 'confirmed' : state} leader={state === 'leader'} />
        <span>{{ confirmed: 'Позиция актуальна', leader: 'Лидер', estimated: 'Расчётное положение', stale: 'Позиция устарела' }[state]}</span>
      </div>)}</div>
      <h3>Другие участники</h3><div className="map-legend__others"><div><RaceMapMarker number="2" supported={false} position="confirmed" leader={false} /><span>Те же значки, только синего цвета</span></div>
        <div><ParticipantCluster count={4} /><span>Ещё участники на маршруте</span></div></div>
      {description && <p>{description}</p>}
      <p>Позиции GPS не являются официальными местами. Расчётные варианты показаны для обозначения; карта использует подтверждённые точки.</p>
    </div>
  </ModalPage>;
}
