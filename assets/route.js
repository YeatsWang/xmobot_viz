// Ground-plane geometry shared by the 4WISD viewer and the recorded demonstration.
(() => {
  const {fps, rows} = window.XmobotRouteSamples;
  const frames = rows.map(row => ({
    p: row.slice(0, 3), w: [3, 6, 9, 12].map(i => row.slice(i, i + 3))
  }));
  const duration = (frames.length - 1) / fps;
  const stages = [
    [0,'直行','Straight'], [8.5,'四轮协调左转','Coordinated left turn'],
    [15,'横移','Lateral translation'], [22,'斜行','Diagonal translation'],
    [30.5,'前轮转向','Front-wheel steering'], [37,'后轮转向','Rear-wheel steering'],
    [42.5,'转向起点','Return to start'], [49.5,'原地回转','Centre pivot']
  ];
  const centre = frames.map(({p}) => [p[0], p[1]]);
  const tracks = [[.25,.2],[.25,-.2],[-.25,.2],[-.25,-.2]].map(([cx,cy]) =>
    frames.map(({p:[x,y,a]}) => [x + cx*Math.cos(a) - cy*Math.sin(a), y + cx*Math.sin(a) + cy*Math.cos(a)]));
  const distance = [0];
  for (let i=1; i<centre.length; i++) {
    distance.push(distance[i-1] + Math.hypot(centre[i][0]-centre[i-1][0], centre[i][1]-centre[i-1][1]));
  }
  const extent = [0,1].map(axis => {
    const values = centre.map(p => p[axis]);
    return [Math.min(...values), Math.max(...values)];
  });
  const midpoint = extent.map(([a,b]) => (a+b)/2);
  function indexAt(time) {return Math.max(0,Math.min(frames.length-1,Math.round(time*fps)));}
  function camera(index, aspect, azimuth=-Math.PI/2) {
    const p=centre[index], t=index/fps, u=Math.max(0,Math.min(1,(t-51)/5.2));
    const blend=u*u*(3-2*u);
    const target=[...p.map((v,i)=>v+(midpoint[i]-v)*blend),.10];
    const dx=(extent[0][1]-extent[0][0])/2,dy=(extent[1][1]-extent[1][0])/2;
    const s=Math.abs(Math.sin(azimuth)), c=Math.abs(Math.cos(azimuth));
    const overview=Math.max((s*dx+c*dy+.67)/aspect,c*dx+s*dy+.67);
    const close=Math.max(.78,.83/aspect);
    return {target,half:close+(overview-close)*blend,reveal:blend};
  }
  // Use metre-wide geometry for traces. WebGL line primitives are often fixed at one device pixel.
  function ribbon(points, width, height, color, dashed=false) {
    const T=window.THREE, positions=[], indices=[];
    let nx=0,ny=1,travel=0;
    for(let i=0;i<points.length;i++){
      const p=points[i], prev=points[Math.max(0,i-1)], next=points[Math.min(i+1,points.length-1)];
      const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy);
      if(len>1e-7){nx=-dy/len;ny=dx/len;}
      positions.push(p[0]+nx*width/2,p[1]+ny*width/2,height,p[0]-nx*width/2,p[1]-ny*width/2,height);
      travel+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);
      if(i && (!dashed || travel%.23<.14)){
        const a=i*2-2;indices.push(a,a+1,a+2,a+1,a+3,a+2);
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);
    return new T.Mesh(geo,new T.MeshBasicMaterial({color,side:T.DoubleSide}));
  }
  const colors=['#13645F','#358882','#13645F','#358882'];
  function graphics(){
    const group=new THREE.Group();
    group.add(ribbon(centre,.034,.004,'#AA7639',true));
    const drawn=tracks.map((points,i)=>ribbon(points,.034,.010+i*.0003,colors[i]));
    group.add(...drawn);
    function seek(index){for(const mesh of drawn)mesh.geometry.setDrawRange(0,6*index);}
    seek(0);return {group,seek};
  }
  function software(panel,index){
    const sampled=(pts,end)=>pts.filter((_,i)=>i<=end&&(i%4===0||i===end)).map(([x,y])=>[x,y,.01]);
    panel.line(sampled(centre,centre.length-1),'#AA7639',2,[6,4]);
    tracks.forEach((pts,i)=>panel.line(sampled(pts,index),colors[i],2.6));
  }
  window.XmobotRoute={frames,duration,stages,centre,tracks,distance,extent,midpoint,indexAt,camera,graphics,software};
})();
