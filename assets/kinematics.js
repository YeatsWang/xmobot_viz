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
      (u_i,w_i)&\approx(${fmt(u)},\,${fmt(w)})\,${speedUnit}
      \end{aligned}`, 'given');
    if (hardware === 'mecanum') {
      line('p', t('X 型 45° 滚子：左前、右后取 σᵢ = +1，右前、左后取 σᵢ = −1。',
        'For 45° rollers in an X layout, σᵢ is +1 at front left and rear right, and −1 at front right and rear left.'));
      equation(tex`\delta_i=0,\qquad \Omega_i=\frac{u_i-\sigma_i w_i}{r}`);
      equation(tex`\begin{aligned}\sigma_i&=${Math.sign(x*y)}\\ \Omega_i&\approx\frac{${fmt(u)}-(${Math.sign(x*y)})(${fmt(w)})}{${fmt(d.radius)}}\,${spinUnit}\end{aligned}`, 'worked');
    } else if (hardware === 'diff_drive') {
      line('p', t('固定轮沿车身纵向滚动，横向分量由轮胎擦滑承担。',
        'Fixed wheels roll along the chassis x-axis. Lateral velocity at the wheel centre causes tyre scrub.'));
      equation(tex`\delta_i=0,\qquad \Omega_i=\frac{v_x-\omega_z y_i}{r}`);
      equation(tex`\Omega_i\approx\frac{${fmt(u)}}{${fmt(d.radius)}}\,${spinUnit}`, 'worked');
    } else {
      if (mode === 'front' || mode === 'rear') {
        const front = mode === 'front';
        line('p', front
          ? t('后轮横向速度为零，由此确定车心侧向速度。','Zero lateral velocity at the rear wheels sets the lateral speed of the chassis centre.')
          : t('前轮横向速度为零，由此确定车心侧向速度。','Zero lateral velocity at the front wheels sets the lateral speed of the chassis centre.'));
        const sign = front ? '' : '-';
        const fixedAxle = front ? 'rear' : 'front', steeredAxle = front ? 'front' : 'rear';
        equation(tex`v_y=${sign}\frac{\omega_z L}{2},\qquad\delta_{\mathrm{${fixedAxle}}}=0`);
        equation(tex`\delta_{\mathrm{${steeredAxle}},i}=\operatorname{atan2}\!\left(${sign}\omega_z L,\;v_x-\omega_z y_i\right)`);
      } else {
        line('p', t('轮面沿轮心速度方向滚动。若初算转角超出 ±90°，转角加减 180°，轮速反号。',
        'Align the wheel with its velocity. For angles outside ±90°, shift the angle by 180° and reverse the spin.'));
        equation(tex`\delta_{\mathrm{raw}}=\operatorname{atan2}(w_i,u_i)`);
        if (mode === 'pivot') {
          line('p', t('ρ 为车心到轮心的距离。',
        'ρ is the distance from chassis centre to wheel centre.'));
          equation(tex`\rho=\sqrt{\left(\frac{L}{2}\right)^2+\left(\frac{W}{2}\right)^2},\quad
             |\Omega_i|=\frac{|\omega_z|\rho}{r}`);
        } else if (omega === 0) {
          line('p', t('平移时四个轮心速度相同。',
        'In translation all wheel centres have the same velocity.'));
          equation(tex`\omega_z=0,\qquad |\Omega_i|=\frac{\sqrt{v_x^2+v_y^2}}{r}`);
        } else if (mode === 'coordinated') {
          line('p', t('同侧前后轮关于车身横轴对称。',
        'The front and rear wheels on each side are symmetric about the chassis y-axis.'));
          equation(tex`v_y=0,\qquad\delta_{\mathrm{rear}}=-\delta_{\mathrm{front}}`);
        }
      }
      equation(tex`\Omega_i=\frac{u_i\cos\delta_i+w_i\sin\delta_i}{r}`);
      equation(tex`r\Omega_i\approx ${fmt(wheel.speed)}\,${speedUnit}`, 'worked');
    }
    equation(tex`\delta_i\approx ${Number((wheel.angle*180/Math.PI).toFixed(1))}^{\circ},\qquad
      \Omega_i\approx ${fmt(wheel.rate)}\,${spinUnit}`, 'result');
  }
}
