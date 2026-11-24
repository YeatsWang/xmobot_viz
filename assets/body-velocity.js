// Robot-fixed frame: x forward, y left, positive yaw counterclockwise.
// Opposite wheel locations cancel the rotational terms when averaged.
(() => {
  const colors={forward:'#17665e',left:'#285899',yaw:'#9a561f',ink:'#203e40'};
  function twist(frame) {
    const v=frame.w.map(([angle,speed])=>[speed*Math.cos(angle),speed*Math.sin(angle)]);
    const mean=axis=>v.reduce((sum,a)=>sum+a[axis],0)/4;
    const [,flY]=v[0],[,frY]=v[1],[,rlY]=v[2],[,rrY]=v[3];
    const omega=(flY+frY-rlY-rrY)/(2*window.viewer.profiles.standard.wheelbase);
    return [mean(0),mean(1),omega].map(n=>Math.abs(n)<.0001?0:n);
  }
  function arrow(g,x,y,dx,dy,color){
    const length=Math.hypot(dx,dy);
    if(length<1.2)return;
    const a=Math.atan2(dy,dx);
    g.save();g.translate(x,y);g.rotate(a);
    const head=Math.min(5,length*.6);g.fillStyle=color;g.strokeStyle=color;g.lineWidth=3;
    g.beginPath();g.moveTo(0,0);g.lineTo(length-head*.7,0);g.stroke();
    g.beginPath();g.moveTo(length,0);g.lineTo(length-head,-head*.72);g.lineTo(length-head,head*.72);g.closePath();g.fill();g.restore();
  }
  function draw(g,frame,x,y,width,height,english=false) {
    const [vx,vy,omega]=twist(frame);
    const zoom=Math.min(width/308,height/147);
    g.save();g.translate(x+(width-308*zoom)/2,y+(height-147*zoom)/2);g.scale(zoom,zoom);
    const font=' "PingFang SC",system-ui,sans-serif';
    function text(t,xx,yy,size,color=colors.ink,weight=550){
      g.fillStyle=color;g.font=weight+' '+size+'px'+font;g.textAlign='left';g.textBaseline='alphabetic';g.fillText(t,xx,yy);
    }
    text(english?'Body-frame velocity':'车身坐标系速度',4,17,15,colors.ink,650);
    const cx=53,cy=81;
    g.fillStyle='#dce8e3';g.strokeStyle='#8ba39e';g.lineWidth=1.2;
    g.beginPath();g.roundRect(cx-18,cy-23,36,46,4);g.fill();g.stroke();
    // Nose and signed wheel angles remain visible when the chassis is stationary.
    g.beginPath();g.moveTo(cx-4,cy-16);g.lineTo(cx,cy-20);g.lineTo(cx+4,cy-16);g.strokeStyle=colors.ink;g.stroke();
    frame.w.forEach(([angle],i)=>{
      g.save();g.translate(cx+(i%2?20:-20),cy+(i<2?-20:20));g.rotate(-angle);
      g.fillStyle=colors.ink;g.beginPath();g.roundRect(-2.7,-6,5.4,12,2);g.fill();g.restore();
    });
    arrow(g,cx,cy,0,-vx*86,colors.forward);arrow(g,cx,cy,-vy*86,0,colors.left);
    if(Math.abs(omega)>.008){
      const sign=Math.sign(omega),start=-.28,end=start-sign*Math.min(2.5,Math.abs(omega)*4.5),r=32;
      g.strokeStyle=colors.yaw;g.lineWidth=2.3;g.beginPath();g.arc(cx,cy,r,start,end,sign>0);g.stroke();
      const dx=sign*Math.sin(end)*6,dy=-sign*Math.cos(end)*6;
      arrow(g,cx+r*Math.cos(end)-dx,cy+r*Math.sin(end)-dy,dx,dy,colors.yaw);
    }
    g.fillStyle=colors.ink;g.beginPath();g.arc(cx,cy,2.5,0,Math.PI*2);g.fill();
    const rows=[
      [english?'Forward vₓ':'纵向 vₓ',vx,'m/s',colors.forward],
      [english?'Lateral vᵧ':'侧向 vᵧ',vy,'m/s',colors.left],
      [english?'Yaw ω':'航向角速度 ω',omega,'rad/s',colors.yaw]
    ];
    rows.forEach(([label,value,unit,color],i)=>{
      const yy=49+27*i;g.fillStyle=color;g.fillRect(105,yy-9,11,3);
      text(label,122,yy,13,color,650);
      text((value>0?'+':'')+value.toFixed(2)+' '+unit,217,yy,13);
    });
    text(english?'Nose up · leftward motion and left yaw are positive':'车头朝上 · 左移、左转为正',4,138,12,'#526466');
    g.restore();
  }
  window.XmobotVelocity={twist,draw};
})();
