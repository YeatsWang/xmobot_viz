// Geometry, body twist and actuator values come from the same solver as the animation.
function renderKinematics(state, names) {
  const byId = id => document.getElementById(id);
  const section = byId('kinematics');
  section.hidden = state.tab !== 'motion';
  if (section.hidden) return;

  const tex = String.raw;
  const t = (zh, en) => state.english ? en : zh;
  const fmt = n => Number(n.toFixed(3)).toString();
  const d = state.dims;
  const [x, y] = viewer.corners(d)[byId('wheelExample').selectedIndex];
  const metres = tex`\mathrm{m}`;
  const speedUnit = tex`\mathrm{m\,s^{-1}}`;
  const spinUnit = tex`\mathrm{rad\,s^{-1}}`;

  function typeset(element, source, displayMode = true) {
    katex.render(source, element, {displayMode, output:'htmlAndMathml', throwOnError:true});
  }
  byId('calcL').textContent = fmt(d.wheelbase) + ' m';
  byId('calcW').textContent = fmt(d.track) + ' m';
  byId('calcR').textContent = fmt(d.radius) + ' m';
  typeset(byId('wheelPosition'), tex`(x_i,y_i)=\left(${x>0?'':'-'}\frac{L}{2},\,${y>0?'':'-'}\frac{W}{2}\right)
    =\left(${fmt(x)},\,${fmt(y)}\right)\,${metres}`);
  const rigid = byId('rigidEquation');
  if (!rigid.hasChildNodes()) {
    typeset(rigid, tex`\begin{bmatrix}u_i\\ w_i\end{bmatrix}
      =\begin{bmatrix}1&0&-y_i\\0&1&x_i\end{bmatrix}
       \begin{bmatrix}v_x\\v_y\\\omega_z\end{bmatrix}
      =\begin{bmatrix}v_x-\omega_z y_i\\v_y+\omega_z x_i\end{bmatrix}`);
  }

  for (const [side, panelId] of ['calc-a', 'calc-b'].entries()) {
    const panel = byId(panelId);
    panel.replaceChildren();
    function line(tag, text) {
      const element = document.createElement(tag);
      element.textContent = text;
      panel.append(element);
    }
    function equation(source, style = 'equation') {
      const element = document.createElement('div');
      element.className = style;
      typeset(element, source);
      panel.append(element);
    }
    const mode = state.drives[side], hardware = (side && state.reference) || '4wis';
    const [vx, vy, omega] = viewer.motion(mode, d);
    const u = vx - omega*y, w = vy + omega*x;
    const wheel = viewer.wheelCommand(mode, d, x, y, hardware);
    line('h3', t(side?'右侧 · ':'左侧 · ', side?'Right · ':'Left · ') + names[hardware][state.english?1:0]);
    equation(tex`\begin{aligned}
      (v_x,v_y)&=(${fmt(vx)},\,${fmt(vy)})\,${speedUnit}\\
      \omega_z&=${fmt(omega)}\,${spinUnit}\\
      (u_i,w_i)&=(${fmt(u)},\,${fmt(w)})\,${speedUnit}
      \end{aligned}`, 'given');
    if (hardware === 'mecanum') {
      line('p', t('45° 滚子为 X 型排列。左前、右后取正号，另外两轮取负号。滚子允许侧移，主轮转向角始终为零。',
        'For 45° rollers in an X layout, the roller sign is positive at front left and rear right and negative at the other corners. The wheel planes stay fixed.'));
      equation(tex`\delta_i=0,\qquad \Omega_i=\frac{u_i-\sigma_i w_i}{r}`);
      equation(tex`\begin{aligned}\sigma_i&=${Math.sign(x*y)}\\ \Omega_i&=\frac{${fmt(u)}-(${Math.sign(x*y)})(${fmt(w)})}{${fmt(d.radius)}}\end{aligned}`, 'worked');
    } else if (hardware === 'diff_drive') {
      line('p', t('把轮心速度投影到固定轮的前向。正向自转时，左轮后滚、右轮前滚；轮心的侧向分量由擦滑承担。',
        'Project wheel-centre velocity onto the fixed wheel plane. In a positive pivot the left wheels roll backward and the right wheels forward. Lateral scrub accommodates the remaining component.'));
      equation(tex`\delta_i=0,\qquad \Omega_i=\frac{v_x-\omega_z y_i}{r}`);
      equation(tex`\Omega_i=\frac{${fmt(u)}}{${fmt(d.radius)}}\,${spinUnit}`, 'worked');
    } else {
      if (mode === 'front' || mode === 'rear') {
        const front = mode === 'front';
        line('p', front
          ? t('后轴固定。左转时，为使后轮处的横向速度为零，车心速度带有向左的分量。','The rear axle is fixed. For this left turn, zero lateral velocity at the rear wheels requires a leftward component at the centre.')
          : t('前轴固定。左转时，为使前轮处的横向速度为零，车心速度带有向右的分量。','The front axle is fixed. For this left turn, zero lateral velocity at the front wheels requires a rightward component at the centre.'));
        const sign = front ? '' : '-';
        const fixedAxle = front ? 'rear' : 'front', steeredAxle = front ? 'front' : 'rear';
        equation(tex`v_y=${sign}\frac{\omega_z L}{2},\qquad\delta_{\mathrm{${fixedAxle}}}=0`);
        equation(tex`\delta_{\mathrm{${steeredAxle}},i}=\operatorname{atan2}\!\left(${sign}\omega_z L,\;v_x-\omega_z y_i\right)`);
      } else {
        line('p', t('让轮面沿轮心速度方向滚动。若初算转角超过 ±90°，舵轮取等效反向角度，同时反转驱动轮。',
          'Align the wheel plane with the wheel-centre velocity. If the raw angle exceeds ±90°, choose the equivalent opposite heading and reverse the wheel.'));
        equation(tex`\delta_{\mathrm{raw}}=\operatorname{atan2}(w_i,u_i)`);
        if (mode === 'pivot') {
          line('p', t('自转时，每个轮心沿半径为 ρ 的圆周运动。航向角速度相同时，增大轮距会提高所需的轮速。',
            'In a centre pivot each wheel travels on a circle of radius ρ. At the same yaw rate a wider track requires faster wheels.'));
          equation(tex`\rho=\sqrt{\left(\frac{L}{2}\right)^2+\left(\frac{W}{2}\right)^2},\quad
             |\Omega_i|=\frac{|\omega_z|\rho}{r}`);
        } else if (omega === 0) {
          line('p', t('平移时航向不变，四个轮心速度相同。增大轮半径，同样车速所需的轮速会降低。',
            'During translation all four wheel centres share the same velocity. A larger wheel needs a lower spin rate for the same chassis speed.'));
          equation(tex`\omega_z=0,\qquad |\Omega_i|=\frac{\sqrt{v_x^2+v_y^2}}{r}`);
        } else if (mode === 'coordinated') {
          line('p', t('同侧前后轮的纵向坐标互为相反数。车心侧向速度为零时，它们的转角大小相等、方向相反。',
            'The front and rear wheels on each side have opposite longitudinal coordinates. With zero lateral speed at the centre, their steering angles are equal and opposite.'));
          equation(tex`v_y=0,\qquad\delta_{\mathrm{rear}}=-\delta_{\mathrm{front}}`);
        }
      }
      equation(tex`\Omega_i=\frac{u_i\cos\delta_i+w_i\sin\delta_i}{r}`);
      equation(tex`r\Omega_i=${fmt(wheel.speed)}\,${speedUnit}`, 'worked');
    }
    equation(tex`\delta_i=${Number((wheel.angle*180/Math.PI).toFixed(1))}^{\circ},\qquad
      \Omega_i=${fmt(wheel.rate)}\,${spinUnit}`, 'result');
  }
}
