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
const lessons={
 pivot:{
  title:['绕车心自转','Pivot about the centre'],info:['两车绕各自中心转过相同角度。观察左右轮的转速符号。','Both chassis rotate about their centres through the same angle. Compare the signs of the wheel speeds.'],
  a:['每个舵轮沿自己的圆周切线滚动，四个轮心绕车心画圆。','Each module steers tangent to the circle its wheel traces about the centre.'],
  b:['左右两侧反向驱动。四个轮面始终朝前，转动时轮胎存在侧向擦滑。','The two sides drive in opposite directions. The fixed wheels scrub sideways as the chassis turns.']},
 lateral:{
  title:['保持航向横移','Slide with heading fixed'],info:['两车向左平移相同距离。观察轮面朝向和对角轮组的转速。','Both chassis move left by the same distance. Compare wheel headings and the speeds of diagonal pairs.'],
  a:['四轮平行转到 90°，同速滚动，车头方向保持不变。','All four modules steer to 90° and roll at equal speed while the chassis holds its heading.'],
  b:['四个主轮朝前，两组对角轮反向转动。斜滚子允许底盘侧移。','The wheels face forward. Opposite diagonal pairs counter-rotate, and the angled rollers allow lateral motion.']},
 diagonal:{
  title:['保持航向斜移','Translate diagonally'],info:['两车同时向前、向左移动。车身航向保持不变。','Both chassis travel forward and left while holding the same heading.'],
  a:['四轮平行偏转约 40°，一起沿斜线滚动。','The modules all steer about 40° and roll together along the diagonal.'],
  b:['主轮朝向保持不变。前进与横移的轮速叠加，一组对角轮快，另一组慢。','Wheel planes stay fixed. Combining forward and lateral wheel speeds makes one diagonal pair faster than the other.']},
 coordinated:{
  title:['四轮转向与前轮转向','Four-wheel vs front steering'],info:['两车的车体前向速度和航向角速度相同。后轮约束不同，车心走出的弧线也不同。','Forward body speed and yaw rate match. The rear-wheel constraints give the chassis centres different arcs.'],
  a:['前轮向左、后轮向右，四个舵轮同时参与转弯。看后轮的负转角。','Front wheels steer left and rears steer right. All four participate in the turn; look for the negative rear angles.'],
  b:['后轮转角保持 0°，前轮向左偏转，内前轮的转角更大。','Both rears remain at 0°. The fronts steer left, with the inner wheel turning more sharply.']}
};
lessons['mecanum-pivot']={...lessons.pivot,
 b:['左侧两轮反转，右侧两轮正转。斜滚子允许轮心沿切线移动，四个主轮保持 0° 转角。','The left pair rolls backward and the right pair forward. Angled rollers accommodate tangential motion while wheel steering stays at 0°.']};
lessons.ackermann=lessons.coordinated;
lessons['rear-ackermann']={...lessons.coordinated,
 title:['四轮转向与后轮转向','Four-wheel vs rear steering'],
 info:['两车的前向速度和航向角速度相同。右车前轴固定，观察后轴向哪一侧偏转。','Both chassis share forward speed and yaw rate. Watch the rear steering direction when the front axle is fixed.'],
 b:['前轮保持 0°，两个后轮向右偏转，车头向左转。内后轮转角的绝对值更大。','Front wheels stay at 0°. The rears steer right to turn the nose left. The inner rear has the larger steering magnitude.']};
