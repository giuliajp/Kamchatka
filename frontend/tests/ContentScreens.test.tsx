import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ProgramScreen } from '../src/screens/Content/ProgramScreen';
import { MediaScreen } from '../src/screens/Content/MediaScreen';
import { fixtureResponse } from './fixtures';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const event = { id:1,race_id:10,stage_id:null,event_type:'festival',title:'Встреча',description:null,start_at:'2026-11-03T23:00:00Z',end_at:null,location:null,sort_order:0 };
it('loads the selected season and filters program by Kamchatka day and event type', async () => {
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify({data:url.includes('/program?')?[event]:fixtureResponse(url),error:null})));
  vi.stubGlobal('fetch',fetcher);
  const {rerender}=render(<AppProviders><ProgramScreen raceId={10}/></AppProviders>);
  expect(await screen.findByText('Встреча')).toBeVisible(); expect(screen.getByText('04.11 · Фестиваль')).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText('Тип события'),'stage_start');
  expect(screen.queryByText('Встреча')).not.toBeInTheDocument();
  rerender(<AppProviders><ProgramScreen raceId={11}/></AppProviders>);
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('race_id=11'),expect.anything()));
});
it('hides unavailable media silently, marks stale content, and keeps links to VK',async()=>{
  vi.stubGlobal('fetch',vi.fn(async (url:string)=> url.includes('/news') ? new Response(JSON.stringify({data:null,error:{message:'VK unavailable'}}),{status:503}) : new Response(JSON.stringify({data:url.includes('/photos')?{days:[{date:'2026-11-04',photos:[{id:'p1',date:'2026-11-03T23:00Z',text:'На старте',url:null,vk_url:'https://vk.com/photo-1_1'}]}],stale:true}:fixtureResponse(url),error:null}))));
  render(<AppProviders><MediaScreen/></AppProviders>);
  expect(await screen.findByText('На старте')).toBeVisible();
  expect(screen.getByText(/Сохранённая версия/)).toBeVisible();
  expect(screen.queryByRole('heading',{name:'Новости'})).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Открыть фото в VK'})).toHaveAttribute('href','https://vk.com/photo-1_1');
});
