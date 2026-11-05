const {chromium}=require('../../frontend/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/ui-review/fixes');
const ts=require(root+'/frontend/node_modules/typescript');
async function moduleFixture(name){const code=ts.transpileModule(await fs.readFile(root+'/frontend/src/stories/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const ex={};new Function('exports','location',code)(ex,{search:''});return ex;}
async function launch(){await fs.mkdir(out,{recursive:true});return chromium.launch({channel:'chrome',headless:true});}
async function context(browser,{size=[360,800],theme='light',real=false,welcome=false,transform,allowed=true,own=true}={}){
 const ctx=await browser.newContext({viewport:{width:size[0],height:size[1]},deviceScaleFactor:1,colorScheme:theme});
 const fx=await moduleFixture('fixtures'),cf=await moduleFixture('contentFixtures');let supported=false,reminders=[],bookmarks=[];
 const pic='http://127.0.0.1:5175/figma/352-8418/b9ffe.png';
 const place={...cf.spectatorLocation,location_type:'finish',name:'Точка финиша этапа 3: с. Пиначево',image_urls:[pic,pic]};
 const event={...cf.programEvent,event_type:'master_class',title:'Мастер-класс для детей',image_urls:[pic,pic],location:place};
 const dataFor=(url,method,body)=>{
  const u=new URL(url),p=u.pathname.replace(/^\/api/,'');
  if(p==='/program')return [event,{...event,id:2,event_type:'meeting',title:'Встреча с каюрами',start_at:'2026-11-03T03:00Z',end_at:'2026-11-03T04:00Z'}];
  if(p==='/locations')return [place];
  if(p==='/me')return {vk_user_id:42,participant_id:own?501:null,race_entries:own?[{race_id:10,race_participant_id:9001,start_number:14}]:[]};
  if(p==='/me/notification-settings')return {notifications_allowed:allowed,checkpoints:true,results:true,news:false};
  if(p==='/me/reminders'){return {program_event_ids:reminders};}
  if(/^\/program\/\d+\/reminder$/.test(p)){reminders=method==='DELETE'?[]:[Number(p.split('/')[2])];return {program_event_id:Number(p.split('/')[2]),reminder:method!=='DELETE'};}
  if(p.startsWith('/me/reminders/')){reminders=method==='DELETE'?[]:[Number(p.split('/').at(-1))];return {program_event_ids:reminders};}
  if(p==='/me/bookmarks')return bookmarks;
  if(p==='/stages/103')return {...fx.stage,protocol_pdf_url:'https://example.org/protocol.pdf'};
  if(p==='/races')return [fx.race,{...fx.race,id:11,year:2025,name:'Авача 2025',status:'finished'}];
  if(p==='/races/11')return {...fx.race,id:11,year:2025,name:'Авача 2025',status:'finished',protocol_pdf_url:'https://example.org/protocol.pdf'};
  if(p==='/photos/albums')return {items:[{id:1,title:'Авача 2025',size:2,url:'https://vk.com/album-1_1',cover_url:pic}],stale:false};
  if(p==='/photos')return {...cf.photos,days:cf.photos.days.map(d=>({...d,photos:d.photos.map(x=>({...x,url:pic}))}))};
  if(p==='/news')return {...cf.news,items:cf.news.items.map(x=>({...x,cover_url:pic}))};
  if(p==='/faq')return [cf.faq];if(p==='/contacts')return [cf.contact];
  if(p.endsWith('/arrival-estimate'))return {stage_id:103,generated_at:fx.stage.start_at,tracking_interval_minutes:20,first:{from:'2026-11-03T02:00Z',to:'2026-11-03T02:30Z'},leaders:[],note:'Оценка по GPS-трекерам, время может измениться'};
  if(p==='/guest-info')return {how_to_get_there:[{id:1,title:'На автомобиле',text:'Информация о проезде от организаторов.'}],what_to_bring:[{id:2,title:null,text:'Тёплая одежда и термос.'}],safety:[{id:3,title:null,text:'Не выходите на трассу.'}]};
  if(p==='/races/10/participants')return [fx.participant].filter(x=>!u.searchParams.get('q')||x.full_name.toLowerCase().includes(u.searchParams.get('q').toLowerCase())).map(x=>({...x,photo_url:pic,dog_breed:'Ездовые лайки'}));
  if(p.endsWith('/support')){if(method==='PUT')supported=true;if(method==='DELETE')supported=false;return {race_participant_id:9001,supporters_count:15+Number(supported),change_24h:2,is_supported:supported,notifications_enabled:allowed&&supported};}
  if(p==='/me/supports')return supported?[{race_id:10,race_participant_id:9001,full_name:fx.participant.full_name,start_number:14,photo_url:pic,discipline:fx.discipline,notifications_enabled:allowed,supported_since:fx.stage.start_at}]:[];
  return fx.fixtureResponse(url);
 };
 if(!welcome)await ctx.addInitScript(()=>localStorage.setItem('avacha:welcome','1'));
 if(!real)await ctx.route(/^http:\/\/127\.0\.0\.1:5175\/api\//,async r=>{
  try{let data=dataFor(r.request().url(),r.request().method(),r.request().postDataJSON());if(transform)data=transform(data,r.request().url());await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,error:null})});}
  catch(e){await r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({data:null,error:{code:'AUDIT',message:String(e),details:null}})});}
 });
 const page=await ctx.newPage();page.setDefaultTimeout(5000);return {ctx,page,fx};
}
async function ready(page,fragment=''){await page.goto('http://127.0.0.1:5175/'+fragment,{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});await page.locator('.race-screen__footer').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);}

