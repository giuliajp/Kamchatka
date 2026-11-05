import { useState } from 'react';
import { Failure } from '../ui';
import { useAction } from '../api';
import type { BatterySample, MonitoringPresentation } from '../monitoringPresentation';
import type { Monitoring } from '../types';

export function CheckpointEvidence({ model, checkpoints, history = [] }: {
  model: NonNullable<MonitoringPresentation['checkpointEvidence']>;
  checkpoints: Monitoring['checkpoints'];
  history?: MonitoringPresentation['history'];
}) {
  const [draft, setDraft] = useState(model.initial);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('entry');
  const action = useAction();
  const change = (patch: Partial<typeof draft>) => { setSaved(false); setDraft(value => ({ ...value, ...patch })); };
  return <section className="checkpoint-evidence">
    <div className="tabs" aria-label="Судейская отметка"><button aria-pressed={tab === 'entry'} onClick={() => setTab('entry')}>Отметка</button><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>Журнал действий ({history.length})</button></div>
    <form hidden={tab !== 'entry'} onSubmit={event => { event.preventDefault(); void action.run(() => model.onConfirm(draft)); }}>
      <div className="evidence-time"><label className="field">Контрольный пункт<select required value={draft.checkpointId} onChange={event => change({ checkpointId: Number(event.target.value) })}>{checkpoints.map(cp => <option key={cp.stage_checkpoint_id} value={cp.stage_checkpoint_id}>{cp.label || cp.name}</option>)}</select></label><label className="field">Время (местное)<input type="time" required value={draft.arrivedAt} onChange={event => change({ arrivedAt: event.target.value })}/></label></div>
      <label className="field">Источник подтверждения<select value={draft.source} onChange={event => change({ source: event.target.value })}><option>Судейский протокол</option><option>Радиосвязь с КП</option><option>Спутниковый телефон судьи</option></select></label>
      <label className="field">Фото протокола{draft.attachmentName ? <span className="evidence-attachment">{draft.attachmentName}<button type="button" className="close-button" aria-label="Удалить вложение" onClick={() => change({ attachmentName: '' })}>×</button></span> : <input type="file" accept="image/*,.pdf" onChange={event => change({ attachmentName: event.target.files?.[0]?.name ?? '' })}/>}</label>
      <label className="field">Комментарий<textarea value={draft.note} onChange={event => change({ note: event.target.value })}/></label>
      <p className="notice warning">Правка опубликованной отметки: сохранить автора, время, до/после и уведомить суперадмина.</p>
      <div className="actions"><button type="button" className="outline" disabled={action.busy} onClick={() => { model.onDraft(draft); setSaved(true); }}>Сохранить черновик</button><button type="submit" className="primary" disabled={action.busy}>Сохранить и опубликовать</button></div>
      {saved && <p role="status">Черновик сохранён</p>}<Failure error={action.error}/>
    </form>
    {tab === 'history' && <div aria-label="История отметки">{history.length ? history.map(item => <article key={item.id}><small>{item.time} · {item.author}</small><p>{item.description}</p></article>) : <p>История пока пуста.</p>}</div>}
  </section>;
}
export function BatteryHistory({ samples }: { samples: BatterySample[] }) {
  return <section className="battery-history"><h3>Батарея за последние 24 часа</h3>{samples.length ? <><svg viewBox="0 0 420 136" role="img" aria-label="История заряда батареи"><path d="M32 12V112H410" stroke="currentColor" opacity=".25" fill="none"/><text x="0" y="16">100%</text><text x="7" y="116">0%</text><polyline points={samples.map((sample,index) => `${32+index*378/Math.max(1,samples.length-1)},${112-Math.max(0,Math.min(100,sample.percent))}`).join(' ')} stroke="var(--accent)" strokeWidth="2" fill="none"/>{samples.map((sample,index) => <text key={index} x={32+index*378/Math.max(1,samples.length-1)} y="132" textAnchor={index===0?'start':index===samples.length-1?'end':'middle'}>{sample.label}</text>)}</svg><details><summary>Значения заряда</summary><dl>{samples.map((sample,index) => <div key={index}><dt>{sample.label}</dt><dd>{sample.percent}%</dd></div>)}</dl></details></> : <p>История батареи пока недоступна.</p>}</section>;
}
