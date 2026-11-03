import type { InputHTMLAttributes, ReactNode } from 'react';
import { ApiError, useAction, type Resource } from './api';
export function Failure({ error }: { error?: Error }) {
  return error ? <div className="notice danger" role="alert"><strong>{error.message}</strong>{error instanceof ApiError && error.code && <small>{error.code}</small>}{error instanceof ApiError && error.details !== undefined && <pre>{JSON.stringify(error.details, null, 2)}</pre>}</div> : null;
}
export function LoadState({ resource }: { resource: Resource<unknown> }) {
  return <>{resource.loading && <p role="status">Загрузка…</p>}<Failure error={resource.error} />{resource.error && <button onClick={resource.refresh}>Повторить загрузку</button>}</>;
}
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="field">{label}<input {...props} /></label>; }
export function SaveForm({ children, onSave, label = 'Сохранить', confirm }: { children: ReactNode; onSave: (data: FormData) => Promise<unknown>; label?: string; confirm?: string }) {
  const action = useAction();
  return <form className="edit-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (!confirm || window.confirm(confirm)) void action.run(() => onSave(data)); }}>
    <fieldset disabled={action.busy}>{children}<button className="primary" type="submit">{action.busy ? 'Сохраняем…' : label}</button></fieldset><Failure error={action.error} />{action.done && <p role="status" className="success">Сохранено</p>}
  </form>;
}
export const string = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export const optional = (data: FormData, key: string) => string(data,key) || null;
export const numeric = (data: FormData, key: string) => string(data,key) === '' ? null : Number(string(data,key));
export const kamchatkaInput = (iso: string | null) => iso ? new Date(Date.parse(iso) + 12 * 3600000).toISOString().slice(0,16) : '';
export const kamchatkaValue = (data: FormData, key: string) => string(data,key) ? `${string(data,key)}+12:00` : null;
export const time = (iso: string | null) => iso ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Kamchatka',dateStyle:'short',timeStyle:'short'}).format(new Date(iso)) : '—';
export function Table({ children, label }: { children: ReactNode; label: string }) { return <div className="table-scroll" tabIndex={0} role="region" aria-label={label}><table>{children}</table></div>; }
export function Status({ value }: { value: string }) {
  const labels: Record<string,string> = { upcoming:'Ожидается',planned:'Запланирован',live:'Идёт',finished:'Завершён',cancelled:'Отменён',registered:'Заявлен',active:'На дистанции',dnf:'DNF',dns:'DNS',dsq:'DSQ',out_of_competition:'Вне зачёта',draft:'Черновик',preliminary:'Опубликован',final:'Окончательный',sos:'SOS',overdue:'Просрочка',ok:'На связи',no_tracker:'Без трекера' };
  return <span className={`status status--${value}`}>{labels[value] || value}</span>;
}
export function ConfirmButton({ children, question, action: operation, disabled = false }: {children:ReactNode;question:string;action:()=>Promise<unknown>;disabled?:boolean}) {
  const action = useAction(); return <span className="confirm-action"><button disabled={disabled || action.busy} onClick={() => { if(window.confirm(question)) void action.run(operation); }}>{children}</button><Failure error={action.error}/></span>;
}
