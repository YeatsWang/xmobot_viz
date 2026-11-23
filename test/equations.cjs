const assert = require('node:assert/strict');

// Recover the requested twist from wheel commands. The independent wheel-centre
// check differentiates the animated world position instead of reusing its Jacobian.
async function checkEquations(page) {
  const samples = await page.evaluate(() => {
    const result = [];
    const {motion, poseAt, wheelCommand} = viewer;
    const geometries = [viewer.profiles.standard];
    for (const wheelbase of [.28,.82]) for (const track of [.26,.72]) for (const radius of [.05,.15]) {
      geometries.push({...viewer.profiles.standard,wheelbase,track,radius});
    }
    const modes = {
      '4wis':['straight','lateral','diagonal','pivot','front','rear','coordinated'],
      'diff_drive':['pivot'], 'mecanum':['pivot','lateral','diagonal'],
      'ackermann_front':['front'], 'ackermann_rear':['rear']
    };
    for (const d of geometries) for (const [hardware, drives] of Object.entries(modes)) for (const mode of drives) {
      const h = .0001;
      const before = poseAt(mode,d,-h), after = poseAt(mode,d,h);
      const wheels = viewer.corners(d).map(([x,y]) => {
        function position([cx,cy,a]) {
          return [cx+x*Math.cos(a)-y*Math.sin(a), cy+x*Math.sin(a)+y*Math.cos(a)];
        }
        const p = position(before), q = position(after);
        return {u:(q[0]-p[0])/(2*h), w:(q[1]-p[1])/(2*h), x, y, ...wheelCommand(mode,d,x,y,hardware)};
      });
      result.push({hardware,mode,d,wheels,twist:motion(mode,d)});
    }
    return result;
  });
  for (const {hardware,mode,d,wheels,twist:[vx,vy,omega]} of samples) {
    const near = (a,b) => assert(Math.abs(a-b)<1e-8, [hardware,mode,a,b].join(' '));
    const speeds = wheels.map(w => d.radius*w.rate);
    if (hardware === 'mecanum') {
      const [fl,fr,rl,rr] = speeds;
      near((fl+fr+rl+rr)/4,vx);
      near((-fl+fr+rl-rr)/4,vy);
      near((-fl+fr-rl+rr)/(2*(d.wheelbase+d.track)),omega);
    }
    if (hardware === 'diff_drive') {
      near((speeds[0]+speeds[1])/2,vx);
      near((speeds[1]-speeds[0])/d.track,omega);
    }
    for (const [i,w] of wheels.entries()) {
      near(w.u, vx-omega*w.y);
      near(w.w, vy+omega*w.x);
      near(speeds[i],w.speed);
      if (hardware === 'diff_drive' || hardware === 'mecanum') {
        near(w.angle,0);
        if (hardware === 'diff_drive') near(speeds[i],w.u);
        continue;
      }
      near(speeds[i]*Math.cos(w.angle),w.u);
      near(speeds[i]*Math.sin(w.angle),w.w);
      assert(Math.abs(w.angle) <= Math.PI/2);
      if (mode === 'pivot') near(Math.abs(speeds[i]), Math.abs(omega)*Math.hypot(d.wheelbase,d.track)/2);
      if (mode === 'front' || mode === 'rear') {
        const active = mode === 'front' ? i<2 : i>=2;
        const sign = mode === 'front' ? 1 : -1;
        near(w.angle,active ? sign*Math.atan(d.wheelbase/(vx/omega-w.y)) : 0);
      }
      if (mode === 'coordinated') near(w.angle,-wheels[(i+2)%4].angle);
      if (omega === 0) near(Math.abs(speeds[i]),Math.hypot(vx,vy));
    }
  }
  const scenarios = [['pivot','mecanum-pivot'], ['lateral','diagonal'], ['ackermann','rear-ackermann']];
  for (const [group, variants] of scenarios.entries()) {
    await page.locator('#pairs button').nth(group).click();
    for (const key of variants) {
      await page.click('#'+key);
      for (let index=0;index<4;index++) {
        await page.selectOption('#wheelExample',{index});
        for (const [side,letter] of ['a','b'].entries()) {
          const tex=await page.locator('#calc-'+letter+' .result annotation').textContent();
          const wheel=await page.locator('#wheel-'+side+' span').nth(index).textContent();
          const [angle,rate]=tex.match(/-?\d+(?:\.\d+)?/g).slice(0,2).map(Number);
          const [, shownAngle, shownRate]=wheel.match(/(-?\d+)°\s*\/\s*(-?[\d.]+)/);
          // Each readout rounds the same unrounded command at its own precision.
          assert(Math.abs(angle-Number(shownAngle))<=.55 && Math.abs(rate-Number(shownRate))<=.051);
        }
      }
    }
  }
  console.log(samples.length+' kinematic cases and 48 displayed wheel results passed.');
}

module.exports = {checkEquations};
