import { useState } from 'react';
import { downloadStats, useAction, useResource } from '../api';
import type { Rating } from '../types';
import { Failure, Field, LoadState, Table } from '../ui';
export function Supporters({raceId}:{raceId:number}) {
  const rating=useResource<Rating[]>(`/races/${raceId}/support-rating`);const [days,setDays]=useState(14);const action=useAction();
  return <section className="card"><h2>Поддержка участников</h2><p>Текущие счётчики и прирост за 24 часа. Динамика по дням доступна в CSV; дни считаются по Камчатке.</p><div className="toolbar"><Field label="Дней в выгрузке" type="number" min={1} max={90} value={days} onChange={e=>setDays(Number(e.target.value))}/><button disabled={action.busy||days<1||days>90} onClick={()=>void action.run(()=>downloadStats(raceId,days))}>Скачать динамику CSV</button><button onClick={rating.refresh}>Обновить рейтинг</button></div><Failure error={action.error}/><LoadState resource={rating}/>
    <Table label="Рейтинг болельщиков"><thead><tr><th>Место</th><th>Участник</th><th>Дисциплина</th><th>Болельщиков</th><th>За 24 часа</th></tr></thead><tbody>{rating.data?.map(item=><tr key={item.race_participant_id}><td>{item.rank}</td><th>№{item.start_number} · {item.full_name}</th><td>{item.discipline.name}</td><td>{item.supporters_count}</td><td>{item.change_24h>0?'+':''}{item.change_24h}</td></tr>)}</tbody></Table>{rating.data?.length===0&&<p>Поддержки в этом сезоне пока нет.</p>}
  </section>;
}
