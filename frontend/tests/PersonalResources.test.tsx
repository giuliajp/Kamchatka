import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {AppProviders} from '../src/app/AppProviders';
import {BookmarkButton} from '../src/screens/Content/MediaScreen';
import {ReminderButton} from '../src/screens/Content/ReminderButton';
import {fixtureResponse} from './fixtures';
import type {Bookmark} from '../src/types/content';

afterEach(()=>{vi.unstubAllGlobals();history.replaceState(null,'','/');localStorage.clear();});
it('shares personal lists across 40 cards, refreshes only the changed list and clears them on identity change',async()=>{
 history.replaceState(null,'','/?vk_are_notifications_enabled=1');
 let bookmarks:Bookmark[]=[];let reminders:number[]=[];
 const gets=new Map<string,number>();
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=String(input).replace('/api','');const method=init?.method ?? 'GET';let data:unknown;
  if(method==='GET'){
   gets.set(path,(gets.get(path) ?? 0)+1);
   data=path==='/me/bookmarks'?bookmarks:path==='/me/reminders'?{program_event_ids:reminders}:fixtureResponse(path);
  }else if(path==='/me/bookmarks'){
   const item={...JSON.parse(String(init?.body)),created_at:'2026-11-03T00:00Z'};bookmarks=[item];data=item;
  }else if(path==='/program/1/reminder'){reminders=[1];data={program_event_id:1,reminder:true};}
  else data=fixtureResponse(path);
  return new Response(JSON.stringify({data,error:null}));
 }));
 render(<AppProviders>{Array.from({length:40},(_,i)=><article key={i}>
  <BookmarkButton item={{kind:'news',item_id:String(i+1),title:'News',url:'https://vk.com/wall-1_1',image_url:null}}/>
  <ReminderButton eventId={i+1} startAt="2099-01-01T00:00Z"/>
 </article>)}</AppProviders>);
 const firstCard=()=>within(document.querySelector('article')!);
 expect(document.querySelectorAll('article')).toHaveLength(40);
 await waitFor(()=>expect(firstCard().getByRole('button',{name:'Сохранить'})).toBeEnabled(),{timeout:10000});
 expect(gets.get('/me/bookmarks')).toBe(1);expect(gets.get('/me/reminders')).toBe(1);
 const baseline=new Map(gets);
 await userEvent.click(firstCard().getByRole('button',{name:'Сохранить'}));
 await firstCard().findByRole('button',{name:'Убрать из сохранённого'});
 expect(gets.get('/me/bookmarks')).toBe(2);
 for(const [path,count] of baseline)if(path!=='/me/bookmarks')expect(gets.get(path),path).toBe(count);
 await userEvent.click(firstCard().getByRole('button',{name:'Напомнить о событии'}));
 await firstCard().findByRole('button',{name:'Отменить напоминание'});
 expect(gets.get('/me/reminders')).toBe(2);expect(gets.get('/me/bookmarks')).toBe(2);
 expect(Object.keys(localStorage).some(key=>key.includes('/me/'))).toBe(false);
 bookmarks=[];reminders=[];
 act(()=>{history.replaceState(null,'','/?vk_user_id=99');window.dispatchEvent(new Event('popstate'));});
 expect(screen.queryByRole('button',{name:'Убрать из сохранённого'})).not.toBeInTheDocument();
 await waitFor(()=>expect(firstCard().getByRole('button',{name:'Сохранить'})).toBeEnabled(),{timeout:10000});
 expect(gets.get('/me/bookmarks')).toBe(3);expect(gets.get('/me/reminders')).toBe(3);
},15000);