async function metrics(p){return p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,weight:s.fontWeight,color:s.color,bg:s.backgroundColor,overflow:s.overflow,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};};
 const selectors=['.race-screen__header','.race-screen__header h1','.race-stage-select','[role=tablist]','.race-screen__map','.map-leaders-slot','.map-time','.map-controls','.race-screen__footer','.map-participant','.map-participant__tags','.map-participant__bio','.map-participant__stats','.map-participant__actions','.map-legend','.results-scroll'];
 const boxes=Object.fromEntries(selectors.flatMap(s=>{const el=document.querySelector(s);return el?[[s,rect(el)]]:[]}));
 const candidates=[...document.querySelectorAll('button,input,select,[role=tab],h1,h2,h3,p,span')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&!e.closest('.leaflet-pane')});
 const offscreen=candidates.filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,90),class:e.className,...rect(e)}));
 const clipped=candidates.filter(e=>{const s=getComputedStyle(e);return ['hidden','clip'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+1}).map(e=>({text:e.innerText?.slice(0,90),class:e.className,...rect(e)}));
 const targets=[...document.querySelectorAll('button,[role=tab],input')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.top>=0&&r.bottom<=innerHeight}).map(e=>({name:e.getAttribute('aria-label')||e.innerText,rect:rect(e)}));
 return {viewport:{w:innerWidth,h:innerHeight},document:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight},boxes,offscreen,clipped,smallTargets:targets.filter(e=>e.rect.w<44||e.rect.h<44)};
 });}

async function shot(p,name,report,fullPage=false,axe=false){await p.waitForTimeout(400);await p.screenshot({path:out+'/'+name+'.png',fullPage,animations:'disabled'});const r={name,url:p.url(),text:await p.locator('body').innerText(),...await metrics(p)};if(axe){await p.addScriptTag({path:root+'/frontend/node_modules/axe-core/axe.js'});r.axe=await p.evaluate(async()=>{const x=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return x.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}));});}report.states.push(r);await fs.writeFile(out+'/'+report.file,JSON.stringify(report,null,2));return r;}
async function scale(p){await p.evaluate(()=>{document.documentElement.style.fontSize='32px';for(const el of document.querySelectorAll('.ui-root')){const css=getComputedStyle(el);for(const k of css){if(/--vkui--font_.*--(font_size|line_height)/.test(k)){const v=parseFloat(css.getPropertyValue(k));if(Number.isFinite(v))el.style.setProperty(k,v*2+'px');}}}});}
module.exports={fs,path,root,out,launch,context,ready,shot,scale,metrics};
