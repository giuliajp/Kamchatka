import { useCallback, useEffect, useState } from 'react';
import { ResourceAccess, save, storeToken, tokenKey, useResource } from './api';
import type { Admin, Alert, Login, Race } from './types';
import { Field, LoadState, SaveForm, string } from './ui';
import { RaceSetup } from './pages/RaceSetup';
import { Participants } from './pages/Participants';
import { Results } from './pages/Results';
import { MonitoringPage } from './pages/Monitoring';
import { PushPage } from './pages/Push';
import { Supporters } from './pages/Supporters';
import { Content } from './pages/Content';
import { Icon20UsersOutline, Icon28FlagOutline, Icon24BroadcastOutline, Icon20DocumentOutline, Icon20SendOutline, Icon20LikeOutline, Icon20DocumentStatsOutline } from '@vkontakte/icons';
import { Status } from './ui';
import './style.css';
export const pages = {participants:'Участники',race:'Гонка',monitoring:'Мониторинг оборудования',results:'Результаты',content:'Контент',push:'Push-рассылки',supporters:'Статистика болельщиков'};
const pageIcons = {participants:Icon20UsersOutline,race:Icon28FlagOutline,monitoring:Icon24BroadcastOutline,results:Icon20DocumentStatsOutline,content:Icon20DocumentOutline,push:Icon20SendOutline,supporters:Icon20LikeOutline};
function Brand(){return <div className="brand"><span className="brand-logo" role="img" aria-label="Берингия. Авача"/><span>Центр управления гонкой</span></div>;}
export function App() {
  const [theme,setTheme]=useState(()=>localStorage.getItem('avacha:admin-theme') || 'light');
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('avacha:admin-theme',theme);},[theme]);
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey));
  const [verified, setVerified] = useState<{token:string;admin:Admin}>();
  const accept = useCallback((token:string,admin:Admin)=>setVerified({token,admin}),[]);
  const logout = () => {storeToken(null);setToken(null);setVerified(undefined);};
  const authenticated = Boolean(token && verified?.token === token);
  useEffect(() => { const expire = () => setToken(null); window.addEventListener('admin:expired',expire); return () => window.removeEventListener('admin:expired',expire); },[]);
  return <>{!token && <main className="login"><Brand/><section className="card"><h1>Вход организатора</h1><SaveForm label="Войти" onSave={async data => {
    const login = await save<Login>('/admin/login','POST',{login:string(data,'login'),password:string(data,'password')}); storeToken(login.token); setToken(login.token);
  }}><Field label="Логин" name="login" required autoComplete="username"/><Field label="Пароль" name="password" type="password" required autoComplete="current-password"/></SaveForm></section></main>}
    {token && !authenticated && <Session key={token} token={token} accept={accept} logout={logout}/>}
    {verified && <ResourceAccess value={authenticated}><div hidden={!authenticated}><Workspace key={verified.admin.id} admin={verified.admin} onLogout={logout} theme={theme} setTheme={setTheme}/></div></ResourceAccess>}
  </>;
}
function Session({token,accept,logout}:{token:string;accept:(token:string,admin:Admin)=>void;logout:()=>void}) {
  const session = useResource<Admin>('/admin/me');
  useEffect(()=>{if(session.data)accept(token,session.data);},[token,session.data,accept]);
  return <main className="login"><LoadState resource={session}/><button onClick={logout}>Выйти</button></main>;
}
function Workspace({admin,onLogout,theme,setTheme}:{admin:Admin;onLogout:()=>void;theme:string;setTheme:(value:string)=>void}) {
  const [page,setPage]=useState<keyof typeof pages>('monitoring');
  const [raceId,setRaceId]=useState<number>();
  const races=useResource<Race[]>('/admin/races');
  const race=races.data?.find(r=>r.id===raceId) ?? races.data?.find(r=>r.is_current) ?? races.data?.[0];
  const alerts=useResource<Alert[]>(race?`/admin/races/${race.id}/alerts?active=true`:null,30000);
  return <div className="admin-shell"><aside className="sidebar"><Brand/><nav aria-label="Разделы админки">{Object.entries(pages).map(([key,title])=>{const Icon=pageIcons[key as keyof typeof pages];return <button key={key} aria-current={page===key?'page':undefined} onClick={()=>setPage(key as keyof typeof pages)}><Icon width={20} height={20} aria-hidden/><span>{title}</span></button>;})}</nav><p className="sidebar-note">Время по Камчатке<br/>UTC+12</p></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumbs"><label><span className="sr-only">Сезон</span><select value={race?.id ?? ''} onChange={event=>setRaceId(Number(event.target.value))}>{races.data?.map(r=><option key={r.id} value={r.id}>{r.year} · {r.name}</option>)}</select></label><span>/ {pages[page]}</span></div>{race&&<Status value={race.status}/>}{Boolean(alerts.data?.length)&&<button className="header-sos" onClick={()=>setPage('monitoring')}>Активный SOS · {alerts.data!.length}</button>}<div className="operator"><span className="avatar" aria-hidden>{admin.full_name.slice(0,1)}</span><div><strong>{admin.full_name}</strong><small>Оператор гонки</small></div></div><label className="theme-picker"><span className="sr-only">Тема</span><select value={theme} onChange={e=>setTheme(e.target.value)}><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label><button className="link-button logout" onClick={onLogout}>Выйти</button></header>
      <main>{page!=='monitoring'&&<div className="page-title"><h1>{pages[page]}</h1></div>}<LoadState resource={races}/>{!race && page!=='race' && <p>Создайте первый сезон в разделе «Гонка».</p>}<div key={race?.id}>{page==='race'&&<RaceSetup race={race}/>} {race&&<>{page==='monitoring'&&<MonitoringPage raceId={race.id}/>} {page==='participants'&&<Participants raceId={race.id}/>} {page==='results'&&<Results raceId={race.id}/>} {page==='push'&&<PushPage raceId={race.id}/>} {page==='supporters'&&<Supporters raceId={race.id}/>} {page==='content'&&<Content raceId={race.id}/>}</>}</div><footer className="workspace-footer"><span>{race?.name} · Только для организаторов</span><span>Время по Камчатке · UTC+12</span></footer></main>
    </div></div>;
}
