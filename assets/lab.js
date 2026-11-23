(() => {
  const T = window.THREE;
  const standard = {length:.50,width:.40,height:.10,wheelbase:.50,track:.40,radius:.08,wheelWidth:.05};
  const profiles = {
    standard, thick:{...standard,height:.21}, long:{...standard,length:.82,width:.28,height:.07,wheelbase:.76,track:.32},
    wide:{...standard,length:.42,width:.64,height:.08,wheelbase:.40,track:.66},
    high:{...standard,length:.46,width:.39,height:.19,wheelbase:.44,track:.46,radius:.14,wheelWidth:.08}
  };
  const state = {tab:'motion', geometryHardware:'4wis', profile:'standard', dims:{...standard}, drives:['pivot','pivot'], reference:'diff_drive',
    singleX:null,dualX:null,spacing:null,az:-Math.PI/2,elevation:1.18,arms:0,time:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,manual:false,english:false};
  const end=4, wheelNames=['front_left','front_right','rear_left','rear_right'];
  // Sidewalls and top panels share a hue. Brass is reserved for steering hardware.
  const chassisFinishes=[
    {side:0x216269,top:0x68C5B5},
    {side:0x536F89,top:0xB3C8DB}
  ];
  function motion(mode,d) {
    switch(mode){
      case 'straight': return [.24,0,0];
      case 'lateral': return [0,.23,0];
      case 'diagonal': return [.19,.16,0];
      case 'pivot': return [0,0,.68];
      case 'coordinated': return [.25,0,.40];
      case 'front': return [.25,.40*d.wheelbase/2,.40];
      case 'rear': return [.25,-.40*d.wheelbase/2,.40];
      default: throw new Error('Unknown 4WISD motion: '+mode);
    }
  }
  function wheelCommand(mode,d,x,y,hardware='4wis'){
    const [vx,vy,w]=motion(mode,d), dx=vx-w*y, dy=vy+w*x;
    if(hardware==='diff_drive'||hardware==='mecanum'){
      // Fixed wheel planes. The X-pattern roller handedness alternates on each diagonal.
      const speed=hardware==='diff_drive'?dx:dx-Math.sign(x*y)*dy;
      return {angle:0,speed,rate:speed/d.radius};
    }
    let angle=Math.atan2(dy,dx), speed=Math.hypot(dx,dy);
    // The source steering joints stop at ±90°. Reverse the wheel for the equivalent rolling vector.
    if(angle>Math.PI/2){angle-=Math.PI;speed=-speed;}
    else if(angle< -Math.PI/2){angle+=Math.PI;speed=-speed;}
    return {angle, speed, rate:speed/d.radius};
  }
  function mounts(d,arms){
    const bearing=.03,underbody=2*d.radius+bearing;
    const limit=d.length/2-.05, maxSpacing=d.width-.10;
    const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
    const dualY=clamp((state.spacing??d.width*.6)/2,.051,maxSpacing/2);
    const minX=arms===1?-limit:Math.sqrt(Math.max(0,.102**2-dualY**2));
    const maxX=arms===1?-.102:limit;
    const requested=arms===1?(state.singleX??-d.length/4):(state.dualX??d.length/4);
    return {armX:clamp(requested,minX,maxX),dualY,minX,maxX,maxSpacing,underbody,body:underbody+d.height/2,steer:-(d.height+bearing)/2,
      axle:-d.radius-bearing/2,camera:d.length/2+.025,lidar:0,deck:underbody+d.height};
  }
  function poseAt(mode,d,t) {
    const [vx,vy,w]=motion(mode,d), a=w*t;
    return w?[ (vx*Math.sin(a)+vy*(Math.cos(a)-1))/w, (vx*(1-Math.cos(a))+vy*Math.sin(a))/w, a ]:[vx*t,vy*t,0];
  }
  function corners(d) {return [[1,1],[1,-1],[-1,1],[-1,-1]].map(([i,j])=>[i*d.wheelbase/2,j*d.track/2]);}
  function world(p,x,y,z=0){const [cx,cy,a]=p;return [cx+x*Math.cos(a)-y*Math.sin(a),cy+x*Math.sin(a)+y*Math.cos(a),z];}
  const mats=new Map(),geoms=new Map();
  function mat(color){if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.65,metalness:.09}));return mats.get(color);}
  function geom(v) {
    const k=[v.shape,...v.dims].join('/');
    if(!geoms.has(k)){
      const d=v.dims;
      const g=v.shape==='box'?new T.BoxGeometry(...d):v.shape==='sphere'?new T.SphereGeometry(d[0],24,14):new T.CylinderGeometry(d[0],d[0],d[1],40).rotateX(Math.PI/2);
      geoms.set(k,g);
    }
    return geoms.get(k);
  }
  const strokeGeo=new T.BoxGeometry(.048,.002,.008);
  function lines(points,color,opacity){
    return new T.LineSegments(new T.BufferGeometry().setFromPoints(points.map(a=>new T.Vector3(...a))),new T.LineBasicMaterial({color,transparent:true,opacity}));
  }
  const soft=document.createElement('canvas');soft.width=soft.height=64;
  const pen=soft.getContext('2d'),g=pen.createRadialGradient(32,32,5,32,32,32);
  g.addColorStop(0,'rgba(0,0,0,.72)');g.addColorStop(.65,'rgba(0,0,0,.4)');g.addColorStop(1,'transparent');pen.fillStyle=g;pen.fillRect(0,0,64,64);
  const shadowMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(soft),transparent:true,depthWrite:false});
  class Panel {
    constructor(el,index) {
      this.el=el;this.index=index;this.surface=el.querySelector('.overlay');this.ctx=this.surface.getContext('2d');
      try {this.renderer=new T.WebGLRenderer({canvas:el.querySelector('.world'),antialias:true,alpha:false,preserveDrawingBuffer:true});}catch{this.renderer=null;}
      this.scene=new T.Scene();this.scene.background=new T.Color(0xF8F5EE);
      this.camera=new T.OrthographicCamera(-1,1,1,-1,.01,30);this.camera.up.set(0,0,1);this.softwareLight=new T.Vector3(2,-3,4).normalize();
      this.scene.add(new T.HemisphereLight(0xf6fafb,0x9b9e9a,2.05));
      const sun=new T.DirectionalLight(0xfff8ed,2.45);sun.position.set(2,-3,4);this.scene.add(sun);
      const baseGrid=[],major=[];
      for(let i=-40;i<=40;i++){const a=i/10;const pts=i%5===0?major:baseGrid;pts.push([a,-4,0],[a,4,0],[-4,a,0],[4,a,0]);}
      this.scene.add(lines(baseGrid,0xD2D1C9,.32),lines(major,0xAEB4AF,.48));
      this.root=new T.Group();this.scene.add(this.root);
      this.shadow=new T.Mesh(new T.PlaneGeometry(1,1),shadowMat);this.root.add(this.shadow);this.shadow.position.z=.001;
      this.model=new T.Group();this.root.add(this.model);this.mode='';
      this.traces=corners(standard).map(()=>{
        const positions=new T.BufferAttribute(new Float32Array(121*3),3),geometry=new T.BufferGeometry();
        geometry.setAttribute('position',positions);const trace=new T.Line(geometry,new T.LineBasicMaterial({color:index?0x536F89:0x168577}));trace.frustumCulled=false;this.scene.add(trace);return trace;
      });
    }
    prepare(mode,d,hardware) {
      this.mode=mode;
      if(hardware!==this.hardware) {
        this.hardware=hardware;
        const data=XMOBOT_MODELS[hardware];this.model.clear();this.nodes={};this.joints={};
        for(const [name,vs] of Object.entries(data.links)){
          const group=new T.Group();this.nodes[name]=group;
          for(const v of vs){
            const finish=chassisFinishes[this.index];
            let material;
            if(name==='base_link' && v.shape==='box'){
              const side=mat(finish.side);
              // BoxGeometry stores four sidewalls, then the top and bottom faces.
              material=[side,side,side,side,mat(finish.top),side];
            }else{
              const color=name.includes('wheel_link')?0x27313A:name.includes('steering')?0xDEAA50:name.includes('lidar')?0x344451:name.includes('camera')?0x536B76:name.includes('finger')?0x43505B:v.shape==='cylinder'?0x667D86:0xCFD9D8;
              material=mat(color);
            }
            const mesh=new T.Mesh(geom(v),material);mesh.position.fromArray(v.xyz);mesh.rotation.set(...v.rpy,'ZYX');group.add(mesh);
          }
          if(hardware==='mecanum' && name.includes('wheel_link')){
            // Keep the Xacro axle. Add illustrative roller geometry to its simplified wheel.
            group.children[0].scale.set(.79,.79,.91);
            const diagonal=name.startsWith('front_left')||name.startsWith('rear_right')?-1:1;
            for(let k=0;k<10;k++){
              const phi=2*Math.PI*k/10,roller=new T.Mesh(geom({shape:'sphere',dims:[1]}),mat(k%2?0x465665:0xA5B2B7));
              roller.position.set(.068*Math.sin(phi),0,-.068*Math.cos(phi));
              roller.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(phi),diagonal,Math.sin(phi)).normalize());
              roller.scale.set(.011,.034,.011);group.add(roller);
            }
          }
          if(name.includes('wheel_link'))for(const side of [-1,1]){
            const stripe=new T.Mesh(strokeGeo,mat(0xFAF8EB));stripe.position.set(.033,side*.026,0);group.add(stripe);
          }
        }
        for(const j of data.joints){
          const pivot=new T.Group();pivot.position.fromArray(j.xyz);pivot.rotation.set(...j.rpy,'ZYX');
          this.nodes[j.parent].add(pivot);pivot.add(this.nodes[j.child]);this.joints[j.name]={pivot,child:this.nodes[j.child],axis:new T.Vector3(...j.axis)};
        }
        this.model.add(this.nodes.base_footprint);
      }
      this.traces.forEach((trace,i)=>{
        trace.visible=state.tab==='motion';
        if(!trace.visible)return;
        const [x,y]=corners(d)[i],positions=trace.geometry.attributes.position;
        for(let j=0;j<=120;j++)positions.setXYZ(j,...world(poseAt(mode,d,end*j/120),x,y,.008));
        positions.needsUpdate=true;
      });
      this.d=d;this.nodes.base_link.children[0].scale.set(d.length/.5,d.width/.4,d.height/.1);
      const armCount=state.arms;
      const mount=mounts(d,armCount);this.mount=mount;
      this.joints.base_joint.pivot.position.z=mount.body;
      this.joints.lidar_joint.pivot.position.set(mount.lidar,0,d.height/2+.025);
      this.joints.camera_joint.pivot.position.set(mount.camera,0,0);
      const locations=corners(d);
      wheelNames.forEach((name,i)=>{
        const steer=this.joints[name+'_steering_joint'],wheel=this.joints[name+'_wheel_joint'];
        if(steer){
          steer.pivot.position.set(...locations[i],mount.steer);wheel.pivot.position.z=mount.axle;
        }else wheel.pivot.position.set(...locations[i],d.radius-mount.body);
        wheel.child.scale.set(d.radius/.08,d.wheelWidth/.05,d.radius/.08);
      });
      for(const [side,sign] of [['left_',1],['right_',-1]]){
        const mount=this.joints[side+'joint_1'].pivot;
        mount.visible=armCount===2||(armCount===1&&sign===1);
        mount.position.set(this.mount.armX,armCount===2?sign*this.mount.dualY:0,d.height/2);
      }
      this.shadow.scale.set(Math.max(d.length,d.wheelbase)*1.6,Math.max(d.width,d.track)*1.65,1);
    }
    articulate(p,t) {
      const d=this.d;
      this.root.position.set(p[0],p[1],0);this.root.rotation.z=p[2];
      corners(d).forEach(([x,y],i)=>{
        const key=wheelNames[i],cmd=wheelCommand(this.mode,d,x,y,this.hardware);
        const steer=this.joints[key+'_steering_joint'];
        if(steer)steer.child.rotation.z=state.tab==='motion'?cmd.angle:0;
        this.joints[key+'_wheel_joint'].child.rotation.y=cmd.rate*t;
      });
      for(const [side,sign] of [['left_',1],['right_',-1]]){
        const angles=[sign*.30,1.12,-1.12,sign*.28,-.56,sign*.22];
        angles.forEach((a,i)=>{const j=this.joints[side+'joint_'+(i+1)];j.child.quaternion.setFromAxisAngle(j.axis,a);});
      }
    }
    project(p){const q=new T.Vector3(...p).project(this.camera);return [(q.x+1)*this.w/2,(1-q.y)*this.h/2];}
    line(points,color,width=1,dash=[]){
      const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const xy=this.project(p);if(i)c.lineTo(...xy);else c.moveTo(...xy);});
      c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);
    }
    labelPoint(point,text,dx,dy){
      const c=this.ctx,[x,y]=this.project(point);
      c.font=(this.w<235?'10':'12')+'px sans-serif';const width=c.measureText(text).width+8;
      const left=Math.max(4,Math.min(this.w-width-4,x+dx-width/2)),top=Math.max(42,Math.min(this.h-26,y+dy));
      c.beginPath();c.moveTo(x,y);c.lineTo(left+width/2,top+8);c.lineWidth=1;c.strokeStyle='#365955';c.stroke();
      c.fillStyle='#173F43';c.fillRect(left,top,width,17);c.fillStyle='#eff9ed';c.textAlign='center';c.textBaseline='middle';c.fillText(text,left+width/2,top+8.5);
    }
    dimension(a,b,text,offset,color) {
      const c=this.ctx,A=this.project(a),B=this.project(b);const dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy);
      if(l<12)return;
      const nx=-dy/l,ny=dx/l;
      c.beginPath();c.moveTo(...A);c.lineTo(...B);
      for(const p of [A,B]){c.moveTo(p[0]-nx*3,p[1]-ny*3);c.lineTo(p[0]+nx*3,p[1]+ny*3);}
      c.strokeStyle=color;c.lineWidth=1.2;c.stroke();
      const x=(A[0]+B[0])/2+nx*offset,y=(A[1]+B[1])/2+ny*offset;
      c.font=(this.w<240?'10':'12')+'px Menlo,monospace';c.textAlign='center';c.textBaseline='middle';
      const tw=c.measureText(text).width;c.fillStyle='#F8F5EE';c.fillRect(x-tw/2-3,y-7,tw+6,14);c.fillStyle=color;c.fillText(text,x,y);
    }
    outline(p,l,w,z){return [[1,1],[1,-1],[-1,-1],[-1,1],[1,1]].map(([i,j])=>world(p,i*l/2,j*w/2,z));}
    drawSoftwareModel() {
      // Painter's algorithm for the same primitive meshes on browsers without WebGL.
      const c=this.ctx,faces=[],eye=this.camera.position;
      this.root.updateMatrixWorld(true);
      this.model.traverseVisible(mesh=>{
        if(!mesh.isMesh)return;
        const geo=mesh.geometry,pos=geo.attributes.position,idx=geo.index,verts=[];
        for(let i=0;i<pos.count;i++){
          const pt=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
          const q=pt.clone().project(this.camera);
          verts.push({pt,screen:[(q.x+1)*this.w/2,(1-q.y)*this.h/2],depth:q.z});
        }
        const count=idx?idx.count:pos.count;
        for(let i=0;i<count;i+=3){
          const [a,b,d]=[0,1,2].map(offset=>verts[idx?idx.getX(i+offset):i+offset]);
          const normal=b.pt.clone().sub(a.pt).cross(d.pt.clone().sub(a.pt)).normalize();
          if(normal.dot(eye.clone().sub(a.pt))<=0)continue;
          const shade=.64+.44*Math.max(0,normal.dot(this.softwareLight));
          const material=Array.isArray(mesh.material)
            ? mesh.material[geo.groups.find(group=>i>=group.start && i<group.start+group.count).materialIndex]
            : mesh.material;
          faces.push({poly:[a.screen,b.screen,d.screen],depth:a.depth+b.depth+d.depth,color:material.color.clone().multiplyScalar(shade).getStyle()});
        }
      });
      faces.sort((a,b)=>b.depth-a.depth);
      for(const face of faces){
        c.beginPath();face.poly.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=c.strokeStyle=face.color;c.lineWidth=.55;c.fill();c.stroke();
      }
    }
    render(target,vertical,horizontal){
      const el=this.surface,c=this.ctx,w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
      this.w=w;this.h=h;const ratio=Math.min(devicePixelRatio||1,1.6);
      if(el.width!==Math.round(w*ratio)||el.height!==Math.round(h*ratio)){
        el.width=Math.round(w*ratio);el.height=Math.round(h*ratio);
        if(this.renderer){this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);}
      }
      c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
      const half=Math.max(vertical,horizontal*h/w);
      const cam=this.camera,e=state.elevation,a=state.az;
      cam.top=half;cam.bottom=-half;cam.left=-half*w/h;cam.right=-cam.left;cam.updateProjectionMatrix();
      cam.position.set(target[0]+4*Math.cos(e)*Math.cos(a),target[1]+4*Math.cos(e)*Math.sin(a),target[2]+4*Math.sin(e));cam.lookAt(...target);cam.updateMatrixWorld();
      const m=state.tab==='motion', t=m?state.time:0, d=this.d,p=m?poseAt(this.mode,d,t):[0,0,0];
      this.articulate(p,t);this.traces.forEach(trace=>trace.geometry.setDrawRange(0,1+Math.floor(120*t/end)));
      if(this.renderer)this.renderer.render(this.scene,cam);
      else{
        c.fillStyle='#F8F5EE';c.fillRect(0,0,w,h);
        for(let i=-18;i<=18;i++){this.line([[i/10,-2,0],[i/10,2,0]],'#DCDAD0');this.line([[-2,i/10,0],[2,i/10,0]],'#DCDAD0');}
        if(!m)this.drawSoftwareModel();
      }
      const accent=this.index?'#506A82':'#176D66',z=this.mount.underbody+d.height+.004;
      if(m){
        this.line(this.outline([0,0,0],d.length,d.width,.005),'#687A75',1.3,[4,4]);
        if(!this.renderer)for(const [x,y] of corners(d)){
          const pts=Array.from({length:48},(_,i)=>world(poseAt(this.mode,d,t*i/47),x,y,.009));
          this.line(pts,accent,1.8);
        }
        if(!this.renderer)this.drawSoftwareModel();
        // Show the steering direction just outside the wheel, even in an overhead view.
        for(const [i,[x,y]] of corners(d).entries()){
          const cmd=wheelCommand(this.mode,d,x,y,this.hardware),sign=Math.sign(cmd.speed);
          const ux=sign*Math.cos(cmd.angle),uy=sign*Math.sin(cmd.angle),off=Math.sign(y)*(d.wheelWidth/2+.015);
          const length=d.radius*.95, zWheel=d.radius*1.8;
          const tip=[x+length*ux,y+off+length*uy];
          this.line([world(p,x-length*ux,y+off-length*uy,zWheel),world(p,...tip,zWheel)],'#173F43',4.6);
          this.line([world(p,x-length*ux,y+off-length*uy,zWheel),world(p,...tip,zWheel)],'#FEF9DD',2);
          this.line([world(p,tip[0]-.034*ux-.018*uy,tip[1]-.034*uy+.018*ux,zWheel),world(p,...tip,zWheel),
            world(p,tip[0]-.034*ux+.018*uy,tip[1]-.034*uy-.018*ux,zWheel)],'#173F43',4.2);
          this.line([world(p,tip[0]-.034*ux-.018*uy,tip[1]-.034*uy+.018*ux,zWheel),world(p,...tip,zWheel),
            world(p,tip[0]-.034*ux+.018*uy,tip[1]-.034*uy-.018*ux,zWheel)],'#FEF9DD',1.7);
        }
      }else{
        const x=d.length/2,y=d.width/2;
        this.dimension([-x,-y-.08,.012],[x,-y-.08,.012],Math.round(d.length*100)+' cm',11,accent);
        if(state.elevation>.13)this.dimension([-x-.10,-y,.012],[-x-.10,y,.012],Math.round(d.width*100)+' cm',-10,accent);
        if(state.elevation<1.2)this.dimension([x+.065,-y,this.mount.underbody],[x+.065,-y,z],Math.round(d.height*100)+' cm',-21,accent);
      }
      if(!m&&this.index===1){
        this.labelPoint([this.mount.camera+.025,0,this.mount.body],state.english?'Front camera':'前置相机',30,-28);
        this.labelPoint([0,0,z+.049],state.english?'Centre LiDAR':'中央雷达',15,-30);
        if(state.arms===1)this.labelPoint([this.mount.armX,0,z+.01],state.english?'Arm base':'单臂底座',-46,16);
      }
      const tip=d.length*.37;
      const nose=[world(p,tip-.048,.036,z),world(p,tip,0,z),world(p,tip-.048,-.036,z)];
      this.line(nose,'#37424B',5.4);
      this.line(nose,'#FFD378',2.8);
    }
  }
  const panels=[...document.querySelectorAll('.viewport')].map((el,i)=>new Panel(el,i));
  function refresh(){
    panels.forEach((panel,i)=>panel.prepare(state.tab==='geometry'?'straight':state.drives[i],state.tab==='geometry'&&i===0?standard:state.dims,state.tab==='geometry'?state.geometryHardware:(i===1&&state.reference?state.reference:'4wis')));
  }
  function draw(){
    const moving=state.tab==='motion';
    let target,vertical,horizontal;
    if(moving){
      // Identical, stationary framing in both panels for the full four-second run.
      const poses=state.drives.flatMap(mode=>Array.from({length:25},(_,i)=>poseAt(mode,state.dims,end*i/24)));
      const xs=poses.map(p=>p[0]),ys=poses.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const bodyReach=Math.hypot(Math.max(state.dims.length,state.dims.wheelbase+2*state.dims.radius),Math.max(state.dims.track+state.dims.wheelWidth,state.dims.width))/2;
      const radius=bodyReach+Math.hypot(x1-x0,y1-y0)/2+.06;
      target=[(x1+x0)/2,(y1+y0)/2,state.arms?.22:.08];vertical=radius*(state.elevation>.9?1.04:.86)+(state.arms?.13:0);horizontal=radius;
    }else{
      target=[0,0,state.arms?.42:.22];vertical=state.arms?.68:.52;horizontal=state.arms?.76:.62;
    }
    panels.forEach(panel=>panel.render(target,vertical,horizontal));
  }
  function set(changes){
    const rebuild=['dims','geometryHardware','arms','singleX','dualX','spacing','tab','drives','reference'].some(k=>k in changes);
    Object.assign(state,changes);if(rebuild)refresh();draw();window.syncTime?.();
  }
  for(const panel of panels){
    let pointer;
    panel.surface.onpointerdown=e=>{pointer=[e.clientX,e.clientY];panel.surface.setPointerCapture(e.pointerId);};
    panel.surface.onpointermove=e=>{if(!pointer)return;set({az:state.az-(e.clientX-pointer[0])*.009,elevation:Math.max(.04,Math.min(1.57,state.elevation+(e.clientY-pointer[1])*.008))});pointer=[e.clientX,e.clientY];window.refreshViews?.();};
    panel.surface.onlostpointercapture=()=>pointer=null;
    panel.surface.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();set({az:state.az+(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0),elevation:Math.max(.04,Math.min(1.57,state.elevation+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)))});window.refreshViews?.();};
  }
  let last=0;
  function tick(ms){if(state.tab==='motion'&&state.playing&&!state.manual){
    state.time=Math.min(end,state.time+Math.min((ms-last)/1000,.10));
    if(state.time>=end)state.playing=false;draw();window.syncTime?.();
  }last=ms;requestAnimationFrame(tick);}
  window.viewer={state,set,draw,profiles,available:panels.every(p=>p.renderer),poseAt,motion,wheelCommand,corners,mounts};
  refresh();new ResizeObserver(draw).observe(document.querySelector('.twins'));draw();requestAnimationFrame(tick);
})();
