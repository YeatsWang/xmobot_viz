// Ground-plane geometry shared by the 4WISD viewer and the recorded demonstration.
(() => {
  const {fps, rows} = window.XmobotRouteSamples;
  const frames = rows.map(row => ({
    p: row.slice(0, 3), w: [3, 6, 9, 12].map(i => row.slice(i, i + 3))
  }));
  const duration = (frames.length - 1) / fps;
  const stages = [
    [0,'直行','Straight'], [5,'四轮协调右转','Coordinated right turn'],
    [13,'向左横移','Translate left'], [21,'向左斜行','Diagonal left'],
    [29.5,'前轮阿克曼 · 右转','Front Ackermann · right turn'],
    [41.5,'后轮阿克曼 · 左转','Rear Ackermann · left turn'],
    [53.5,'平移与转动的复合运动','Combined translation and rotation'], [62,'原地回转','Centre pivot']
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
  // Size the physical floor around the outer wheel paths, including the final pivot.
  const floorBounds=extent.map((_,axis)=>{
    const values=tracks.flatMap(track=>track.map(p=>p[axis]));
    return [Math.min(...values)-1,Math.max(...values)+1];
  });
  const floorCentre=floorBounds.map(([min,max])=>(min+max)/2);
  const [width,depth]=floorBounds.map(([min,max])=>max-min);
  const [[left,right],[bottom,top]]=floorBounds;
  const perimeter=[[left,bottom,0],[right,bottom,0],[right,top,0],[left,top,0],[left,bottom,0]];
  const major=[],minor=[];
  for(let i=Math.ceil(left*10);i<=Math.floor(right*10);i++)
    (i%5?minor:major).push([i/10,bottom,0],[i/10,top,0]);
  for(let i=Math.ceil(bottom*10);i<=Math.floor(top*10);i++)
    (i%5?minor:major).push([left,i/10,0],[right,i/10,0]);

  function camera(index,aspect,azimuth,elevation,overview){
    const p=centre[index],target=p.map((v,i)=>v+(floorCentre[i]-v)*overview);
    const s=Math.abs(Math.sin(azimuth)),c=Math.abs(Math.cos(azimuth));
    const across=(s*width+c*depth)/2, along=(c*width+s*depth)/2;
    const fit=1.07*Math.max(across/aspect,along*Math.sin(elevation)+.28*Math.cos(elevation));
    const close=Math.max(.78,.83/aspect);
    return {target:[...target,.10*(1-overview)],half:close+(fit-close)*overview};
  }
  function floorGraphics(){
    const T=window.THREE,group=new T.Group();
    const surface=new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({color:0xf0efe7}));
    surface.position.set(...floorCentre,-.004);group.add(surface);
    function gridLines(points,color,opacity){
      const geom=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));
      return new T.LineSegments(geom,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
    }
    const detail=gridLines(minor,0xcbd0c5,.4);
    const edges=perimeter.slice(1).flatMap((p,i)=>[perimeter[i],p]);
    group.add(detail,gridLines(major,0xaab3a8,.62),gridLines(edges,0x939f93,.85));
    return {group,detail};
  }
  function softwareFloor(panel,showDetail){
    const ctx=panel.ctx;
    ctx.beginPath();
    perimeter.forEach((p,i)=>i?ctx.lineTo(...panel.project(p)):ctx.moveTo(...panel.project(p)));
    ctx.closePath();ctx.fillStyle='#f0efe7';ctx.fill();
    function grid(points,color){
      for(let i=0;i<points.length;i+=2)panel.line([points[i],points[i+1]],color);
    }
    if(showDetail)grid(minor,'#d9dcd1');
    grid(major,'#c4cabe');panel.line(perimeter,'#939f93',1);
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
    const floor=floorGraphics(),group=floor.group;
    group.add(ribbon(centre,.034,.004,'#AA7639',true));
    const drawn=tracks.map((points,i)=>ribbon(points,.034,.010+i*.0003,colors[i]));
    group.add(...drawn);
    function seek(index){for(const mesh of drawn)mesh.geometry.setDrawRange(0,6*index);}
    seek(0);return {group,seek,detail:floor.detail};
  }
  function software(panel,index){
    const sampled=(pts,end)=>pts.filter((_,i)=>i<=end&&(i%4===0||i===end)).map(([x,y])=>[x,y,.01]);
    panel.line(sampled(centre,centre.length-1),'#AA7639',2,[6,4]);
    tracks.forEach((pts,i)=>panel.line(sampled(pts,index),colors[i],2.6));
  }
  window.XmobotRoute={frames,duration,stages,centre,tracks,distance,extent,midpoint,indexAt,floorBounds,camera,graphics,software,softwareFloor};
})();