let motionExport='4wis';
const translated=[...document.querySelectorAll('[data-en]')].map(el=>[el,el.textContent]);
function word(zh,en){return state.english?en:zh;}
function scale(key){return key==='radius'?200:100;}
function info(d){return [d.length,d.width,d.height].map(v=>Math.round(v*100)).join(' × ')+' cm';}
function chooseProfile(key){set({dims:{...profiles[key]},profile:key});update();}
for(const key of Object.keys(profiles)){const b=document.createElement('button');b.dataset.key=key;b.onclick=()=>chooseProfile(key);$('presets').append(b);}
for(let i=0;i<2;i++){
 const box=document.createElement('div');box.className='drive-control';
 const id='drive'+i;box.innerHTML='<label for="'+id+'"></label><select id="'+id+'"></select><p></p>';
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
function switchTab(moving){
 set({tab:moving?'motion':'geometry',az:moving?-Math.PI/2:-1.04,elevation:moving?1.18:.58,time:0,playing:moving&&!matchMedia('(prefers-reduced-motion: reduce)').matches});update();
}
$('geo').onclick=()=>switchTab(false);$('move').onclick=()=>switchTab(true);
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
$('play').onclick=()=>{set({playing:!state.playing,time:state.time>=4?0:state.time});};
$('replay').onclick=()=>set({playing:true,time:0});
$('seek').oninput=e=>set({time:Number(e.target.value),playing:false});
$('lang').onclick=()=>{set({english:!state.english});update();};
window.syncTime=function(){
 if(state.tab==='motion'&&!state.manual){
  for(const [n,suffix] of ['a','b'].entries()){
   const [x,y,yaw]=viewer.poseAt(state.drives[n],state.dims,state.time);
   $('value-'+suffix).textContent='X '+(x*100).toFixed(0)+' cm  ·  Y '+(y*100).toFixed(0)+' cm  ·  '+word('航向 ','Yaw ')+Math.round(yaw*180/Math.PI)+'°';
  }
 }
 $('play').textContent=state.playing?word('暂停','Pause'):word('播放','Play');$('seek').value=state.time;$('clock').textContent=state.time.toFixed(1)+' / 4 s';
};
function update(){
 const i=state.english?1:0,move=state.tab==='motion',comparison=scenarios[activeScenario];
 document.documentElement.lang=word('zh-CN','en');document.title=word('Xmobot · 机器人形态与运动','Xmobot · Geometry & Motion');
 for(const [e,zh] of translated)e.textContent=word(zh,e.dataset.en);
 $('lang').textContent=word('English','中文');$('lang').lang=word('en','zh-CN');
 $('geometry').hidden=move;$('movement').hidden=!move;$('player').hidden=!move;$('geoFoot').hidden=move;
 $('geo').setAttribute('aria-pressed',!move);$('move').setAttribute('aria-pressed',move);
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
   box.querySelector('label').textContent=ab+word(' 车',' · drive');for(const opt of sel.options)opt.textContent=drives[opt.value][i];sel.value=key;box.querySelector('p').textContent=drives[key][2+i];
   const suffix=j?'b':'a',title=move?(comparison?(j?hardwareNames[comparison.hardware][i]:'Xmobot · 4WISD'):drives[key][i]):j?word('当前 · ','Current · ')+labels[state.profile][i]:word('参照 · 标准底盘','Reference · standard');
   $('name-'+suffix).textContent=title;$('value-'+suffix).textContent=move?(ab+'  /  '+(j&&comparison?comparison.hardware:'4wis')):info(j?state.dims:profiles.standard);
   document.querySelector('#panel-'+suffix+' .overlay').setAttribute('aria-label',title+word('。拖动或按方向键旋转。','. Drag or use arrow keys to orbit.'));
 });
 [...$('pairs').children].forEach((b,j)=>{b.textContent=groups[j].name[i];b.setAttribute('aria-pressed',group===groups[j]);});
 const lesson=comparison?lessons[activeScenario]:null;
 $('demoTitle').textContent=lesson?lesson.title[i]:word('自由对照','Free comparison');
 $('demoInfo').textContent=lesson?lesson.info[i]:word('分别选择两台 4WISD 的运动，比较同一时刻的位置与航向。','Select a motion for each 4WISD and compare their positions and headings at the same instant.');
 for(const [j,id] of ['a','b'].entries())$('explain-'+id).textContent=lesson?lesson[id][i]:drives[state.drives[j]][2+i];
 $('modelNote').textContent=move?word('理想运动学演示。金色尖角标记车头，虚线为起点轮廓。','Ideal kinematics. The gold chevron marks the nose; the dashed outline marks the start.'):word('左右使用相同比例。拖动视图可同步旋转。','Both views use the same scale. Drag to orbit them together.');
 const d=state.dims;
 $('mountInfo').textContent=word('轮心高 ','Axle height ')+Math.round(d.radius*100)+' cm  ·  '+word('底面离地 ','Underbody clearance ')+Math.round(viewer.mounts(d,state.arms).underbody*100)+' cm';
 const installZ=Math.round((viewer.mounts(d,state.arms).deck)*100);
 $('mountInfo').textContent+=word(' · 雷达底面',' · LiDAR base')+(state.arms?word('与臂座',' and arm mount'):'')+' '+installZ+' cm';
 for(let n=0;n<2;n++){
   const info=$('wheel-'+n);info.hidden=!move;
   if(move){
     const wheels=viewer.corners(d).map(([x,y])=>viewer.wheelCommand(state.drives[n],d,x,y,n===1&&comparison?comparison.hardware:'4wis'));
     info.replaceChildren(...wheels.map((cmd,k)=>{const cell=document.createElement('span');cell.style.setProperty('--steer',(-cmd.angle)+'rad');cell.textContent=word(['左前','右前','左后','右后'][k],['FL','FR','RL','RR'][k])+' '+Math.round(cmd.angle*180/Math.PI)+'° / '+cmd.rate.toFixed(1);return cell;}));
   }
 }
 renderKinematics(state,hardwareNames);
 refreshViews();syncTime();
}
function openComparison(){
 const key=location.hash.slice(1);
 if(!Object.hasOwn(scenarios,key))return;
 switchTab(true);selectScenario(key);
 document.querySelector('.lab').scrollIntoView();
}
window.addEventListener('hashchange',openComparison);
$('wheelExample').onchange=()=>renderKinematics(state,hardwareNames);
$('editGeometry').onclick=()=>{switchTab(false);$('wheelbase').focus();};
$('seeEquations').onclick=()=>{switchTab(true);$('kinematics').scrollIntoView();};
update();openComparison();
})();
