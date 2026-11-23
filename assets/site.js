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
const comparisons=[
 {motion:'pivot',hardware:'diff_drive',name:['差速 · 自转','Differential · pivot'],title:['同一转动中心','One centre of rotation'],info:['左侧舵轮沿圆周切线滚动。右侧固定轮左右反转，前后轮在转动时存在横向擦滑。','The steerable wheels roll tangent to their circles. The fixed differential wheels counter-rotate on opposite sides and scrub laterally.'],ref:['四轮差速','Differential']},
 {motion:'lateral',hardware:'mecanum',name:['麦轮 · 横移','Mecanum · slide'],title:['同一横移距离','One lateral displacement'],info:['左侧四个舵轮都转到 90°。右侧麦轮的主轮保持朝前，两组对角轮反转，斜辊允许侧移。','All four 4WISD modules steer to 90°. The Mecanum wheels face forward; opposite diagonal speeds and angled rollers produce lateral travel.'],ref:['麦克纳姆','Mecanum']},
 {motion:'front',hardware:'ackermann_front',name:['阿克曼 · 转弯','Ackermann · turn'],title:['同一转弯半径','One turning radius'],info:['两侧内前轮转角均大于外前轮。4WISD 将后轮转角设为零，复现前轮阿克曼底盘的弯道。','On both chassis the inner front wheel turns more sharply. Holding the 4WISD rear wheels straight reproduces the front-steered Ackermann path.'],ref:['前轮阿克曼','Ackermann']}
];
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
for(const item of comparisons){
 const b=document.createElement('button');b.onclick=()=>{$('free').open=false;run([item.motion,item.motion],item.hardware);};$('pairs').append(b);
}
function run(drives,reference=null){set({drives,reference,time:0,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches});update();}
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
$('saveBase').onclick=()=>downloadUrdf('4wis');
$('saveRef').onclick=()=>downloadUrdf(state.reference);
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
 const i=state.english?1:0,move=state.tab==='motion',comparison=comparisons.find(c=>c.hardware===state.reference);
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
 $('saveRef').hidden=!(move&&comparison);
 $('mecanumNote').hidden=!(move&&state.reference==='mecanum');
 if(comparison)$('saveRef').textContent=word('下载 ','Download ')+comparison.ref[i]+' URDF';
 state.drives.forEach((key,j)=>{
   const sel=$('drive'+j),box=sel.parentElement,ab=j?'B':'A';
   box.querySelector('label').textContent=ab+word(' 车',' · drive');for(const opt of sel.options)opt.textContent=drives[opt.value][i];sel.value=key;box.querySelector('p').textContent=drives[key][2+i];
   const suffix=j?'b':'a',title=move?(comparison?(j?comparison.ref[i]:'4WISD')+' · '+drives[key][i]:drives[key][i]):j?word('当前 · ','Current · ')+labels[state.profile][i]:word('参照 · 标准底盘','Reference · standard');
   $('name-'+suffix).textContent=title;$('value-'+suffix).textContent=move?(ab+'  /  '+(j&&comparison?comparison.hardware:'4wis')):info(j?state.dims:profiles.standard);
   document.querySelector('#panel-'+suffix+' .overlay').setAttribute('aria-label',title+word('。拖动或按方向键旋转。','. Drag or use arrow keys to orbit.'));
 });
 [...$('pairs').children].forEach((b,j)=>{b.textContent=comparisons[j].name[i];b.setAttribute('aria-pressed',comparison===comparisons[j]);});
 $('demoTitle').textContent=comparison?comparison.title[i]:word('同底盘自由对照','Free 4WISD comparison');
 $('demoInfo').textContent=comparison?comparison.info[i]:word('两栏均为 4WISD，可分别切换运动。','Both panels use 4WISD. Choose either motion independently.');
 $('modelNote').textContent=move&&comparison?word('左右共用尺寸、起点、车身速度和时间轴。轨迹为理想运动学示意；麦轮斜辊为原理示意。','Both sides share dimensions, starting pose, chassis velocity and time. Paths are kinematic illustrations; Mecanum rollers are schematic.'):word('橙色箭头标出车头。模型尺寸源自 Xacro，运动为理想运动学演示。','The orange chevron marks the front. Geometry follows Xacro; motion is kinematic.');
 const d=state.dims;
 $('mountInfo').textContent=word('轮心高 ','Axle height ')+Math.round(d.radius*100)+' cm  ·  '+word('底面离地 ','Underbody clearance ')+Math.round(viewer.mounts(d,state.arms).underbody*100)+' cm';
 const installZ=Math.round((viewer.mounts(d,state.arms).deck)*100);
 $('mountInfo').textContent+=word(' · 雷达底面',' · LiDAR base')+(state.arms?word('与臂座',' and arm mount'):'')+' '+installZ+' cm';
 $('armInfo').textContent=state.arms===1?word('雷达在车顶中心，单臂底座位于雷达正后方，两者随车顶一起升降。','LiDAR is centred. The single arm sits directly behind it; both mounts follow the deck height.'):state.arms===2?word('中央雷达、左右双臂，三个底座随车顶同步升降。','The centre LiDAR and symmetric arm bases rise together with the deck.'):word('雷达安装在车顶中心。相机跟随车身前脸。','LiDAR sits at the deck centre. The camera follows the front face.');
 for(let n=0;n<2;n++){
   const info=$('wheel-'+n);info.hidden=!move;
   if(move){
     const wheels=viewer.corners(d).map(([x,y])=>viewer.wheelCommand(state.drives[n],d,x,y,n===1&&comparison?comparison.hardware:'4wis'));
     info.replaceChildren(...wheels.map((cmd,k)=>{const cell=document.createElement('span');cell.textContent=word(['左前','右前','左后','右后'][k],['FL','FR','RL','RR'][k])+' '+Math.round(cmd.angle*180/Math.PI)+'° / '+cmd.rate.toFixed(1);return cell;}));
   }
 }
 refreshViews();syncTime();
}
function openComparison(){
 const chosen={pivot:0,lateral:1,ackermann:2}[location.hash.slice(1)];
 if(chosen===undefined)return;
 switchTab(true);$('pairs').children[chosen].click();
 document.querySelector('.lab').scrollIntoView();
}
window.addEventListener('hashchange',openComparison);
update();openComparison();
})();
