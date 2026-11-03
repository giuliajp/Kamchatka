import { useEffect, useState } from 'react';
import { save, storeToken, tokenKey, useResource } from './api';
import type { Admin, Login, Race } from './types';
import { Field, LoadState, SaveForm, string } from './ui';
import { RaceSetup } from './pages/RaceSetup';
import { Participants } from './pages/Participants';
import { Results } from './pages/Results';
import { MonitoringPage } from './pages/Monitoring';
import { PushPage } from './pages/Push';
import { Supporters } from './pages/Supporters';
import { Content } from './pages/Content';
import './style.css';
export const pages = {monitoring:'Мониторинг',race:'Гонка',participants:'Участники',results:'Результаты',push:'Push-рассылки',supporters:'Болельщики',content:'Контент'};
export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey));
  const session = useResource<Admin>(token ? '/admin/me' : null);
  useEffect(() => { const expire = () => setToken(null); window.addEventListener('admin:expired',expire); return () => window.removeEventListener('admin:expired',expire); },[]);
  if (!token) return <main className="login"><div className="brand">АВАЧА<span>Камчатка · гонка на собачьих упряжках</span></div><section className="card"><h1>Вход организатора</h1><SaveForm label="Войти" onSave={async data => {
    const login = await save<Login>('/admin/login','POST',{login:string(data,'login'),password:string(data,'password')}); storeToken(login.token); setToken(login.token);
  }}><Field label="Логин" name="login" required autoComplete="username"/><Field label="Пароль" name="password" type="password" required autoComplete="current-password"/></SaveForm></section></main>;
  if (!session.data) return <main className="login"><LoadState resource={session}/><button onClick={() => {storeToken(null);setToken(null);}}>Выйти</button></main>;
  return <Workspace admin={session.data} onLogout={()=>{storeToken(null);setToken(null);}}/>;
}
function Workspace({admin,onLogout}:{admin:Admin;onLogout:()=>void}) {
  const [page,setPage]=useState<keyof typeof pages>('monitoring');
  const [raceId,setRaceId]=useState<number>();
  const races=useResource<Race[]>('/admin/races');
  const race=races.data?.find(r=>r.id===raceId) ?? races.data?.find(r=>r.is_current) ?? races.data?.[0];
  return <div className="admin-shell"><aside className="sidebar"><div className="brand">АВАЧА<span>Панель организатора</span></div><nav aria-label="Разделы админки">{Object.entries(pages).map(([key,title])=><button key={key} aria-current={page===key?'page':undefined} onClick={()=>setPage(key as keyof typeof pages)}>{title}</button>)}</nav><p className="sidebar-note">Время по Камчатке<br/>UTC+12</p></aside>
    <div className="workspace"><header className="topbar"><label>Сезон<select value={race?.id ?? ''} onChange={event=>setRaceId(Number(event.target.value))}>{races.data?.map(r=><option key={r.id} value={r.id}>{r.year} · {r.name}</option>)}</select></label><span>{admin.full_name}</span><button onClick={onLogout}>Выйти</button></header>
      <main><div className="page-title"><div><small>{race?.name || 'Сезоны'}</small><h1>{pages[page]}</h1></div></div><LoadState resource={races}/>{!race && page!=='race' && <p>Создайте первый сезон в разделе «Гонка».</p>}<div key={race?.id}>{page==='race'&&<RaceSetup race={race}/>} {race&&<>{page==='monitoring'&&<MonitoringPage raceId={race.id}/>} {page==='participants'&&<Participants raceId={race.id}/>} {page==='results'&&<Results raceId={race.id}/>} {page==='push'&&<PushPage raceId={race.id}/>} {page==='supporters'&&<Supporters raceId={race.id}/>} {page==='content'&&<Content raceId={race.id}/>}</>}</div></main>
    </div></div>;
}
