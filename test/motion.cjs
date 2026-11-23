const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
  try {
    const page = await browser.newPage({viewport:{width:1360,height:860}, reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = process.argv[2] || pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url + '#ackermann', {waitUntil:'domcontentloaded', timeout:120000});
    await page.waitForFunction(() => window.viewer?.state.reference === 'ackermann_front');
    assert.equal(await page.locator('video').count(), 0);
    for (const mode of ['ackermann','diagonal','lateral','pivot']) {
      await page.evaluate(fragment => { location.hash = fragment; }, mode);
      const expected = {ackermann:'coordinated',diagonal:'diagonal',lateral:'lateral',pivot:'pivot'}[mode];
      await page.waitForFunction(expected => viewer.state.drives[0] === expected, expected);
      await page.locator('#seek').fill('2');
      const readings = await page.evaluate(() => {
        const {state,corners,poseAt,wheelCommand} = viewer;
        return state.drives.map((mode,side) => ({
          pose:poseAt(mode,state.dims,state.time),
          wheels:corners(state.dims).map(([x,y]) => wheelCommand(mode,state.dims,x,y,side ? state.reference : '4wis'))
        }));
      });
      const [a,b] = readings;
      if (mode === 'ackermann') {
        assert(a.wheels.slice(0,2).every(w => w.angle > 0));
        assert(a.wheels.slice(2).every(w => w.angle < 0));
        assert(b.wheels[0].angle > b.wheels[1].angle && b.wheels[1].angle > 0);
        assert(b.wheels.slice(2).every(w => w.angle === 0));
        assert.equal(a.pose[2], b.pose[2]);
        assert(Math.abs(a.pose[1]-b.pose[1]) > .01);
      } else {
        assert.deepEqual(a.pose,b.pose);
        assert(b.wheels.every(w => w.angle === 0));
        if (mode === 'diagonal') {
          assert(a.pose[0] > 0 && a.pose[1] > 0 && a.pose[2] === 0);
          assert(a.wheels.every(w => Math.abs(w.angle-Math.atan2(.16,.19)) < 1e-10));
          const v=b.wheels.map(w => w.speed);
          assert(Math.abs((v[0]+v[1]+v[2]+v[3])/4-.19)<1e-10);
          assert(Math.abs((-v[0]+v[1]+v[2]-v[3])/4-.16)<1e-10);
        }
      }
      assert.equal(await page.locator('#wheel-0 span').count(),4);
    }
    assert.deepEqual(await page.locator('#pairs button').allTextContents(), ['自转','平移','转弯']);
    await page.click('#mecanum-pivot');
    assert.equal(await page.evaluate(()=>viewer.state.reference),'mecanum');
    const speeds=await page.evaluate(()=>viewer.corners(viewer.state.dims).map(([x,y])=>viewer.wheelCommand('pivot',viewer.state.dims,x,y,'mecanum').rate));
    const spin=.68*(.25+.20)/.08;
    for(const [i,speed] of speeds.entries())assert(Math.abs(speed-(i%2?spin:-spin))<1e-9);
    await page.locator('#pairs button').nth(2).click();
    await page.click('#rear-ackermann');
    const angles=await page.evaluate(()=>viewer.corners(viewer.state.dims).map(([x,y])=>viewer.wheelCommand('rear',viewer.state.dims,x,y,'ackermann_rear').angle));
    assert(angles[0]===0 && angles[1]===0 && angles[2]<angles[3] && angles[3]<0);
    await page.locator('#wheelExample').selectOption({index:2});
    assert.match(await page.locator('#calc-b .result').innerText(), /-49\.6°/);
    await page.click('#editGeometry');
    await page.locator('#radius').fill('20');
    await page.click('#seeEquations');
    assert.equal(await page.locator('#calcR').innerText(),'0.1 m');
    assert.match(await page.locator('#calc-b .result').innerText(), /2.625 rad/);
    await page.locator('#pairs button').nth(1).click();
    await page.click('#diagonal');
    await page.selectOption('#hardware','mecanum');
    assert(await page.locator('#mecanumNote').isVisible());
    await page.click('#geo');
    await page.selectOption('#hardware','ackermann_front');
    await page.selectOption('#arms','1');
    const download = page.waitForEvent('download');
    await page.click('#saveBase');
    assert.equal((await download).suggestedFilename(),'xmobot-ackermann_front-1arm.urdf');
    await page.click('#lang');
    assert.equal(await page.locator('#saveBase').innerText(),'Export Xmobot URDF');
    await page.setViewportSize({width:390,height:844});
    await page.click('#move');
    await page.locator('#pairs button').nth(2).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors,[]);
    console.log('Turning geometry, Mecanum translation, differential pivot, export, mobile and language passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode=1; });
