const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main(){
  const url=process.argv[2] || pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined,args:['--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(()=>window.viewer?.state.tab==='route' && viewer.state.time>.1);
    assert(await page.locator('#lapSummary').isVisible());
    assert(await page.locator('#panel-b').isHidden());
    const metrics=await page.evaluate(()=>{
      const {frames,tracks,distance}=XmobotRoute;
      let error=0;
      // Differentiate the rendered wheel tracks independently of the chassis Jacobian.
      for(let i=1;i<frames.length-1;i++){
        for(let j=0;j<4;j++){
          const [steer,speed]=frames[i].w[j],heading=frames[i].p[2]+steer;
          const [dx,dy]=tracks[j][i+1].map((v,axis)=>(v-tracks[j][i-1][axis])*12);
          error=Math.max(error,Math.hypot(dx-speed*Math.cos(heading),dy-speed*Math.sin(heading)));
        }
      }
      return {length:distance.at(-1),end:frames.at(-1).p,error,count:tracks.length};
    });
    assert(Math.abs(metrics.length-25.22)<.02);
    assert(Math.hypot(metrics.end[0],metrics.end[1])<1e-4);
    assert(Math.abs(metrics.end[2])<1e-4);
    assert(metrics.error<.016, String(metrics.error));
    assert.equal(metrics.count,4);
    await page.locator('#seek').fill('19');
    assert.equal(await page.locator('#value-a').innerText(),'向左横移');
    assert(await page.locator('.brand-logo').evaluate(img=>img.complete && img.naturalWidth>0));
    const maneuvers=await page.evaluate(()=>{
      const {frames,indexAt,stages}=XmobotRoute;
      const axleChecks=[[30.25,40.75,0,-1],[42.25,52.75,2,1]].map(([from,to,steered,yawSign])=>{
        for(let i=indexAt(from);i<=indexAt(to);i++){
          const {p,w}=frames[i];
          if((p[2]-frames[i-1].p[2])*yawSign<=0)return false;
          if(!w.every(([angle],j)=>Math.floor(j/2)===steered/2?angle<-.12:angle===0))return false;
        }
        return true;
      });
      function lateralAt(t){
        const i=indexAt(t),p=frames[i].p,q=frames[i+1].p;
        return 24*((q[1]-p[1])*Math.cos(p[2])-(q[0]-p[0])*Math.sin(p[2]));
      }
      return {axleChecks,front:stages[5][0]-stages[4][0],rear:stages[6][0]-stages[5][0],
        sway:[lateralAt(55),lateralAt(58)],arrival:frames[indexAt(62)].p.slice(0,2)};
    });
    assert.deepEqual(maneuvers.axleChecks,[true,true]);
    assert.equal(maneuvers.front,12);assert.equal(maneuvers.rear,12);
    assert(maneuvers.sway[0]>.15 && maneuvers.sway[1]<-.15);
    assert(Math.hypot(...maneuvers.arrival)<1e-4);
    for(const [time,label] of [[35,'前轮阿克曼 · 右转'],[47,'后轮阿克曼 · 左转'],[56,'平移与转动的复合运动']]){
      await page.locator('#seek').fill(String(time));
      assert.equal(await page.locator('#value-a').innerText(),label);
    }
    for(const [t,side] of [[55,.17],[58,-.17]]){
      await page.locator('#seek').fill(String(t));
      const v=await page.evaluate(()=>XmobotVelocity.twist(XmobotRoute.frames[XmobotRoute.indexAt(viewer.state.time)]));
      assert(Math.abs(v[0]-.27)<1e-4 && Math.abs(v[1]-side)<1e-4 && Math.abs(v[2]-.12)<1e-4);
      assert((await page.locator('#velocityPlot').getAttribute('aria-label')).includes(side.toFixed(2)+' m/s'));
    }
    if(process.env.WATCH_LAP){
      await page.click('#replay');
    }else{
      await page.locator('#seek').fill('69.6');
      await page.click('#play');
    }
    await page.waitForFunction(()=>viewer.state.time===70 && !viewer.state.playing,null,{timeout:85000});
    assert.equal(await page.locator('#value-a').innerText(),'已回到起点');
    const picture=await page.locator('#panel-a .world').screenshot();
    await page.waitForTimeout(160);
    assert(picture.equals(await page.locator('#panel-a .world').screenshot()));
    await page.click('#move');assert(await page.locator('#panel-b').isVisible());
    assert.equal(await page.locator('#seek').getAttribute('max'),'4');
    await page.click('#geo');await page.selectOption('#arms','1');
    await page.click('#route');
    assert.equal(await page.locator('#clock').innerText(),'70.0 / 70 s');
    await page.click('#lang');assert.equal(await page.locator('#value-a').innerText(),'Lap complete');
    await page.click('#replay');
    await page.waitForFunction(()=>viewer.state.playing && viewer.state.time>0 && viewer.state.time<2);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.setViewportSize({width:390,height:844});
    await page.reload();
    assert.equal(await page.locator('#clock').innerText(),'0.0 / 70 s');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.goto(url+'#compound');
    await page.waitForFunction(()=>viewer.state.time===53.5 && !viewer.state.playing);
    await page.goto(url+'#kinematics');
    await page.locator('#calc-a math').first().waitFor();
    assert.deepEqual(errors,[]);
    console.log('Default lap, wheel kinematics, end hold, replay, comparisons, reduced motion and mobile passed.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
