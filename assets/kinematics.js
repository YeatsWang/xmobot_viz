// Use the same dimensions, twist and signed wheel commands as the animation.
function renderKinematics(state, names) {
  const byId = id => document.getElementById(id);
  const section = byId('kinematics');
  section.hidden = state.tab !== 'motion';
  if (section.hidden) return;
  const t = (zh, en) => state.english ? en : zh;
  const fmt = n => Number(n.toFixed(3)).toString();
  const d = state.dims;
  const [x, y] = viewer.corners(d)[byId('wheelExample').selectedIndex];
  byId('calcL').textContent = fmt(d.wheelbase) + ' m';
  byId('calcW').textContent = fmt(d.track) + ' m';
  byId('calcR').textContent = fmt(d.radius) + ' m';
  byId('wheelPosition').textContent = t('轮心位置', 'Wheel centre') +
    ' (xᵢ, yᵢ) = (' + (x>0?'L/2':'−L/2') + ', ' + (y>0?'W/2':'−W/2') + ') = (' +
    fmt(x) + ', ' + fmt(y) + ') m';

  for (const [side, panelId] of ['calc-a', 'calc-b'].entries()) {
    const panel = byId(panelId);
    panel.replaceChildren();
    function line(tag, text, style) {
      const element = document.createElement(tag);
      for (const part of text.split(/(δ(?:raw|front(?:,i)?|rear(?:,i)?)|ωz)/)) {
        if (/^[δω][a-z]/.test(part)) {
          element.append(part[0]);
          const sub=document.createElement('sub');
          sub.textContent=part.slice(1);
          element.append(sub);
        } else {
          element.append(part);
        }
      }
      if (style) element.className = style;
      panel.append(element);
    }
    const mode = state.drives[side], hardware = (side && state.reference) || '4wis';
    const [vx, vy, omega] = viewer.motion(mode, d);
    const u = vx - omega*y, w = vy + omega*x;
    const wheel = viewer.wheelCommand(mode, d, x, y, hardware);
    line('h3', t(side?'右侧 · ':'左侧 · ', side?'Right · ':'Left · ') + names[hardware][state.english?1:0]);
    line('p', 'vₓ = ' + fmt(vx) + ' m/s   ·   vᵧ = ' + fmt(vy) + ' m/s   ·   ωz = ' + fmt(omega) + ' rad/s', 'twist');
    line('p', '(uᵢ, wᵢ) = (' + fmt(u) + ', ' + fmt(w) + ') m/s', 'worked');
    if (hardware === 'mecanum') {
      line('p', t('45° 滚子为 X 型排列。左前、右后取 σᵢ = +1，右前、左后取 −1。滚子允许侧移，主轮转向角始终为零。',
        'For 45° rollers in an X layout, σᵢ is +1 at front left and rear right, and −1 at the other corners. The rollers permit sideways motion while the wheel planes remain fixed.'));
      line('p', 'δᵢ = 0,   Ωᵢ = (uᵢ − σᵢ wᵢ) / r', 'equation');
      line('p', 'Ωᵢ = (' + fmt(u) + ' − (' + Math.sign(x*y) + ') × (' + fmt(w) + ')) / ' + fmt(d.radius), 'worked');
    } else if (hardware === 'diff_drive') {
      line('p', t('把轮心速度投影到固定轮的前向。正向自转时，左轮后滚、右轮前滚；前后轴轮心的侧向分量由擦滑承担。',
        'Project the wheel-centre velocity onto the fixed wheel plane. During a positive pivot the left wheels roll backward and the right wheels forward. Lateral scrub accommodates the remaining component.'));
      line('p', 'δᵢ = 0,   Ωᵢ = (vₓ − ωz yᵢ) / r', 'equation');
      line('p', 'Ωᵢ = ' + fmt(u) + ' / ' + fmt(d.radius), 'worked');
    } else {
      if (mode === 'front' || mode === 'rear') {
        const front = mode === 'front';
        line('p', front
          ? t('后轴固定。后轮处的左向速度必须为零，所以车心需有向左的速度分量。','The rear axle is fixed. Zero lateral velocity at the rear wheels requires a leftward velocity component at the centre for this left turn.')
          : t('前轴固定。前轮处的左向速度必须为零，所以左转时车心带有向右的速度分量。','The front axle is fixed. Zero lateral velocity there requires a rightward velocity component at the centre for this left turn.'));
        line('p', front ? 'vᵧ = +ωz L/2,   δrear = 0' : 'vᵧ = −ωz L/2,   δfront = 0', 'equation');
        line('p', front ? 'δfront,i = atan2(ωz L, vₓ − ωz yᵢ)' : 'δrear,i = atan2(−ωz L, vₓ − ωz yᵢ)', 'equation');
      } else {
        line('p', t('让轮面沿轮心速度方向滚动。若初算转角超过 ±90°，舵轮转到等效的反向角度，同时反转驱动轮。',
          'Align the wheel plane with the wheel-centre velocity. If the raw angle exceeds ±90°, choose the equivalent opposite heading and reverse the wheel.'));
        line('p', 'δraw = atan2(wᵢ, uᵢ)', 'equation');
        if (mode === 'pivot') {
          line('p', t('纯自转时，每个轮心绕车心的半径都是 ρ。角速度相同，轮距越大，所需轮速越高。',
            'During a centre pivot each wheel travels on a circle of radius ρ. At the same yaw rate a wider track requires faster wheels.'));
          line('p', 'ρ = √((L/2)² + (W/2)²),   |Ωᵢ| = |ωz| ρ / r', 'equation');
        } else if (omega === 0) {
          line('p', t('平移时航向不变，四个轮心速度相同。增加轮半径，同样车速所需的轮速会降低。',
            'During translation all four wheel centres share the same velocity. A larger wheel needs a lower spin rate for the same chassis speed.'));
          line('p', 'ωz = 0,   |Ωᵢ| = √(vₓ² + vᵧ²) / r', 'equation');
        } else if (mode === 'coordinated') {
          line('p', t('车心侧向速度为零。同侧前后轮的 x 坐标符号相反，因此转角大小相等、方向相反。',
            'The centre has zero lateral velocity. On each side the front and rear x coordinates have opposite signs, giving equal and opposite steering angles.'));
          line('p', 'vᵧ = 0,   δrear = −δfront', 'equation');
        }
      }
      line('p', 'Ωᵢ = (uᵢ cos δᵢ + wᵢ sin δᵢ) / r', 'equation');
      line('p', t('沿轮面线速度','Signed rolling speed') + ' = ' + fmt(wheel.speed) + ' m/s', 'worked');
    }
    line('p', 'δᵢ = ' + Number((wheel.angle*180/Math.PI).toFixed(1)) + '°   ·   Ωᵢ = ' + fmt(wheel.rate) + ' rad/s', 'result');
  }
}
