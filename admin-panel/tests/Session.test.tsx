import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {storeToken} from '../src/api';
afterEach(()=>{vi.restoreAllMocks();storeToken(null);sessionStorage.clear();vi.unstubAllGlobals();});
it('signs in and out in memory when browser storage is blocked',async()=>{
 vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new DOMException('Blocked','SecurityError');});
 vi.spyOn(window,'sessionStorage','get').mockImplementation(()=>{throw new DOMException('Blocked','SecurityError');});
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify({data:url.endsWith('/login')?{token:'memory',expires_at:'2026-11-04T00:00Z',admin:{id:1,login:'judge',full_name:'Судья'}}:url.endsWith('/me')?{id:1,login:'judge',full_name:'Судья'}:[],error:null})));
 vi.stubGlobal('fetch',fetcher);render(<App/>);
 expect(document.documentElement.dataset.theme).toBe('light');
 await userEvent.type(screen.getByLabelText('Логин'),'judge');await userEvent.type(screen.getByLabelText('Пароль'),'secret');await userEvent.click(screen.getByRole('button',{name:'Войти'}));
 expect(await screen.findByText('Судья')).toBeVisible();
 expect(screen.getByText(/После обновления страницы потребуется войти снова/)).toBeVisible();
 expect(fetcher).toHaveBeenCalledWith('/api/admin/me',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer memory'})}));
 await userEvent.selectOptions(screen.getByLabelText('Тема'),'dark');expect(document.documentElement.dataset.theme).toBe('dark');
 await userEvent.click(screen.getByRole('button',{name:'Выйти'}));expect(screen.getByLabelText('Пароль')).toBeVisible();
});
it('signs in, checks the token, sends Bearer headers and signs out',async()=>{
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify({data:url.endsWith('/login')?{token:'t1',expires_at:'2026-11-04T00:00Z',admin:{id:1,login:'judge',full_name:'Судья'}}:url.endsWith('/me')?{id:1,login:'judge',full_name:'Судья'}:[],error:null})));
 vi.stubGlobal('fetch',fetcher); render(<App/>);
 await userEvent.type(screen.getByLabelText('Логин'),'judge');await userEvent.type(screen.getByLabelText('Пароль'),'secret');await userEvent.click(screen.getByRole('button',{name:'Войти'}));
 expect(await screen.findByText('Судья')).toBeVisible();
 expect(sessionStorage.getItem('avacha:admin-token')).toBe('t1');
 expect(fetcher).toHaveBeenCalledWith('/api/admin/me',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer t1'})}));
 await userEvent.click(screen.getByRole('button',{name:'Выйти'}));expect(screen.getByLabelText('Пароль')).toBeVisible();expect(sessionStorage.getItem('avacha:admin-token')).toBeNull();
});

it('preserves an unfinished form across token expiry and reauthentication by the same organizer',async()=>{
 const {fixtureData}=await import('../src/stories/fixtures');let expire=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{const path=url.replace('/api','');if(expire&&init?.method==='POST'&&path.includes('/stages'))return new Response(JSON.stringify({data:null,error:{message:'Сессия истекла'}}),{status:401});return new Response(JSON.stringify({data:fixtureData(path),error:null}));}));
 sessionStorage.setItem('avacha:admin-token','first');render(<App/>);await userEvent.click(await screen.findByRole('button',{name:'Гонка'}));await userEvent.type(await screen.findByLabelText('Название',{exact:true}),'Незавершённый этап');await userEvent.type(screen.getByLabelText('Номер этапа'),'2');expire=true;await userEvent.click(screen.getByRole('button',{name:'Сохранить этап'}));
 await screen.findByLabelText('Логин');await userEvent.type(screen.getByLabelText('Логин'),'ui-test');await userEvent.type(screen.getByLabelText('Пароль'),'local-ui-test-password');expire=false;await userEvent.click(screen.getByRole('button',{name:'Войти'}));
 expect(await screen.findByLabelText('Название',{exact:true})).toHaveValue('Незавершённый этап');
});
