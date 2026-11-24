(() => {
const $=id=>document.getElementById(id);
const {state,profiles,set}=viewer;
const labels={standard:['标准','Standard'],thick:['仅加厚','Thicker deck'],long:['窄长','Long & narrow'],wide:['宽扁','Wide & low'],high:['高身大轮','Tall · big wheels'],custom:['自定义','Custom']};
const drives={
 straight:['直行','Straight','四个轮子平行朝前，同速向前滚动。','All four wheels point forward and roll at the same speed.'],
 lateral:['横移','Lateral','四轮转到 90°，车头保持向前，整车向侧面移动。','All wheels steer to 90° and roll sideways with the heading fixed.'],
 diagonal:['斜行','Diagonal crab','四轮平行偏转同一角度，车身沿斜线平移。','Parallel steering translates the chassis diagonally.'],
 pivot:['绕中心自转','Centre pivot','各轮沿绕车心的圆周切线滚动，轮心绕车心画圆。','Each wheel rolls tangent to its circle around the chassis centre.'],
 front:['前轴转向','Front steering','后轮转角置零，前轮按内外轮半径分别偏转。','Hold the rears straight and steer each front wheel into the turn.'],
 rear:['后轴转向','Rear steering','前轮转角置零，后轮向右偏，车头向左转。','Hold the fronts straight; steer the rears right to turn the nose left.'],
 coordinated:['四轮协调转弯','Coordinated turn','前后轮反相偏转，内外轮各按自身转弯半径滚动。','Front and rear wheels counter-steer. Each speed follows its own turning radius.']
};
const groups=[
 {name:['自转','Pivot'], choices:['pivot','mecanum-pivot']},
 {name:['平移','Translate'], choices:['lateral','diagonal']},
 {name:['转弯','Turn'], choices:['ackermann','rear-ackermann']}
];
const scenarios={
 pivot:{name:['差速','Differential'],hardware:'diff_drive',modes:['pivot','pivot']},
 'mecanum-pivot':{name:['麦轮','Mecanum'],hardware:'mecanum',modes:['pivot','pivot']},
 lateral:{name:['横移','Sideways'],hardware:'mecanum',modes:['lateral','lateral']},
 diagonal:{name:['斜移','Diagonal'],hardware:'mecanum',modes:['diagonal','diagonal']},
 ackermann:{name:['前轮阿克曼','Front Ackermann'],hardware:'ackermann_front',modes:['coordinated','front']},
 'rear-ackermann':{name:['后轮阿克曼','Rear Ackermann'],hardware:'ackermann_rear',modes:['coordinated','rear']}
};
let activeScenario='pivot';
const hardwareNames={ '4wis':['4WISD','4WISD'],diff_drive:['四轮差速','Differential'],
 mecanum:['麦克纳姆','Mecanum'],ackermann_front:['前轮阿克曼','Front Ackermann'],ackermann_rear:['后轮阿克曼','Rear Ackermann'] };
const turnLesson={
 title:['左转','Left turn'],
 info:['两车前向速度与航向角速度相同，车心轨迹随转向方式而变。','Forward speed and yaw rate match. The steering geometry determines each centre path.'],
 a:['前轮向左、后轮向右，同侧前后轮转角大小相等。','Fronts steer left and rears steer right, by equal angles on each side.']
};
const pivotLesson={
 title:['绕车心自转','Centre pivot'],
 info:['车心位置不变，两车以相同角速度左转。','Both chassis rotate anticlockwise in place at the same yaw rate.'],
 a:['四个舵轮沿各自圆形轨迹的切线滚动。','All four wheels steer tangent to their circular paths.']
};
const lessons={
 pivot:{...pivotLesson,
  b:['左轮后滚、右轮前滚，固定轮在转动中侧向擦滑。','Left wheels roll backward and right wheels forward, with lateral tyre scrub.']},
 'mecanum-pivot':{...pivotLesson,
  b:['左轮后滚、右轮前滚，斜滚子允许轮心侧向运动。','Left wheels roll backward and right wheels forward, with lateral motion at the rollers.']},
 lateral:{
  title:['横移','Sideways translation'],info:['车头朝向不变，两车以相同速度向左移动。','Both chassis move left at the same speed and keep their heading.'],
  a:['四个舵轮向左偏转 90°，同速滚动。','All four wheels steer 90° left and roll at equal speed.'],
  b:['四个主轮朝前，两组对角轮等速反转。','All four wheels face forward. The diagonal pairs spin at equal speeds in opposite directions.']},
 diagonal:{
  title:['斜移','Diagonal translation'],info:['车头朝向不变，两车以相同速度向左前方移动。','Both chassis move forward and left at the same speed and keep their heading.'],
  a:['四个舵轮向左偏转约 40°，同速滚动。','All four wheels steer about 40° left and roll at equal speed.'],
  b:['四个主轮朝前，右前和左后轮快于另一对角轮组。','All four wheels face forward. The front-right and rear-left wheels spin faster than the other pair.']},
 ackermann:{...turnLesson,
  b:['前轮向左、后轮保持 0°，内前轮转角更大。','Fronts steer left and rears stay at 0°. The inner front wheel steers more sharply.']},
 'rear-ackermann':{...turnLesson,
  b:['前轮保持 0°、后轮向右，内后轮偏转幅度更大。','Fronts stay at 0° and rears steer right. The inner rear wheel steers more sharply.']}
};
let motionExport='4wis';
const translated=[...document.querySelectorAll('[data-en]')].map(el=>[el,el.textContent]);
function word(zh,en){return state.english?en:zh;}
function scale(key){return key==='radius'?200:100;}
function info(d){return [d.length,d.width,d.height].map(v=>Math.round(v*100)).join(' × ')+' cm';}
function chooseProfile(key){set({dims:{...profiles[key]},profile:key});update();}
for(const key of Object.keys(profiles)){const b=document.createElement('button');b.dataset.key=key;b.onclick=()=>chooseProfile(key);$('presets').append(b);}
for(let i=0;i<2;i++){
 const box=document.createElement('div');box.className='drive-control';
 const id='drive'+i;box.innerHTML='<label for="'+id+'"></label><select id="'+id+'"></select>';
 $('driveSelects').append(box);
 for(const key of Object.keys(drives)){const option=document.createElement('option');option.value=key;$(id).append(option);}
 $(id).onchange=e=>{const modes=state.drives.slice();modes[i]=e.target.value;run(modes);};
}
for(const group of groups){
 const button=document.createElement('button');
 button.onclick=()=>selectScenario(group.choices.includes(activeScenario)?activeScenario:group.choices[0]);
 $('pairs').append(button);
}
function selectScenario(key){
 activeScenario=key;
 const {modes,hardware}=scenarios[key];
 $('free').open=false;
 run(modes,hardware);
}
function run(drives,reference=null){
 if(!reference)activeScenario=null;
 motionExport='4wis';
 set({drives,reference,time:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches});
 update();
}
let savedLap=null;
function switchTab(tab){
 if(state.tab===tab)return;
 if(state.tab==='route')savedLap={time:state.time,playing:state.playing};
 const moving=tab!=='geometry';
 set({tab,az:moving?-Math.PI/2:-1.04,elevation:moving?1.18:.58,time:0,playing:moving&&!matchMedia('(prefers-reduced-motion: reduce)').matches,...(tab==='route'?savedLap:null)});update();
}
$('route').onclick=()=>switchTab('route');
$('geo').onclick=()=>switchTab('geometry');$('move').onclick=()=>switchTab('motion');
for(const [id,az,el] of [['angle',-1.04,.58],['topview',-Math.PI/2,1.57],['side',-Math.PI/2,.055]]){
 $(id).onclick=()=>{set({az,elevation:el});refreshViews();};
}
window.refreshViews=function(){for(const [id,v] of [['angle',.58],['topview',1.57],['side',.055]])$(id).setAttribute('aria-pressed',Math.abs(state.elevation-v)<.005);};
for(const key of Object.keys(profiles.standard)){
 $(key).oninput=e=>{const dims={...state.dims,[key]:Number(e.target.value)/scale(key)};set({dims,profile:'custom'});update();};
}
$('arms').onchange=e=>{set({arms:Number(e.target.value)});update();};
$('armX').oninput=e=>{set({[state.arms===1?'singleX':'dualX']:Number(e.target.value)/1000});update();};
$('spacing').oninput=e=>{set({spacing:Number(e.target.value)/1000});update();};
$('autoMount').onclick=()=>{set(state.arms===1?{singleX:null}:{dualX:null,spacing:null});update();};
$('hardware').onchange=e=>{
 if(state.tab==='geometry')set({geometryHardware:e.target.value});else motionExport=e.target.value;
 update();
};
$('saveBase').onclick=()=>downloadUrdf($('hardware').value);
$('play').onclick=()=>{set({playing:!state.playing,time:state.time>=viewer.duration()?0:state.time});};
$('replay').onclick=()=>set({playing:true,time:0});
$('seek').oninput=e=>set({time:Number(e.target.value),playing:false});
$('lang').onclick=()=>{set({english:!state.english});update();};
const lap=XmobotRoute;
const [[xmin,xmax],[ymin,ymax]]=lap.extent;
const mapScale=Math.min(222/(xmax-xmin),150/(ymax-ymin));
const mapPoint=([x,y])=>[126+(x-lap.midpoint[0])*mapScale,90-(y-lap.midpoint[1])*mapScale];
function mapShape(points){
 return points.filter((_,i)=>i%3===0||i===points.length-1).map((p,i)=>
   (i?'L':'M')+mapPoint(p).map(v=>v.toFixed(2)).join(' ')).join(' ');
}
$('mapPlan').setAttribute('d',mapShape(lap.centre));
const mapTracks=lap.tracks.map(points=>{
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('d',mapShape(points));path.setAttribute('pathLength','1');$('mapTracks').append(path);
 const lengths=[0];
 for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 return {path,lengths};
});
const [startX,startY]=mapPoint(lap.centre[0]);
$('mapStart').setAttribute('cx',startX);$('mapStart').setAttribute('cy',startY);
const phaseNotes=[
 ['四个舵轮朝前，以相同速度滚动。','All four wheels point forward and roll at the same speed.'],
 ['前轮向右、后轮向左，四个轮心分别沿弧线运动。','Front wheels steer right and rear wheels left. Each wheel centre follows its own arc.'],
 ['四轮平行向左，车身横移时保持航向。','All wheels roll left in parallel while the chassis holds its heading.'],
 ['四轮朝左前方滚动，航向保持不变。','All wheels roll diagonally forward and left with a fixed heading.'],
 ['前轮向右偏转，后轮保持正向，车头向右转。','The front wheels steer right, the rear wheels stay straight and the chassis turns right.'],
 ['前轮保持正向，后轮向右偏转，车头向左转。','The front wheels stay straight and the rear wheels steer right, turning the chassis left.'],
 ['前进中，侧向速度由左变右，同时车头向左转动。','During forward travel, lateral velocity changes from left to right while the chassis yaws left.'],
 ['车心停在起点，各轮沿圆周切线滚动，将车头转回初始方向。','The centre stays at the start point. The wheels roll tangentially to turn the chassis back to its initial heading.']
];
function syncRoute(){
 const index=lap.indexAt(state.time),[x,y,yaw]=lap.frames[index].p;
 const plot=$('velocityPlot'),g=plot.getContext('2d'),frame=lap.frames[index];
 if(plot.dataset.frame!==String(index)||plot.dataset.lang!==String(state.english)){
   g.clearRect(0,0,plot.width,plot.height);XmobotVelocity.draw(g,frame,0,0,plot.width,plot.height,state.english);
   const [vx,vy,w]=XmobotVelocity.twist(frame).map(v=>v.toFixed(2));
   plot.setAttribute('aria-label',word('车身坐标系速度','Body-frame velocity')+' · vx '+vx+' m/s · vy '+vy+' m/s · ω '+w+' rad/s');
   plot.dataset.frame=index;plot.dataset.lang=state.english;
 }
 const [px,py]=mapPoint([x,y]), total=lap.distance.at(-1);
 const phase=lap.stages.findLast(([start])=>state.time>=start);
 const explanation=phaseNotes[lap.stages.indexOf(phase)][state.english?1:0];
 if($('lapExplanation').textContent!==explanation)$('lapExplanation').textContent=explanation;
 $('value-a').textContent=state.time>=lap.duration?word('已回到起点','Lap complete'):phase[state.english?2:1];
 $('lapDistance').textContent=lap.distance[index].toFixed(1)+' / '+total.toFixed(1)+' m';
 for(const {path,lengths} of mapTracks)path.setAttribute('stroke-dasharray',(lengths[index]/lengths.at(-1))+' 1');
 $('mapRobot').setAttribute('transform','translate('+px+' '+py+') rotate('+(-yaw*180/Math.PI)+')');
}
window.syncTime=function(){
 if(state.tab==='route')syncRoute();
 if(state.tab==='motion'&&!state.manual){
  for(const [n,suffix] of ['a','b'].entries()){
   const [x,y,yaw]=viewer.poseAt(state.drives[n],state.dims,state.time);
   $('value-'+suffix).textContent='X '+(x*100).toFixed(0)+' cm  ·  Y '+(y*100).toFixed(0)+' cm  ·  '+word('航向 ','Yaw ')+Math.round(yaw*180/Math.PI)+'°';
  }
 }
 $('play').textContent=state.playing?word('暂停','Pause'):word('播放','Play');$('seek').max=viewer.duration();$('seek').value=state.time;$('clock').textContent=state.time.toFixed(1)+' / '+viewer.duration()+' s';
};
function update(){
 const i=state.english?1:0,move=state.tab==='motion',route=state.tab==='route',comparison=scenarios[activeScenario];
 document.documentElement.lang=word('zh-CN','en');document.title=word('Xmobot · 机器人形态与运动','Xmobot · Geometry & Motion');
 for(const [e,zh] of translated)e.textContent=word(zh,e.dataset.en);
 $('lang').textContent=word('English','中文');$('lang').lang=word('en','zh-CN');
 $('lapSummary').hidden=!route;$('setupControls').hidden=route;$('kinematics').hidden=route;
 $('panel-b').hidden=route;document.querySelector('.twins').classList.toggle('route-view',route);
 $('route').setAttribute('aria-pressed',route);
 $('geometry').hidden=move||route;$('movement').hidden=!move;$('player').hidden=!move&&!route;$('geoFoot').hidden=move||route;
 $('geo').setAttribute('aria-pressed',!move&&!route);$('move').setAttribute('aria-pressed',move);
 for(const b of $('presets').children){b.textContent=labels[b.dataset.key][i];b.setAttribute('aria-pressed',state.profile===b.dataset.key);}
 for(const key of Object.keys(profiles.standard)){
  const val=Math.round(state.dims[key]*scale(key));$(key).value=val;document.querySelector('output[for="'+key+'"]').textContent=val+' cm';
 }
 $('arms').value=String(state.arms);
 const m=viewer.mounts(state.dims,state.arms);
 $('armAdjust').hidden=!state.arms;$('spacingRow').hidden=state.arms!==2;
 for(const [id,lo,hi,value] of [['armX',m.minX,m.maxX,m.armX],['spacing',.102,m.maxSpacing,m.dualY*2]]){
   const input=$(id);input.min=Math.ceil(lo*1000-1e-9);input.max=Math.floor(hi*1000+1e-9);
   input.value=Math.round(value*1000);
   document.querySelector('output[for="'+id+'"]').textContent=Number((value*1000).toFixed(1))+' mm';
 }
 const hardware=move?motionExport:state.geometryHardware;
 const available=move?(comparison?['4wis',comparison.hardware]:['4wis']):Object.keys(hardwareNames);
 $('hardware').replaceChildren(...available.map(key=>new Option(hardwareNames[key][i],key)));
 $('hardware').value=hardware;
 $('mecanumNote').hidden=hardware!=='mecanum';
 $('comparisonBar').hidden=!move;
 $('explanations').hidden=!move;
 const group=groups.find(item=>item.choices.includes(activeScenario));
 const variants=$('variants');
 variants.hidden=!group;
 if(group){
   if(variants.dataset.group!==group.choices[0]){
     variants.replaceChildren(...group.choices.map(key=>{
       const button=document.createElement('button');
       button.id=key;button.onclick=()=>selectScenario(key);return button;
     }));
     variants.dataset.group=group.choices[0];
   }
   for(const button of variants.children){
     button.textContent=scenarios[button.id].name[i];
     button.setAttribute('aria-pressed',button.id===activeScenario);
   }
 }
 state.drives.forEach((key,j)=>{
   const sel=$('drive'+j),box=sel.parentElement,ab=j?'B':'A';
   box.querySelector('label').textContent=ab+word(' 车',' · drive');for(const opt of sel.options)opt.textContent=drives[opt.value][i];sel.value=key;
   const suffix=j?'b':'a',title=route?'Xmobot · 4WISD':move?(comparison?(j?hardwareNames[comparison.hardware][i]:'Xmobot · 4WISD'):drives[key][i]):j?word('当前 · ','Current · ')+labels[state.profile][i]:word('参照 · 标准底盘','Reference · standard');
   $('name-'+suffix).textContent=title;$('value-'+suffix).textContent=move?(ab+'  /  '+(j&&comparison?comparison.hardware:'4wis')):info(j?state.dims:profiles.standard);
   document.querySelector('#panel-'+suffix+' .overlay').setAttribute('aria-label',title+word('。拖动或按方向键旋转。','. Drag or use arrow keys to orbit.'));
 });
 [...$('pairs').children].forEach((b,j)=>{b.textContent=groups[j].name[i];b.setAttribute('aria-pressed',group===groups[j]);});
 const lesson=comparison?lessons[activeScenario]:null;
 $('demoTitle').textContent=lesson?lesson.title[i]:word('自由对照','Free comparison');
 $('demoInfo').textContent=lesson?lesson.info[i]:word('分别选择两台 4WISD 的运动，比较同一时刻的位置与航向。','Select a motion for each 4WISD and compare their positions and headings at the same instant.');
 for(const [j,id] of ['a','b'].entries())$('explain-'+id).textContent=lesson?lesson[id][i]:drives[state.drives[j]][2+i];
 $('modelNote').hidden=!move;
 const d=state.dims;
 $('mountInfo').textContent=word('轮心高 ','Axle height ')+Number((d.radius*100).toFixed(1))+' cm  ·  '+word('底面离地 ','Underbody clearance ')+Math.round(viewer.mounts(d,state.arms).underbody*100)+' cm';
 const installZ=Math.round((viewer.mounts(d,state.arms).deck)*100);
 $('mountInfo').textContent+=word(' · 雷达底面',' · LiDAR base')+(state.arms?word('与臂座',' and arm mount'):'')+' '+installZ+' cm';
 for(let n=0;n<2;n++){
   const info=$('wheel-'+n);info.hidden=!move;
   if(move){
     const wheels=viewer.corners(d).map(([x,y])=>viewer.wheelCommand(state.drives[n],d,x,y,n===1&&comparison?comparison.hardware:'4wis'));
     info.replaceChildren(...wheels.map((cmd,k)=>{const cell=document.createElement('span');cell.style.setProperty('--steer',(-cmd.angle)+'rad');cell.textContent=word(['左前','右前','左后','右后'][k],['FL','FR','RL','RR'][k])+' '+Math.round(cmd.angle*180/Math.PI)+'° / '+cmd.rate.toFixed(1);return cell;}));
   }
 }
 if(!route)renderKinematics(state,hardwareNames);
 viewer.draw();refreshViews();syncTime();
}
function openComparison(){
 const key=location.hash.slice(1);
 if(key==='classic'||key==='letter'){
   if(key==='letter')history.replaceState(null,'','#classic');
   switchTab('route');document.querySelector('.lab').scrollIntoView();return;
 }
 if(key==='compound'){
   switchTab('route');set({time:lap.stages[6][0],playing:!matchMedia('(prefers-reduced-motion: reduce)').matches});document.querySelector('.lab').scrollIntoView();return;
 }
 if(key==='route'||key==='kinematics'){
   switchTab(key==='route'?'route':'motion');(key==='route'?document.querySelector('.lab'):$('kinematics')).scrollIntoView();return;
 }
 if(key==='geometry'){
   switchTab('geometry');document.querySelector('.lab').scrollIntoView();return;
 }
 if(!Object.hasOwn(scenarios,key))return;
 switchTab('motion');selectScenario(key);
 document.querySelector('.lab').scrollIntoView();
}
window.addEventListener('hashchange',openComparison);
$('wheelExample').onchange=()=>renderKinematics(state,hardwareNames);
$('editGeometry').onclick=()=>{switchTab('geometry');$('wheelbase').focus();};
$('seeEquations').onclick=()=>{switchTab('motion');$('kinematics').scrollIntoView();};
update();openComparison();
})();
