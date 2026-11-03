import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
afterEach(()=>{sessionStorage.clear();vi.unstubAllGlobals();});
it('signs in, checks the token, sends Bearer headers and signs out',async()=>{
 const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify({data:url.endsWith('/login')?{token:'t1',expires_at:'2026-11-04T00:00Z',admin:{id:1,login:'judge',full_name:'Судья'}}:url.endsWith('/me')?{id:1,login:'judge',full_name:'Судья'}:[],error:null})));
 vi.stubGlobal('fetch',fetcher); render(<App/>);
 await userEvent.type(screen.getByLabelText('Логин'),'judge');await userEvent.type(screen.getByLabelText('Пароль'),'secret');await userEvent.click(screen.getByRole('button',{name:'Войти'}));
 expect(await screen.findByText('Судья')).toBeVisible();
 expect(sessionStorage.getItem('avacha:admin-token')).toBe('t1');
 expect(fetcher).toHaveBeenCalledWith('/api/admin/me',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer t1'})}));
 await userEvent.click(screen.getByRole('button',{name:'Выйти'}));expect(screen.getByLabelText('Пароль')).toBeVisible();expect(sessionStorage.getItem('avacha:admin-token')).toBeNull();
});
