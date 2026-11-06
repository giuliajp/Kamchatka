// Read the existing UI-created audit dataset. No business writes, seeds or API mocks.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('../frontend/node_modules/playwright');
const front=process.env.AUDIT_FRONT || 'http://127.0.0.1:5198';
const admin=process.env.AUDIT_ADMIN || 'http://127.0.0.1:5199';
const out=path.resolve(__dirname,'../output/journey-fixes/evidence');
(async()=>{
 const credentials=JSON.parse(await fs.readFile(process.env.AUDIT_CREDENTIALS,'utf8'));
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true});
 const results=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:360,height:800}});
  context.setDefaultTimeout(10000);
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const p=await context.newPage();await p.goto(front);
  await p.getByRole('button',{name:'Начать',exact:true}).click();await p.getByRole('button',{name:'Пропустить',exact:true}).click();
  await p.goto(front+'/#race=1&section=participants&stage=1&discipline=ski_2');
  const opener=p.getByRole('button',{name:'Открыть карточку Иванов Алексей',exact:true});await opener.waitFor();
  const tabs=p.getByRole('tablist',{name:'Фильтр участников'}).getByRole('tab');
  const a=await tabs.nth(0).boundingBox(),b=await tabs.nth(1).boundingBox();
  assert(Math.abs(a.y-b.y)<=4);assert((await opener.boundingBox()).height<=82);
  results.push({id:'BUG-01',passed:true,filterY:[a.y,b.y],rowHeight:(await opener.boundingBox()).height});
  await p.screenshot({path:path.join(out,'participants-360.png'),fullPage:true});
  await opener.click();await p.getByRole('dialog',{name:'Карточка участника'}).waitFor();
  assert.equal(await p.locator('[data-focus-guard]').count(),2);
  await p.getByRole('button',{name:'Свернуть',exact:true}).focus();
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<18;i++){
   await p.keyboard.press(key);assert(await p.evaluate(()=>!!document.activeElement.closest('[role=dialog]')));
  }
  await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'detached'});
  assert(await opener.evaluate(e=>e===document.activeElement));results.push({id:'BUG-06',passed:true});
  await p.goto(front+'/#race=1&section=program&day=2026-11-07&view=watch');
  for(let i=0;i<2;i++){
   const marker=p.locator('.content-map path.leaflet-interactive').first();await marker.waitFor();await marker.click();
   const close=p.getByRole('button',{name:'Закрыть карточку',exact:true});await close.waitFor();await close.click();
   await p.getByRole('dialog').waitFor({state:'detached'});await p.reload();
  }
  await p.locator('.content-map path.leaflet-interactive').first().waitFor();
  await p.screenshot({path:path.join(out,'watch-real-gpx.png'),fullPage:true});results.push({id:'BUG-08',passed:true});
  for(const [name,route,text] of [
   ['results','race=1&section=results&stage=1','04:02:00'],
   ['profile','race=1&section=more&page=profile','Протокол'],
   ['empty-day','race=1&section=program&day=2026-11-08','Мероприятий нет. Выберите другой день.'],
  ]){await p.goto(front+'/#'+route);await p.getByText(text,{exact:false}).first().waitFor();results.push({id:name,passed:true});}
  await p.goto(front+'/#race=1&section=results&view=archive');
  await p.getByText('Материалы VK временно недоступны. Попробуйте позже',{exact:true}).waitFor();
  assert(!((await p.locator('body').innerText()).includes('backend/.env')));results.push({id:'BUG-03',passed:true});
  const adm=await context.newPage();await adm.setViewportSize({width:1280,height:900});await adm.goto(admin+'/#section=monitoring&race=1&stage=1');
  await adm.getByLabel('Логин').fill(credentials.login);await adm.getByLabel('Пароль').fill(credentials.password);await adm.getByRole('button',{name:'Войти',exact:true}).click();
  await adm.getByRole('button',{name:/№11 · Иванов Алексей/}).waitFor();
  const online=adm.getByRole('button',{name:'На связи',exact:true});assert((await online.innerText()).includes('0'));
  assert.equal(await adm.locator('tr[data-state=no_data]').count(),1);
  await adm.screenshot({path:path.join(out,'monitoring-no-points.png'),fullPage:true});results.push({id:'BUG-04',passed:true});
  await adm.getByText('Инструменты этапа',{exact:true}).click();await adm.getByRole('button',{name:'Трекеры',exact:true}).click();
  assert.equal(await adm.locator('details.monitor-tools-menu').getAttribute('open'),null);
  await adm.getByLabel('IMEI',{exact:true}).waitFor();results.push({id:'BUG-05',passed:true});
  await adm.screenshot({path:path.join(out,'tools-closed.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log(`${results.length} live readback checks passed; no page errors`);
 }finally{
  await fs.writeFile(path.join(out,'live-readback.json'),JSON.stringify({results,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
