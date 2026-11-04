import {expect, type Page, type Request, type TestInfo} from '@playwright/test';
import {createRequire} from 'node:module';
import {fixtureResponse, stage, race, participant} from '../src/stories/fixtures';
import {news, programEvent, spectatorLocation} from '../src/stories/contentFixtures';
import {fixtureData, monitoring} from '../../admin-panel/src/stories/fixtures';
import type {Bookmark} from '../src/types/content';
import type {Pass} from '../../admin-panel/src/types';

export const front='http://127.0.0.1:5185';
export const admin='http://127.0.0.1:5186';
export interface Write {path:string;method:string;body:Record<string,unknown>;token:string|null}
export interface Reply {status?:number;data?:unknown;error?:{code:string;message:string;details?:unknown}}
export type Intercept=(request:Request,path:string)=>Promise<Reply|undefined>;
const ok=(data:unknown):Reply=>({data});
const require=createRequire(import.meta.url);

export async function publicApi(page:Page,{cards=1,brokenRoute=false,intercept}:{cards?:number;brokenRoute?:boolean;intercept?:Intercept}={}){
 const gets=new Map<string,number>(),writes:Write[]=[];
 let bookmarks:Bookmark[]=[];let reminders:number[]=[];
 const point={...spectatorLocation,location_type:'finish',name:'Зрительская зона',image_urls:[]};
 const event={...programEvent,event_type:'master_class',title:'Встреча с каюрами',start_at:'2099-01-01T01:00Z',end_at:null,location:point};
 await page.addInitScript(()=>{try{localStorage.setItem('avacha:welcome','1');}catch{/* Storage fault scenarios. */}});
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,'');
  const method=request.method();const body=request.postDataJSON() as Record<string,unknown>|null;
  if(method==='GET')gets.set(path,(gets.get(path)??0)+1);else writes.push({path,method,body:body??{},token:request.headers().authorization??null});
  let reply=await intercept?.(request,path);
  if(!reply){
   let data:unknown;
   if(path==='/me/bookmarks'){
    if(method==='PUT'){const saved={...body,created_at:'2026-11-03T00:00Z'} as unknown as Bookmark;bookmarks.push(saved);data=saved;}else data=bookmarks;
   }else if(path.startsWith('/me/bookmarks/')){bookmarks=[];data={deleted:1};}
   else if(path==='/me/reminders')data={program_event_ids:reminders};
   else if(/^\/program\/\d+\/reminder$/.test(path)){const id=Number(path.split('/')[2]);reminders=method==='DELETE'?reminders.filter(x=>x!==id):[...reminders,id];data={program_event_id:id,reminder:method!=='DELETE'};}
   else if(path==='/me/notification-settings')data={notifications_allowed:true,checkpoints:true,results:true,news:false};
   else if(path==='/me')data={vk_user_id:42,participant_id:501,race_entries:[{race_id:10,race_participant_id:9001,start_number:14}]};
   else if(path==='/news')data={items:Array.from({length:cards},(_,i)=>({...news.items[0],id:`-1_${i+1}`,post_id:i+1,title:`Новость ${i+1}`,cover_url:null})),total:cards,stale:false};
   else if(path==='/program')data=Array.from({length:cards},(_,i)=>({...event,id:i+1,title:`Встреча ${i+1}`}));
   else if(path==='/locations')data=[point];
   else if(path==='/stages/103'&&brokenRoute)data={...stage,route_geojson:{type:'Feature',geometry:{type:'LineString',coordinates:null},properties:{}}};
   else data=fixtureResponse(path+url.search);
   reply=ok(data);
  }
  await route.fulfill({status:reply.status??200,contentType:'application/json',body:JSON.stringify({data:reply.data??null,error:reply.error??null})});
 });
 // Tiles are isolated so flaky third-party servers cannot mask a Leaflet regression.
 await page.route(/^https:\/\/(?:[^/]+\.)?tile\.openstreetmap\.org\//,route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')}));
 return {gets,writes,race,participant};
}

export async function adminApi(page:Page,{intercept,storage=false}:{intercept?:Intercept;storage?:boolean}={}){
 const data=structuredClone(monitoring);const pass=data.rows[0].passes[0];
 Object.assign(pass,{arrived_at:'2026-11-03T00:01:23.123456Z',departed_at:null,note:'original'});
 const writes:Write[]=[];
 if(!storage)await page.addInitScript(()=>sessionStorage.setItem('avacha:admin-token','session-one'));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,''),method=request.method();
  const body=(request.postDataJSON()??{}) as Record<string,unknown>;
  if(method!=='GET')writes.push({path,method,body,token:request.headers().authorization??null});
  let reply=await intercept?.(request,path);
  if(!reply){
   if(path==='/admin/stages/1/monitoring')reply=ok(data);
   else if(path===`/admin/checkpoint-passes/${pass.id}`&&method==='PATCH'){
    if(body.expected_updated_at!==pass.updated_at)reply={status:409,error:{code:'conflict',message:'Отметка уже изменена',details:{current:pass}}};
    else {const {expected_updated_at,...changes}=body;void expected_updated_at;Object.assign(pass,changes,{updated_at:'2026-11-04T12:00:00Z'});reply=ok(pass);}
   }else if(path==='/admin/login')reply=ok({...fixtureData(path) as object,token:'session-two'});
   else if(method!=='GET')reply={status:503,error:{code:'fixture_only',message:'Запись изолирована тестом'}};
   else reply=ok(fixtureData(path+url.search));
  }
  await route.fulfill({status:reply.status??200,contentType:'application/json',body:JSON.stringify({data:reply.data??null,error:reply.error??null})});
 });
 return {writes,pass:pass as Pass};
}
export async function ready(page:Page,url=front+'/?vk_are_notifications_enabled=1#race=10&stage=103&section=map'){
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
}
export async function textScale(page:Page){
 await page.evaluate(()=>{
  document.documentElement.style.fontSize='32px';
  for(const element of document.querySelectorAll<HTMLElement>('[class*="vkui--"]')){
   const css=getComputedStyle(element);
   for(const key of css)if(/--vkui--font_.*--(font_size|line_height)/.test(key)){
    const n=parseFloat(css.getPropertyValue(key));if(Number.isFinite(n))element.style.setProperty(key,n*2+'px');
   }
  }
 });
}
export async function noOverflow(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
export async function accessibility(page:Page,testInfo:TestInfo){
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>{
  const axe=(window as typeof window & {axe:typeof import('axe-core')}).axe;
  return (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations;
 });
 await testInfo.attach('axe.json',{body:JSON.stringify(violations,null,2),contentType:'application/json'});
 // Explicit user decision: retain the exact Figma colors; report contrast separately.
 expect(violations.filter(v=>v.id!=='color-contrast').map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
}
