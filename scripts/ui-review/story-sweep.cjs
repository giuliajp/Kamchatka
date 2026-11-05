const {chromium}=require('../../frontend/node_modules/playwright');
const fs=require('node:fs/promises'); const path=require('node:path');
(async()=>{
 const label=process.argv[2]||'frontend'; const port=label==='admin'?6007:6006; const base=path.resolve(__dirname,'../../output/ui-review/fixes'); const out=base+'/'+label; await fs.mkdir(out,{recursive:true});await fs.mkdir(out+'/stories',{recursive:true});
 const idx=await (await fetch('http://127.0.0.1:'+port+'/index.json')).json();const entries=Object.values(idx.entries).filter(s=>s.type==='story');
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];let cursor=0;
 await Promise.all(Array.from({length:2},async()=>{
  const page=await browser.newPage({viewport:label==='admin'?{width:1920,height:1552}:{width:360,height:800},deviceScaleFactor:1,colorScheme:'light'});page.setDefaultTimeout(8000);
  while(cursor<entries.length){const i=cursor++;const e=entries[i];const name=String(i+1).padStart(3,'0');
   try{await page.goto('http://127.0.0.1:'+port+'/iframe.html?id='+encodeURIComponent(e.id)+'&viewMode=story');await page.locator('#storybook-root > :not(style)').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
    await page.screenshot({path:out+'/stories/'+name+'.png',animations:'disabled'});
    const measures=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.slice(0,2000),brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src'))}));results.push({...e,file:'stories/'+name+'.png',...measures});
   }catch(error){results.push({...e,file:'stories/'+name+'.png',error:String(error)})}
   await fs.writeFile(out+'/story-sweep.json',JSON.stringify(results,null,2));
  }await page.close();
 }));await browser.close();console.log('stories',results.length,'overflow',results.filter(x=>x.scroll>x.width).map(x=>x.id),'errors',results.filter(x=>x.error).length);
})().catch(e=>{console.error(e);process.exitCode=1});
