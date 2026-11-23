const {chromium}=require('playwright');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
 const page=await browser.newPage();
 fs.mkdirSync('cases',{recursive:true});
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const manifest=[];
 async function save(id,drive){
   const config=await page.evaluate(()=>({...viewer.state,dims:{...viewer.state.dims}}));
   const xmlFile=String(manifest.length).padStart(2,'0')+'-'+drive+'-'+config.arms+'.urdf';
   const pending=page.waitForEvent('download');await page.locator('#'+id).click();
   const dl=await pending;await dl.saveAs('cases/'+xmlFile);
   manifest.push({file:xmlFile,drive,arms:config.arms,dims:config.dims,singleX:config.singleX,dualX:config.dualX,spacing:config.spacing});
 }
 async function slide(id,v){
   await page.locator('#'+id).fill(String(v));
 }
 for(const count of [0,1,2]){
   await page.reload();
   await page.locator('#geo').click();
   await page.locator('#presets [data-key="standard"]').click();
   await page.selectOption('#arms',String(count));if(count)await page.click('#autoMount');
   await save('saveBase','4wis');
   await page.click('#presets [data-key="long"]');await slide('radius',10);await slide('height',21);
   await slide('wheelWidth',8);await slide('track',42);
   if(count)await slide('armX',count===1?-173:105);
   if(count===2)await slide('spacing',128);
   await save('saveBase','4wis');
   await page.click('#move');
   for(const [i,drive] of ['diff_drive','mecanum','ackermann_front'].entries()){
     await page.locator('#pairs button').nth(i).click();await save('saveRef',drive);
   }
 }
 await page.reload();await page.click('#geo');await page.selectOption('#arms','2');await slide('length',32);await slide('width',25);
 await page.click('#autoMount');await slide('spacing',102);await slide('armX',89);
 await save('saveBase','4wis');
 await page.selectOption('#arms','1');await page.click('#autoMount');await save('saveBase','4wis');
 await page.click('#lang');
 if(await page.locator('#saveBase').innerText()!=='Download 4WISD URDF')throw Error('Language');
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('cases/manifest.json',JSON.stringify(manifest,null,2));
 console.log(manifest.length,'downloads');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
