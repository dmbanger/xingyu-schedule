'use strict';
const C=ScheduleCore,$=s=>document.querySelector(s),N=window.Native;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-3.7c-1-.6-.6-2.3.6-2.3H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7.5 10h.01M11 6.5h.01M16 8h.01M6.5 14h.01"/>',settings:'<path d="m9 3-.5 2.5-2 1.2L4 6l-2 3 2 2v2l-2 2 2 3 2.5-.7 2 1.2L9 21h5l.5-2.5 2-1.2 2.5.7 2-3-2-2v-2l2-2-2-3-2.5.7-2-1.2L14 3Z"/><circle cx="11.5" cy="12" r="3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',school:'<path d="m2 9 10-6 10 6-10 6L2 9Zm4 3v6c4 3 8 3 12 0v-6m4-3v9"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 14h8m-8 3h5"/>',star:'<path d="m12 2 2.8 6.1 6.7.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6L2.5 9l6.7-.9Z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',upload:'<path d="M12 15V3M7 8l5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',lock:'<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'};
const WEEKDAYS=['','一','二','三','四','五','六','日'];
const EASE_IOS='cubic-bezier(.32,.72,0,1)',EASE_SPRING='cubic-bezier(.34,1.42,.64,1)';
// 轻触反馈交给原生振动；浏览器预览里没有 Native，直接忽略。
function haptic(kind){try{if(N&&N.haptic)N.haptic(kind||'tick');}catch(_){}}
// 原生层把状态栏、手势条高度（CSS 像素）传进来，页面自己留白，壁纸就能铺满全屏。
window.applyInsets=text=>{const [top,bottom]=String(text||'').split(',').map(Number),root=document.documentElement.style;if(isFinite(top)&&root.getPropertyValue('--safe-top')!==top+'px')root.setProperty('--safe-top',top+'px');if(isFinite(bottom)&&root.getPropertyValue('--safe-bottom')!==bottom+'px')root.setProperty('--safe-bottom',bottom+'px');};
try{if(N&&N.insets)window.applyInsets(N.insets());}catch(_){}
const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.star)+'</svg>';
let state=C.defaultState(),tab='schedule',sample=false,viewWeek=1,toastTimer,pendingImport=null,courseColor='lavender',undoAvailable=false,suppressCourseClickUntil=0;
const T=()=>state.timetables.find(t=>t.id===state.activeId)||state.timetables[0];
function uniqueTimetableName(base){let name=base,n=2;while(state.timetables.some(t=>t.name===name))name=base+' '+(n++);return name;}
function persistTimetable(patch){const cur=T(),next={...cur,...patch};return persist({...state,timetables:state.timetables.map(t=>t.id===next.id?next:t)});}
function pickSemester(s){const out={};for(const k of ['semesterStart','totalWeeks','periods','times','semesterConfigured'])if(s&&s[k]!==undefined)out[k]=s[k];return out;}
function pickGlobal(s){const out={};for(const k of ['schoolName','schoolUrl','schoolPreset','theme'])if(s&&typeof s[k]==='string')out[k]=s[k];if(s&&typeof s.cardOpacity==='number')out.cardOpacity=s.cardOpacity;if(s&&typeof s.wallpaperClarity==='number')out.wallpaperClarity=s.wallpaperClarity;out.background=s&&s.background==='none'?'none':'builtin';return out;}
let weekMotion=null,weekFeedbackTimer;
const demo=C.normalizeCourses([
{name:'高等数学',teacher:'示例教师',room:'教三 201',day:1,start:1,end:2,weeks:'1-20',color:'lavender'},
{name:'大学英语',teacher:'示例教师',room:'教二 305',day:2,start:3,end:4,weeks:'1-20',color:'mint'},
{name:'程序设计',teacher:'示例教师',room:'实验楼 402',day:3,start:1,end:2,weeks:'1-20',color:'sky'},
{name:'线性代数',teacher:'示例教师',room:'教三 108',day:4,start:3,end:4,weeks:'1-20',color:'rose'},
{name:'大学物理',teacher:'示例教师',room:'教一 207',day:5,start:1,end:2,weeks:'1-20',color:'peach'},
{name:'离散数学',teacher:'示例教师',room:'教三 201',day:1,start:6,end:7,weeks:'1-20',color:'mint'},
{name:'体育',teacher:'示例教师',room:'体育馆',day:3,start:8,end:9,weeks:'1-20',color:'lemon'},
{name:'计算机实验',teacher:'示例教师',room:'实验楼 302',day:4,start:6,end:8,weeks:'1-20',color:'lavender'}]);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3600);}
function persist(next){try{next=C.sanitizeState(next);const text=JSON.stringify(next);if(N){if(!N.saveState(text))throw new Error('保存失败，请检查手机剩余空间');}else localStorage.setItem('xingyu-state',text);state=next;neighbourCache={week:0,prev:null,next:null};applyTheme();return true;}catch(e){toast(e.message||'未能保存');return false;}}
function updateSettings(patch){return persist({...state,settings:{...state.settings,...patch}});}
function getBackup(){try{return N?N.getImportBackup():localStorage.getItem('xingyu-before-import')||'';}catch(_){return '';}}
function saveImportBackup(){const text=JSON.stringify(state);if(N)return N.backupBeforeImport(text);localStorage.setItem('xingyu-before-import',text);return true;}
try{const text=N?N.getState():localStorage.getItem('xingyu-state');if(text)state=C.sanitizeState(JSON.parse(text));}catch(_){toast('保存的数据未能读取，请从备份恢复。');}
undoAvailable=!!getBackup();
function currentWeek(){return C.weekAt(T().semesterStart);}
viewWeek=Math.min(T().totalWeeks,Math.max(1,currentWeek()));
let appliedBackground='',appliedTheme='',customWallpaperURL='';
function backgroundURL(){
  if(state.settings.background==='none')return '';
  if(state.settings.background==='custom'){
    if(!N)return localStorage.getItem('xingyu-wallpaper')||'';
    // 只在本次运行里生成一次带时间戳的地址；以前每次 render 都换地址，浏览器只能重新加载壁纸，
    // 翻周时就会闪一下白。
    if(!customWallpaperURL)customWallpaperURL='https://appassets.androidplatform.net/wallpaper?v='+Date.now();
    return customWallpaperURL;
  }
  return 'wallpaper.png';
}
// 背景通透度：柔光层与课表网格底色随数值变淡；超过 30% 后，压在壁纸上的文字加一圈柔光保证看得清
function applyClarity(value){document.documentElement.style.setProperty('--clarity',(Number(value)||0)/100);document.body.classList.toggle('clear',Number(value)>=30);}
function applyTheme(){
  document.body.dataset.theme=state.settings.theme;
  applyClarity(state.settings.wallpaperClarity);
  document.documentElement.style.setProperty('--card-alpha',state.settings.cardOpacity/100);
  if(appliedTheme!==state.settings.theme){
    appliedTheme=state.settings.theme;const dark=appliedTheme==='night';
    document.querySelector('meta[name=theme-color]').content=dark?'#0e0c1a':appliedTheme==='sakura'?'#fdf6f8':'#f7f5fd';
    syncSystemBars();
  }
  const url=backgroundURL();
  if(url===appliedBackground)return;
  appliedBackground=url;
  $('#wallpaper').style.backgroundImage=url?'url("'+url.replace(/["\\\n\r]/g,'')+'")':'';
}
function render(){stopWeekMotion();applyTheme();$('#today-button').hidden=tab!=='schedule';$('#content').dataset.tab=tab;if(tab!=='schedule'){document.body.classList.remove('immersive');$('#week-feedback').classList.remove('visible');}renderNav();$('#header-title').textContent=headerTitle();$('#content').innerHTML=({schedule:renderSchedule,import:renderImport,theme:renderTheme,settings:renderSettings}[tab])();bindView();measureTitle();requestAnimationFrame(syncHeader);if(tab==='schedule')primeNeighbours();}
function go(next){const changed=next!==tab;tab=next;if(changed)haptic('tick');render();$('#content').scrollTop=0;syncHeader();if(changed)revealContent();}
// 底部导航只建一次，之后只移动选中块，这样它才能从一个标签滑到另一个标签。
const TABS=[['schedule','calendar','课表'],['import','download','导入'],['theme','palette','装扮'],['settings','settings','设置']];
function renderNav(){
  const nav=$('#navigation');
  if(!nav.querySelector('.nav-item'))nav.innerHTML='<span class="nav-pill" aria-hidden="true"></span>'+TABS.map(([id,ico,label])=>'<button class="nav-item" data-action="tab" data-tab="'+id+'"><span class="nav-icon">'+icon(ico)+'</span>'+label+'</button>').join('');
  nav.style.setProperty('--tab-index',Math.max(0,TABS.findIndex(t=>t[0]===tab)));
  nav.querySelectorAll('.nav-item').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');});
}
function headerTitle(){
  if(tab!=='schedule')return {import:'导入课表',theme:'装扮',settings:'设置'}[tab]||'';
  const start=C.monday(C.parseDate(T().semesterStart));start.setDate(start.getDate()+(viewWeek-1)*7);
  return (start.getMonth()+1)+'月 · 第 '+viewWeek+' 周';
}
// 顶栏：内容一滚动就浮出毛玻璃；大标题滚出视野后，顶栏中间换成小标题。
let titleEdge=60,headerRaf=0;
function measureTitle(){const c=$('#content'),t=c.querySelector('.month-label,.page-title');titleEdge=t?t.offsetTop+t.offsetHeight*.7-parseFloat(getComputedStyle(c).paddingTop):60;}
function syncHeader(){
  const c=$('#content'),top=c.scrollTop,h=$('.app-header');h.classList.toggle('scrolled',top>2);h.classList.toggle('titled',top>titleEdge);
  // 日期栏平时和上面的卡片一样半透明；吸在顶部、课程从下面滚过时换成更实的底，免得字叠在一起
  const stage=tab==='schedule'&&c.querySelector('.week-stage'),dh=stage&&stage.querySelector('.day-header');
  c.classList.toggle('stuck',!!dh&&dh.getBoundingClientRect().top-stage.getBoundingClientRect().top>.5);
}
// 切换页面时内容逐块浮现；课表页的课程卡片按星期、节次依次弹出。
function revealContent(){
  if(reducedMotion()||!document.body.animate)return;
  Array.from($('#content').children).slice(0,8).forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:520,delay:i*35,easing:EASE_IOS,fill:'backwards'}));
  if(tab!=='schedule')return;
  document.querySelectorAll('.week-stage>.week-page .course-card').forEach(card=>{
    const delay=Math.min(420,110+(Number(card.style.gridColumnStart)-2)*30+(Number(card.style.gridRowStart)-1)*12);
    card.animate([{opacity:0,transform:'scale(.84)'},{opacity:1,transform:'none'}],{duration:560,delay,easing:EASE_SPRING,fill:'backwards'});
  });
}
function visibleCourses(){return sample?demo:T().courses;}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches;}
function showWeekFeedback(week,hold=false,prefix=''){
  const hint=$('#week-feedback');hint.textContent=(prefix?prefix+' · ':'')+'第 '+week+' / '+T().totalWeeks+' 周';hint.classList.add('visible');
  clearTimeout(weekFeedbackTimer);if(!hold)weekFeedbackTimer=setTimeout(()=>hint.classList.remove('visible'),950);
}
function stopWeekMotion(){if(!weekMotion)return;const motion=weekMotion;weekMotion=null;motion.animations.forEach(a=>a.cancel());motion.cleanup();}
function animateWeekPages(stage,page,peer,direction,offset,committing,onDone){
  stopWeekMotion();
  const width=stage.clientWidth+12;
  const cleanup=()=>{peer?.remove();page.style.transform='';page.classList.remove('week-moving');};
  if(reducedMotion()||!page.animate){cleanup();if(onDone)onDone();return;}
  page.classList.add('week-moving');
  const duration=committing?Math.max(150,Math.round(260*(1-Math.min(Math.abs(offset)/width,.65)))):180;
  const options={duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'};
  const animations=[page.animate([{transform:'translateX('+(committing?offset+direction*width:offset)+'px)'},{transform:'translateX(0)'}],options)];
  if(peer)animations.push(peer.animate([{transform:'translateX('+(committing?offset:offset+direction*width)+'px)'},{transform:'translateX('+(committing?-direction*width:direction*width)+'px)'}],options));
  const motion={animations,cleanup};weekMotion=motion;
  Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(weekMotion!==motion)return;weekMotion=null;cleanup();animations.forEach(a=>a.cancel());if(onDone)onDone();});
}
// 相隔多周时按“每页一格”铺一条纸带滑过去，避免看起来只翻了一页。
function playWeekJump(stage,from,to,onDone){
  const distance=Math.abs(to-from),direction=to>from?1:-1;
  if(distance<2||!stage||!stage.animate)return false;
  const width=Math.max(1,stage.clientWidth),maxPages=12,weeks=[];
  // 纸带里的周次始终升序：向后跳（周数变大）就整条向左滑，向前跳（周数变小）整条向右滑，
  // 这样第 15 周跳回第 8 周是“往右回退”，和翻页方向一致。
  if(distance+1<=maxPages){for(let w=Math.min(from,to);w<=Math.max(from,to);w++)weeks.push(w);}
  else if(direction>0){for(let w=to-maxPages+1;w<=to;w++)weeks.push(w);}
  else{for(let w=to;w<=to+maxPages-1;w++)weeks.push(w);}
  const track=document.createElement('div');
  track.className='week-track';
  track.style.width=(weeks.length*width)+'px';
  weeks.forEach((week,i)=>{
    const el=document.createElement('div');
    el.className='week-page week-track-page';
    el.dataset.week=String(week);
    el.setAttribute('aria-hidden','true');
    el.inert=true;
    el.innerHTML=renderTimetable(week);
    el.style.position='absolute';el.style.top='0';el.style.left=(i*width)+'px';el.style.width=width+'px';
    track.appendChild(el);
  });
  const staticPage=stage.querySelector('.week-page:not(.week-track-page)');
  if(staticPage)staticPage.style.visibility='hidden';
  stage.appendChild(track);
  const span=(weeks.length-1)*width;
  const duration=Math.round(Math.min(920,240+120*Math.min(distance,8)));
  const frames=direction>0
    ?[{transform:'translateX(0)'},{transform:'translateX('+(-span)+'px)'}]
    :[{transform:'translateX('+(-span)+'px)'},{transform:'translateX(0)'}];
  const anim=track.animate(frames,{duration,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});
  const motion={animations:[anim],cleanup:()=>{track.remove();if(staticPage)staticPage.style.visibility='';}};
  weekMotion=motion;
  anim.finished.then(()=>{if(weekMotion!==motion)return;weekMotion=null;motion.cleanup();anim.cancel();if(onDone)onDone();}).catch(()=>{});
  return true;
}
function navigateToWeek(next,{offset=0,focusToday=false}={}){
  next=Math.max(1,Math.min(T().totalWeeks,next));
  if(next===viewWeek){if(focusToday)focusTodayCourses();return false;}
  stopWeekMotion();
  const from=viewWeek,direction=next>viewWeek?1:-1,oldPage=$('.week-stage>.week-page:not(.week-preview)'),scrollTop=$('#content').scrollTop;
  viewWeek=next;render();$('#content').scrollTop=scrollTop;haptic('tick');
  const stage=$('.week-stage'),page=stage&&stage.querySelector('.week-page');
  showWeekFeedback(next,false,focusToday?'今天':'');
  if(!reducedMotion()&&playWeekJump(stage,from,next,focusToday?focusTodayCourses:null))return true;
  if(oldPage){oldPage.classList.add('week-outgoing');oldPage.setAttribute('aria-hidden','true');oldPage.inert=true;stage.appendChild(oldPage);}
  animateWeekPages(stage,page,oldPage,direction,offset,true,focusToday?focusTodayCourses:null);
  return true;
}
function changeWeek(delta,offset=0){return navigateToWeek(viewWeek+delta,{offset});}
function resetWeekDrag(stage,direction,offset){
  const page=stage.querySelector('.week-page:not(.week-preview)'),preview=stage.querySelector('.week-preview');
  animateWeekPages(stage,page,preview,direction,offset,false);showWeekFeedback(viewWeek);
}
let neighbourCache={week:0,prev:null,next:null};
function buildNeighbourPage(target){
  const el=document.createElement('div');
  el.className='week-page week-preview';
  el.dataset.week=String(target);
  el.setAttribute('aria-hidden','true');
  el.inert=true;
  el.innerHTML=renderTimetable(target);
  return el;
}
// 空闲时先把左右相邻的两周渲染好，拖动开始时就不用现建 DOM，第一帧不会卡一下。
function primeNeighbours(){
  const week=viewWeek,total=T().totalWeeks;
  if(neighbourCache.week===week&&(neighbourCache.prev||neighbourCache.next))return;
  const build=()=>{
    if(week!==viewWeek||tab!=='schedule'||weekMotion)return;
    neighbourCache={week,prev:week>1?buildNeighbourPage(week-1):null,next:week<total?buildNeighbourPage(week+1):null};
  };
  if(window.requestIdleCallback)requestIdleCallback(build,{timeout:600});else setTimeout(build,0);
}
function takeNeighbourPage(target){
  const c=neighbourCache;
  if(c.week===viewWeek){
    if(target===c.week-1&&c.prev){const el=c.prev;c.prev=null;return el;}
    if(target===c.week+1&&c.next){const el=c.next;c.next=null;return el;}
  }
  if(target<1||target>T().totalWeeks)return null;
  return buildNeighbourPage(target);
}
// 拖动每一帧只改 transform：几何尺寸、节点引用都在手势开始时缓存好，
// 由 rAF 合并 pointermove，避免一次移动里反复读布局。
function paintWeekDrag(g,dx){
  const width=g.width,direction=dx<0?1:-1,target=g.week+direction;
  const valid=target>=1&&target<=g.totalWeeks;
  const offset=valid?Math.max(-width,Math.min(width,dx)):dx*.22;
  if(valid){
    if(g.previewWeek!==target){
      if(g.preview)g.preview.remove();
      g.preview=takeNeighbourPage(target);
      g.previewWeek=target;
      if(g.preview)g.stage.appendChild(g.preview);
    }
  }else if(g.preview){g.preview.remove();g.preview=null;g.previewWeek=null;}
  g.page.style.transform='translateX('+offset+'px)';
  if(g.preview)g.preview.style.transform='translateX('+(offset+direction*width)+'px)';
  g.offset=offset;g.direction=direction;
  const shown=valid?target:g.week;
  if(g.feedbackWeek!==shown){g.feedbackWeek=shown;showWeekFeedback(shown,true);}
  return g;
}
function focusTodayCourses(){
  if(tab!=='schedule')return;
  const now=new Date();
  // 回到今天时停在课表最上方：日期栏对齐滚动区顶部，第 1 节紧接其下，
  // 不再滚到“当前正在上的课”所在的中间位置。
  const content=$('#content'),stage=$('.week-stage');
  if(stage){
    // 顶栏浮在内容上面：日期栏要停在顶栏下沿；沉浸模式下顶栏收起，只让出状态栏。
    const pad=parseFloat(getComputedStyle(content).paddingTop)||0,safe=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top'))||0;
    const top=content.scrollTop+stage.getBoundingClientRect().top-content.getBoundingClientRect().top-(document.body.classList.contains('immersive')?safe:pad-2);
    content.scrollTo({top:Math.max(0,Math.round(top)),behavior:reducedMotion()?'auto':'smooth'});
  }
  const header=$('.day.today');if(header){header.classList.remove('today-focus');void header.offsetWidth;header.classList.add('today-focus');}
  const column=document.querySelector('.week-page:not(.week-track-page) .today-column');
  if(column){column.classList.remove('flash');void column.offsetWidth;column.classList.add('flash');}
  showWeekFeedback(viewWeek,false,'今天 '+(now.getMonth()+1)+'月'+now.getDate()+'日');
}
function jumpToToday(){
  if(!T().semesterConfigured){toast('请先设置开学日期，才能定位今天');semesterForm();return;}
  const week=currentWeek();if(week<1||week>T().totalWeeks){toast('今天不在当前学期内，请核对开学日期和教学周数');return;}
  stopWeekMotion();haptic('confirm');if(sample){sample=false;render();}
  navigateToWeek(week,{focusToday:true});
}
function bindWeekSwipe(){
  const timetable=$('.week-stage');if(!timetable)return;
  let gesture=null;
  timetable.addEventListener('pointerdown',e=>{
    const current=gesture;
    if(e.isPrimary===false){
      if(current){gesture=null;if(current.raf)cancelAnimationFrame(current.raf);resetWeekDrag(timetable,current.direction||1,current.offset||0);}
      return;
    }
    if((e.pointerType==='mouse'&&e.button!==0)||sheetActive()||e.target.closest('.empty-schedule,input,textarea,select'))return;
    stopWeekMotion();
    const page=timetable.querySelector('.week-page:not(.week-preview):not(.week-track-page)');
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),axis:null,offset:0,direction:1,lastDx:0,raf:0,feedbackWeek:null,
      stage:timetable,page,width:timetable.clientWidth+12,week:viewWeek,totalWeeks:T().totalWeeks,preview:null,previewWeek:null};
    if(page)page.classList.add('week-moving');
    primeNeighbours();
  },{passive:true});
  timetable.addEventListener('pointermove',e=>{
    const g=gesture;if(!g||e.pointerId!==g.id)return;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=12){
      if(Math.abs(dx)>Math.abs(dy)*1.4){g.axis='x';try{timetable.setPointerCapture(e.pointerId);}catch(_){}}
      else if(Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
    }
    if(!g.axis)return;
    g.lastDx=dx;
    if(!g.raf)g.raf=requestAnimationFrame(()=>{g.raf=0;if(gesture===g)paintWeekDrag(g,g.lastDx);});
  },{passive:true});
  timetable.addEventListener('pointerup',e=>{
    const g=gesture;if(!g||e.pointerId!==g.id)return;
    gesture=null;if(g.raf){cancelAnimationFrame(g.raf);g.raf=0;}
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(g.axis==='x')paintWeekDrag(g,dx);
    if(g.axis==='x'&&Math.abs(dx)>=20)suppressCourseClickUntil=Date.now()+400;
    if(tab!=='schedule'||sheetActive()||Math.abs(dx)<56||Math.abs(dx)<=Math.abs(dy)*1.5||performance.now()-g.time>1500){if(g.axis==='x')resetWeekDrag(timetable,g.direction,g.offset);return;}
    suppressCourseClickUntil=Date.now()+400;
    if(!changeWeek(dx<0?1:-1,g.offset)){resetWeekDrag(timetable,g.direction,g.offset);haptic('reject');toast(dx<0?'已经是本学期最后一周':'已经是第一周');}
  },{passive:true});
  timetable.addEventListener('pointercancel',()=>{
    const g=gesture;gesture=null;
    if(!g)return;if(g.raf)cancelAnimationFrame(g.raf);
    if(g.axis==='x')resetWeekDrag(timetable,g.direction,g.offset);
  },{passive:true});
}
function nextClass(){
  if(sample)return {title:'正在体验示例课表',sub:'所有课程均为演示，不会写入你的课表',tag:'PREVIEW'};
  if(!T().semesterConfigured)return {title:'先设好开学日期吧',sub:'设置后将自动切换教学周 · 作息时间也可以调整',tag:'去设置',action:'semester'};
  const now=new Date(),cw=currentWeek();if(cw<1||cw>T().totalWeeks)return {title:'当前不在本学期教学周',sub:'课表仍可翻阅，下个学期也可以继续使用',tag:'休息一下'};
  const day=(now.getDay()+6)%7+1,minutes=now.getHours()*60+now.getMinutes();
  const list=T().courses.filter(c=>c.weeks.includes(cw)).map(c=>{const t=T().times[c.start-1]?.slice(0,5);const start=t?(+t.slice(0,2)*60+(+t.slice(3))):null;return {...c,t,start};}).filter(c=>c.day>day||(c.day===day&&c.start!==null&&c.start>=minutes)).sort((a,b)=>a.day-b.day||a.start-b.start);
  if(!list.length)return {title:T().courses.length?'本周剩下的时间，自由安排':'还没有属于你的课程',sub:T().courses.length?'愿你在课业之外，也有自己的小宇宙':'从教务导入，或者手动添加第一门课',tag:'✧'};
  const c=list[0],when=c.day===day?'今天':c.day===day+1?'明天':'周'+['','一','二','三','四','五','六','日'][c.day];return {title:c.name,sub:when+' '+(c.t||'第'+c.start+'节')+' · '+(c.room||'地点待补充'),tag:'下一堂',action:'detail',id:c.id,day:c.day,startMin:c.start};
}
// “正在上”一栏的当前状态，按今天的作息逐节判断：
//   class —— 正在上某门课；
//   break —— 同一门连堂课两节之间的课间（如第 3、4 节之间那 5 分钟）；
//   gap   —— 两节之间的课间：上一节刚下课、下一节接着有课。上一节空着的话不算课间（比如午后第一节课前）。
// slots 是这段时间线上的各节（起止分钟），供进度条按节分段、在中间画出课间。
function nowStatus(){
  if(sample||!T().semesterConfigured)return null;
  const cw=currentWeek();if(cw<1||cw>T().totalWeeks)return null;
  const now=new Date(),day=(now.getDay()+6)%7+1,m=now.getHours()*60+now.getMinutes()+now.getSeconds()/60,times=T().times;
  const at=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
  const slot=p=>{const t=times[p-1];return t?{p,start:at(t.slice(0,5)),end:at(t.slice(6)),from:t.slice(0,5),to:t.slice(6,11)}:null;};
  const today=T().courses.filter(c=>c.day===day&&c.weeks.includes(cw));
  for(const c of today){
    const slots=[];for(let p=c.start;p<=c.end;p++){const x=slot(p);if(x)slots.push(x);}
    if(!slots.length)continue;
    const first=slots[0],last=slots[slots.length-1];
    if(m<first.start||m>=last.end)continue;
    const i=slots.findIndex((x,k)=>k<slots.length-1&&m>=x.end&&m<slots[k+1].start);
    // 正在上课时，这门课后面还有课间的话记下课间开始的时刻，用来倒数“距课间”
    const k=slots.findIndex(x=>m>=x.start&&m<x.end),breakStart=i<0&&k>=0&&k<slots.length-1&&slots[k+1].start>slots[k].end?slots[k].end:null;
    return {kind:i<0?'class':'break',course:c,slots,from:first.from,to:last.to,start:first.start,end:last.end,resume:i<0?null:slots[i+1],breakStart};
  }
  for(let p=1;p<times.length;p++){
    const a=slot(p),b=slot(p+1);if(!a||!b||m<a.end||m>=b.start)continue;
    const next=today.find(c=>c.start===p+1),prev=today.find(c=>c.start<=p&&c.end>=p);if(!next||!prev)return null;
    return {kind:'gap',course:next,prev,slots:[a,b],start:a.start,end:b.end,resume:b};
  }
  return null;
}
// 倒计时文案：下一堂显示还有多久上课，正在上显示还有多久下课，课间显示还有多久上课。
function countdownLabel(minutes,kind){
  if(minutes==null||!isFinite(minutes))return '';
  if(kind==='now')return minutes<=1?'即将下课':'还剩 '+minutes+' 分钟';
  if(kind==='break')return minutes<=1?'马上上课':'还剩 '+minutes+' 分钟';
  if(kind==='tobreak')return minutes<=1?'马上课间':'距课间 '+minutes+' 分钟';
  return minutes<=1?'马上开始':minutes+' 分钟后';
}
// 右上角的胶囊：上课时倒数到下一个课间（这门课已没有课间就倒数到下课），课间时倒数到继续上课。
function statusCount(st,nowMin){if(st.kind!=='class')return countdownLabel(st.resume.start-nowMin,'break');return st.breakStart!=null?countdownLabel(st.breakStart-nowMin,'tobreak'):countdownLabel(st.end-nowMin,'now');}
// 胶囊上方的小字：连堂课里离整门课下课还有多久；胶囊本身已经在倒数下课时不显示。
function statusTotal(st,nowMin){return st.kind==='break'||(st.kind==='class'&&st.breakStart!=null)?'距下课 '+(st.end-nowMin)+' 分钟':'';}
// 时间线由“节、课间、节……”几段组成。节按真实分钟数占宽；课间只有 5–10 分钟，按真实比例会窄到看不见，
// 所以至少占总长的 10%。进度也按同样的权重换算，白点的位置和画出来的分段始终对得上。
function timelinePieces(st){
  const total=st.end-st.start,pieces=[];
  st.slots.forEach((x,i)=>{
    if(i){const a=st.slots[i-1].end;pieces.push({gap:true,now:st.kind!=='class'&&x===st.resume,start:a,end:x.start,w:Math.max(x.start-a,total*.1)});}
    pieces.push({gap:false,start:x.start,end:x.end,w:x.end-x.start});
  });
  return pieces;
}
function statusProgress(st){
  const now=new Date(),m=now.getHours()*60+now.getMinutes()+now.getSeconds()/60,pieces=timelinePieces(st),sum=pieces.reduce((n,x)=>n+x.w,0);
  let pos=0;for(const x of pieces){if(m>=x.end){pos+=x.w;continue;}if(m>x.start)pos+=x.w*(m-x.start)/Math.max(1,x.end-x.start);break;}
  return (Math.max(0,Math.min(1,pos/sum))*100).toFixed(2)+'%';
}
function timelineHTML(st){
  const parts=timelinePieces(st).map(x=>'<span class="'+(x.gap?'tl-gap'+(x.now?' now':''):'tl-seg')+'" style="flex:'+x.w.toFixed(2)+'"></span>').join('');
  return '<span class="next-timeline'+(st.kind==='class'?'':' in-break')+'" aria-hidden="true" style="--p:'+statusProgress(st)+'"><span class="tl-track">'+parts+'</span><span class="tl-fill">'+parts+'</span><i class="tl-dot"></i></span>';
}
function statusSig(st,next){return (st?st.kind+':'+st.course.id+':'+st.end+':'+(st.resume?st.resume.p:'')+':'+(st.breakStart==null?'':st.breakStart):'')+'|'+(next.id||next.title)+'|'+(next.startMin==null?'':next.startMin);}
function nextBar(){
  const next=nextClass(),st=nowStatus();
  const now=new Date(),todayIdx=(now.getDay()+6)%7+1,nowMin=now.getHours()*60+now.getMinutes();
  const half=(cls,action,id,tag,title,sub,count,live,extra,total)=>'<div class="next-half '+cls+'"'+(action?' data-action="'+action+'" data-id="'+escapeHTML(id||'')+'" role="button" tabindex="0"':'')+'>'+
    (total?'<i class="next-total">'+escapeHTML(total)+'</i>':'')+'<span class="next-tag"><span class="next-label">'+(live?'<span class="live-dot'+(live==='break'?' break':'')+'"></span>':'')+escapeHTML(tag)+'</span>'+(count?'<i class="next-count">'+escapeHTML(count)+'</i>':'')+'</span><strong>'+escapeHTML(title)+'</strong><small>'+escapeHTML(sub)+'</small>'+(extra||'')+'</div>';
  let cls='next-now',tag='正在上',title,sub,action='',id='',count='',live='',extra='',total='';
  if(st){
    const c=st.course,room=c.room||'地点待补充';action='detail';id=c.id;count=statusCount(st,nowMin);total=statusTotal(st,nowMin);extra=timelineHTML(st);
    if(st.kind==='class'){title=c.name;sub=st.from+'–'+st.to+' · '+room;live='class';}
    else if(st.kind==='break'){cls+=' resting';tag='课间';title=c.name;sub='第 '+st.resume.p+' 节 '+st.resume.from+' 继续 · '+room;live='break';}
    else{cls+=' resting';tag='课间';title='课间休息';sub=st.prev.name+' 已下课';live='break';}
  }else if(sample){cls+=' muted';title='示例课表';sub='示例模式下只预览样式';}
  else if(!T().semesterConfigured){cls+=' muted';title='尚未设置学期';sub='设置好开学日期后显示当前课程';}
  else{cls+=' muted';title='当前时段没有课';sub='可以休息一下';}
  const upCount=(next.day===todayIdx&&next.startMin!=null)?countdownLabel(next.startMin-nowMin,'up'):'';
  return '<div class="next-class" data-bar="'+escapeHTML(statusSig(st,next))+'">'+
    half('next-up',next.action,next.id,next.tag==='✧'?'下一堂':next.tag,next.title,next.sub,upCount)+
    half(cls,action,id,tag,title,sub,count,live,extra,total)+'</div>';
}
// 每 20 秒刷新一次倒计时；只有“正在上 / 课间 / 下一堂”真的换了才整页重绘。
function tickNextBar(){
  if(tab!=='schedule')return;
  const bar=document.querySelector('.next-class');if(!bar)return;
  const next=nextClass(),st=nowStatus();
  if(statusSig(st,next)!==bar.dataset.bar){const top=$('#content').scrollTop;render();$('#content').scrollTop=top;return;}
  const now=new Date(),todayIdx=(now.getDay()+6)%7+1,nowMin=now.getHours()*60+now.getMinutes();
  const nowEl=bar.querySelector('.next-now .next-count'),upEl=bar.querySelector('.next-up .next-count');
  if(nowEl&&st)nowEl.textContent=statusCount(st,nowMin);
  const totalEl=bar.querySelector('.next-now .next-total');if(totalEl&&st)totalEl.textContent=statusTotal(st,nowMin);
  if(upEl&&next.day===todayIdx&&next.startMin!=null)upEl.textContent=countdownLabel(next.startMin-nowMin,'up');
  const line=bar.querySelector('.next-timeline');if(line&&st)line.style.setProperty('--p',statusProgress(st));
  updateNowLine();
}
// 当前时刻落在第几节（按节次折算的小数，课间停在两节交界处）；不在今天的作息范围内返回 null。
function nowRow(rows){
  const now=new Date(),m=now.getHours()*60+now.getMinutes()+now.getSeconds()/60,times=T().times,at=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
  for(let i=0;i<Math.min(rows,times.length);i++){const a=at(times[i].slice(0,5)),b=at(times[i].slice(6));if(m<a)return i?i:null;if(m<b)return i+(m-a)/(b-a);}
  return null;
}
function clockText(){const n=new Date();return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');}
function updateNowLine(){document.querySelectorAll('.now-line').forEach(el=>{const row=nowRow(Number(el.dataset.rows));el.hidden=row==null;if(row!=null)el.style.setProperty('--now-row',row.toFixed(4));el.querySelector('b').textContent=clockText();});}
function renderSchedule(){
  const s=T(),start=C.monday(C.parseDate(s.semesterStart));start.setDate(start.getDate()+(viewWeek-1)*7);const next=nextClass(),today=C.dateString(new Date());
  let html=sample?'<div class="notice demo">示例模式 · 不会改动你的课表<button class="text-button" data-action="exit-demo">退出示例</button></div>':'';
  html+='<div class="week-toolbar"><div class="month-label">'+(start.getMonth()+1)+'月 <small>'+start.getFullYear()+' · '+escapeHTML(state.settings.schoolName||'我的学期')+'</small></div><div class="week-switch"><button class="icon-button" data-action="prev-week" aria-label="上一周" '+(viewWeek===1?'disabled':'')+'>‹</button><button class="week-current" data-action="week-picker">第 '+viewWeek+' / '+s.totalWeeks+' 周<span class="caret" aria-hidden="true"></span></button><button class="icon-button" data-action="next-week" aria-label="下一周" '+(viewWeek===s.totalWeeks?'disabled':'')+'>›</button></div></div>';
  html+=nextBar();
  const weekCourses=visibleCourses().filter(c=>c.weeks.includes(viewWeek));
  html+='<div class="timetable-row"><button class="timetable-chip" data-action="switch-timetable"><span class="chip-icon">'+icon('calendar')+'</span><span class="chip-name">'+escapeHTML(s.name)+'</span><span class="caret" aria-hidden="true"></span></button>'+(state.timetables.length>1?'<span class="chip-count">共 '+state.timetables.length+' 张</span>':'')+'</div>';
  html+='<div class="week-stage" aria-label="第 '+viewWeek+' 周课表"><div class="week-page">'+renderTimetable(viewWeek)+'</div></div><div class="below-grid">'+(sample?'示例课程 · 仅用于展示装扮效果':weekCourses.length?'本周 '+weekCourses.length+' 项安排 · 点击课程查看详情':'本周暂无课程 · 可以切换教学周查看')+'</div>';
  return html;
}
function renderTimetable(week){
  const s=T(),start=C.monday(C.parseDate(s.semesterStart));start.setDate(start.getDate()+(week-1)*7);const today=C.dateString(new Date());
  let html='<div class="timetable"><div class="day-header"><span class="period-title">节次</span>';
  for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);html+='<div class="day '+(C.dateString(d)===today?'today':'')+'">'+['一','二','三','四','五','六','日'][i]+'<span>'+d.getDate()+'</span></div>';}
  html+='</div><div class="grid-body">';
  const weekCourses=visibleCourses().filter(c=>c.weeks.includes(week)),periods=Math.max(s.periods,...weekCourses.map(c=>c.end));
  for(let p=1;p<=periods;p++){const slot=s.times[p-1]||'',startsAt=slot.slice(0,5),endsAt=slot.slice(6),range=endsAt?startsAt+'–'+endsAt:startsAt;html+='<div class="period-label" style="grid-column:1;grid-row:'+p+'" title="第 '+p+' 节 '+escapeHTML(range)+'">'+p+'<span class="time-start">'+escapeHTML(startsAt)+'</span>'+(endsAt?'<span class="time-end">'+escapeHTML(endsAt)+'</span>':'')+'</div>';for(let d=1;d<=7;d++)html+='<div class="grid-cell" style="grid-column:'+(d+1)+';grid-row:'+p+'"></div>';}
  const todayCol=(()=>{for(let i=0;i<7;i++){const d=new Date(start);d.setDate(d.getDate()+i);if(C.dateString(d)===today)return i+1;}return 0;})();
  if(todayCol)html+='<div class="today-column" data-day="'+todayCol+'" style="grid-column:'+(todayCol+1)+';grid-row:1 / span '+periods+'"></div>';
  if(todayCol){const row=nowRow(periods);html+='<div class="now-line" aria-hidden="true" data-rows="'+periods+'" style="--now-row:'+(row==null?0:row.toFixed(4))+';--col:'+todayCol+'"'+(row==null?' hidden':'')+'><i></i><b>'+clockText()+'</b></div>';}
  for(let day=1;day<=7;day++){
    const list=weekCourses.filter(c=>c.day===day).sort((a,b)=>a.start-b.start),groups=[];
    for(const c of list){const last=groups[groups.length-1];if(last&&c.start<=last.end){last.items.push(c);last.end=Math.max(last.end,c.end);}else groups.push({start:c.start,end:c.end,items:[c]});}
    for(const group of groups){const c=group.items[0],multiple=group.items.length>1;html+='<button class="course-card color-'+c.color+(multiple?' overlap':'')+'" style="grid-column:'+(day+1)+';grid-row:'+group.start+' / '+(group.end+1)+'" data-action="'+(multiple?'conflict-detail':'detail')+'" data-id="'+escapeHTML(c.id)+'" data-ids="'+escapeHTML(group.items.map(c=>c.id).join(','))+'"><span class="course-name">'+escapeHTML(multiple?group.items.map(c=>c.name).join(' / '):c.name)+'</span><span class="course-room">'+escapeHTML(c.room||'地点待填')+'</span><span class="course-teacher">'+escapeHTML(c.teacher)+'</span>'+(multiple?'<b>'+group.items.length+' 门冲突</b>':'')+'</button>';}
  }
  html+='</div>';
  if(!sample&&!T().courses.length)html+='<div class="empty-schedule"><div class="empty-star">✧</div><h2>新学期，从这里开始</h2><p>把课程装进星光里。<br>导入教务课表，留出更多时间给喜欢的事。</p><button class="button full" data-action="tab" data-tab="import">'+icon('download')+'导入我的课表</button><button class="text-button" data-action="demo">先看看装扮效果 →</button></div>';
  html+='</div>';return html;
}
function renderImport(){return '<p class="eyebrow">A NEW SEMESTER</p><h1 class="page-title">装进一整个学期</h1><p class="subtitle">一次导入，每天安心出发。</p><div id="import-error"></div>'+(window.__rawSnapshot?'<button class="text-button" data-action="export-snapshot" style="margin:0 0 12px">导出上次识别的页面结构（用于适配）</button>':'')+'<div class="import-layout"><section class="import-hero"><div class="hero-icon">'+icon('school')+'</div><span class="badge">'+escapeHTML(C.schoolPreset(state.settings.schoolPreset).badge)+'</span><h2 style="margin-top:13px">从学校教务导入</h2><p>在学校官方页面登录，打开整学期个人课表，再识别并核对课程。账号和密码由你在学校页面输入。</p><div class="steps"><div class="step"><b>01 / 登录</b>学校教务网站</div><div class="step"><b>02 / 识别</b>整学期课表</div><div class="step"><b>03 / 核对</b>保存到本机</div></div><form id="school-form"><label class="field"><span>学校与教务系统</span><select id="school-preset">'+C.SCHOOL_PRESETS.map(p=>'<option value="'+p.id+'" '+(state.settings.schoolPreset===p.id?'selected':'')+'>'+escapeHTML(p.label)+'</option>').join('')+'</select></label><label class="field"><span>教务入口网址</span><input id="school-url" type="url" required maxlength="500" value="'+escapeHTML(state.settings.schoolUrl)+'" placeholder="https://学校教务网址"></label><button class="button full" type="submit">'+icon('school')+'打开学校网站</button></form><p class="hint">'+escapeHTML(C.schoolPreset(state.settings.schoolPreset).hint)+' 浏览器默认开启桌面模式，顶部按钮可切回手机模式；如需校园网，请先连接学校 VPN。</p></section><div><section class="panel"><div class="row"><span class="file-icon">'+icon('file')+'</span><div style="flex:1"><h3>从文件导入</h3><p>星屿 JSON 备份、CSV 或课表 HTML</p></div></div><p>没有网络也可以恢复备份。文件识别后会展示课程预览，不会立即覆盖现有课表。</p><button class="button secondary full" data-action="import-file">选择课表文件</button><button class="text-button" data-action="csv-help" style="margin-top:10px">查看 CSV 格式说明 →</button></section><section class="panel"><div class="row"><span class="file-icon">'+icon('plus')+'</span><div style="flex:1"><h3>手动添加课程</h3><p>支持单双周、不连续周次和跨节课程</p></div></div><p>识别不了的课程，也可以自己补齐。</p><button class="button ghost full" data-action="add">添加一门课</button></section></div></div>';}
function renderTheme(){return '<p class="eyebrow">YOUR LITTLE UNIVERSE</p><h1 class="page-title">让课表，也心动</h1><p class="subtitle">换一种颜色，收集一点上课的好心情。</p><div class="theme-layout"><div><div class="section-title">主题色调 <small>全部本地使用</small></div><div class="theme-options">'+[['starlight','星屿暮色','柔紫 · 像黄昏一样温柔'],['sakura','樱花来信','浅粉 · 轻轻落在这一页'],['night','银河漫游','深色 · 留一片星空']].map(([id,name,desc])=>'<button class="theme-option '+id+' '+(state.settings.theme===id?'selected':'')+'" data-action="theme" data-theme="'+id+'" aria-pressed="'+(state.settings.theme===id)+'"><div class="theme-sample"><div class="sample-grid"><i></i><i></i><i></i><i></i></div></div><strong>'+name+'</strong><small>'+desc+'</small></button>').join('')+'</div><section class="panel" style="margin-top:22px"><div class="row"><h3>课程卡片不透明度</h3><span class="badge" id="opacity-value">'+state.settings.cardOpacity+'%</span></div><div class="field slider" data-slider><input aria-label="课程卡片不透明度" type="range" id="card-opacity" min="35" max="100" value="'+state.settings.cardOpacity+'" style="--p:'+((state.settings.cardOpacity-35)/65*100).toFixed(1)+'%"></div><p class="hint">数值越大，文字越清晰；数值越小，背景越通透。</p></section><section class="panel"><div class="row"><h3>背景通透度</h3><span class="badge" id="clarity-value">'+state.settings.wallpaperClarity+'%</span></div><div class="field slider" data-slider><input aria-label="背景通透度" type="range" id="wallpaper-clarity" min="0" max="100" value="'+state.settings.wallpaperClarity+'" style="--p:'+state.settings.wallpaperClarity+'%"></div><p class="hint">数值越大，背景图片越清晰、颜色越饱满；数值越小，柔光越多、文字越醒目。浅色图片可以调高一些。</p></section><button class="button ghost full" data-action="theme-demo">'+icon('calendar')+'用示例课程预览</button></div><section class="panel"><div class="row"><h3>自定义背景</h3><span class="badge">自选图片</span></div><div class="wallpaper-preview" id="wallpaper-preview"></div><p>可从手机中选择喜欢的图片，图片仅在本地保存。</p><div class="button-group"><button class="button secondary" data-action="pick-background">'+icon('image')+'选择图片</button><button class="button ghost" data-action="builtin-background">恢复预置</button></div><button class="text-button" data-action="none-background" style="margin-top:13px">使用纯色背景</button><p class="hint">手机系统可能会自动调整相册图片方向。如背景方向不合适，请先在相册旋转后保存。</p></section></div>';}
// 设置页按 iOS 分组列表排：左侧彩色图标，右侧操作。
let starLit=false,starTaps=0,starTapAt=0;try{starLit=localStorage.getItem('xingyu-star-lit')==='1';}catch(_){}
const settingRow=(ico,tint,title,sub,action)=>'<div class="setting-row"><span class="row-icon tint-'+tint+'">'+icon(ico)+'</span><div><strong>'+title+'</strong><small>'+sub+'</small></div>'+action+'</div>';
function renderSettings(){const s=T();return '<p class="eyebrow">JUST YOUR TIMETABLE</p><h1 class="page-title">刚刚好的设置</h1><p class="subtitle">只留下课表需要的东西。</p><section class="panel list">'+
  settingRow('calendar','orange','学期与作息',(s.semesterConfigured?'开学日期 '+escapeHTML(s.semesterStart)+' · '+s.totalWeeks+' 周':'请设置本学期第一周的周一')+'<br>'+s.periods+' 节 / 天 · 当前使用'+(s.semesterConfigured?'自定':'示例')+'作息，请按校区校准','<button class="button secondary small" data-action="semester">编辑</button>')+
  settingRow('school','blue','我的学校',escapeHTML(state.settings.schoolName)+'<br>教务网址可在导入页面修改','<button class="text-button" data-action="school-name">修改</button>')+
  settingRow('layers','purple','我的课表','共 '+state.timetables.length+' 张 · 当前「'+escapeHTML(T().name)+'」<br>每张课表独立保存课程、学期与作息','<button class="text-button" data-action="switch-timetable">管理</button>')+
  settingRow('list','green','全部课程','已保存 '+T().courses.length+' 项安排 · 点击可编辑','<button class="text-button" data-action="all-courses">查看</button>')+
  '</section><div class="section-title">数据与备份</div><section class="panel list">'+
  settingRow('upload','indigo','导出本地备份','保存全部课表、学期和配色设置<br>自选背景图片需另行保留','<button class="button secondary small" data-action="export">导出</button>')+
  settingRow('download','teal','恢复备份 / 导入文件','确认预览后才会保存','<button class="text-button" data-action="import-file">选择文件</button>')+
  (undoAvailable?settingRow('undo','gray','撤销最近一次导入','恢复覆盖之前的课程与设置','<button class="text-button" data-action="undo-import">恢复</button>'):'')+
  settingRow('lock','red','清除教务登录状态','退出本应用内学校网站的登录','<button class="text-button" data-action="clear-session">清除</button>')+
  '</section><section class="panel"><div class="row"><button class="file-icon star-toggle'+(starLit?' lit':'')+'" data-action="star-lit" aria-pressed="'+starLit+'" aria-label="点亮星星">'+icon('star')+'</button><div style="flex:1"><h3>一个安静的课表</h3><p>无广告 · 无会员 · 无商城</p></div></div><p>课程保存在本机。应用不含广告、统计、支付或账号服务。只有你打开学校网站时，才需要网络连接。</p><button class="text-button" data-action="about">关于星屿课表与导入适配 →</button></section><div class="settings-footer"><button class="footer-star" data-action="meteor" aria-label="放一颗流星">✦</button>星屿课表 v'+escapeHTML(window.AppVersion||'')+'<br>愿每一个平常日，都有小小的期待<br><span class="footer-sign">创作者 · 暗物质鞭炮</span></div>';}
// 防误触滑块：只有按住圆钮才能拖动；点在轨道上、或从轨道上划过去滚动页面，都不会改数值。
// 原生滑块不接收触摸（pointer-events:none），由外层判断按下的位置是否落在圆钮附近；键盘仍可直接调节。
function bindSafeSlider(input){
  const box=input.parentElement,min=Number(input.min),max=Number(input.max),thumb=28;let drag=null;
  const thumbX=r=>r.left+thumb/2+(Number(input.value)-min)/(max-min)*(r.width-thumb);
  box.addEventListener('pointerdown',e=>{
    const r=input.getBoundingClientRect(),x=thumbX(r);
    if(Math.abs(e.clientX-x)>26||Math.abs(e.clientY-(r.top+r.height/2))>26)return;
    drag={id:e.pointerId,offset:e.clientX-x,step:Math.floor(Number(input.value)/10)};
    try{box.setPointerCapture(e.pointerId);}catch(_){}
    box.classList.add('dragging');haptic('tick');
  });
  box.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const r=input.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(e.clientX-drag.offset-r.left-thumb/2)/(r.width-thumb))),v=Math.round(min+ratio*(max-min));
    if(v===Number(input.value))return;
    input.value=v;input.dispatchEvent(new Event('input'));
    const step=Math.floor(v/10);if(step!==drag.step){drag.step=step;haptic('soft');}
  });
  const end=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;box.classList.remove('dragging');input.dispatchEvent(new Event('change'));};
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
}
function bindView(){
  document.querySelectorAll('[data-slider] input[type=range]').forEach(bindSafeSlider);
  if(tab==='schedule')bindWeekSwipe();
  const school=$('#school-form');if(school)school.onsubmit=e=>{e.preventDefault();const url=$('#school-url').value.trim();try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw 0;}catch(_){toast('请输入完整的学校教务网址');return;}if(!updateSettings({schoolUrl:url}))return;if(N)N.openSchool(url);else toast('教务网站导入请使用安卓安装包。浏览器预览支持文件导入。');};
  const preset=$('#school-preset');if(preset)preset.onchange=()=>{const p=C.schoolPreset(preset.value);if(updateSettings({schoolPreset:p.id,...(p.url?{schoolUrl:p.url}:{})}))render();};
  const slider=$('#card-opacity');if(slider){slider.oninput=()=>{$('#opacity-value').textContent=slider.value+'%';slider.style.setProperty('--p',((slider.value-35)/65*100).toFixed(1)+'%');document.documentElement.style.setProperty('--card-alpha',Number(slider.value)/100);};slider.onchange=()=>updateSettings({cardOpacity:Number(slider.value)});}
  const clarity=$('#wallpaper-clarity');if(clarity){clarity.oninput=()=>{$('#clarity-value').textContent=clarity.value+'%';clarity.style.setProperty('--p',clarity.value+'%');applyClarity(clarity.value);};clarity.onchange=()=>updateSettings({wallpaperClarity:Number(clarity.value)});}
  const target=$('#import-target');if(target)target.onchange=()=>{const box=$('#new-name-field');if(box)box.style.display=target.value==='new'?'':'none';};
  const preview=$('#wallpaper-preview');if(preview){const url=backgroundURL();if(url)preview.style.backgroundImage='url("'+url.replace(/["\\\n\r]/g,'')+'")';}
}
// 换主题的圆形展开边缘带一圈新主题色的光。星屿暮色和樱花来信都是浅色，只靠裁切几乎看不出变化，
// 有了这道光波才看得清新主题正从哪里铺开。光圈加在新页面里（View Transition 的新画面是实时的），
// 和裁切圆同步放大，外沿正好被裁掉，只留下向内的一圈。
// 换主题的圆形展开边缘带一圈新主题色的光。星屿暮色和樱花来信都是浅色，只靠裁切几乎看不出变化，
// 有了这道光波才看得清新主题正从哪里铺开。光圈加在新页面里（View Transition 的新画面是实时的），
// 和裁切圆同步放大，外沿正好被裁掉，只留下向内的一圈。
// 光圈只在一张 256×256 的小 canvas 上画一次，再交给合成器整体放大：画布是现成的纹理，放大不用重新光栅化。
// 以前直接用和屏幕对角线一样大的渐变元素，手机上一次要光栅化上百块图块。柔和的光放大后看不出糊。
function themeWave(x,y,radius,duration,easing){
  const wave=document.createElement('canvas'),ctx=wave.getContext('2d'),size=256;if(!ctx)return;
  wave.width=wave.height=size;wave.className='theme-wave';wave.setAttribute('aria-hidden','true');
  const css=getComputedStyle(document.body),c=size/2,g=ctx.createRadialGradient(c,c,0,c,c,c);
  [[0,'transparent'],[.64,'transparent'],[.8,css.getPropertyValue('--accent-wash')],[.92,css.getPropertyValue('--accent-glow')],[.985,css.getPropertyValue('--accent-ring')],[1,'transparent']].forEach(([o,v])=>g.addColorStop(o,v.trim()||'transparent'));
  ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
  Object.assign(wave.style,{left:(x-radius)+'px',top:(y-radius)+'px',width:radius*2+'px',height:radius*2+'px'});
  document.body.appendChild(wave);
  wave.animate([{transform:'scale(0)'},{transform:'scale(1)'}],{duration,easing,fill:'forwards'});
  wave.animate([{opacity:1},{opacity:1,offset:.5},{opacity:0}],{duration:duration+240,fill:'forwards'}).finished.then(()=>wave.remove(),()=>wave.remove());
}
// 星星点亮时向四周迸出一圈金色星屑
function starBurst(el){
  if(reducedMotion()||!el.animate)return;
  const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  for(let i=0;i<14;i++){
    const p=document.createElement('i'),a=Math.PI*2*i/14+Math.random()*.4,d=34+Math.random()*30,size=3+Math.random()*4;
    p.className='star-spark';Object.assign(p.style,{left:cx-size/2+'px',top:cy-size/2+'px',width:size+'px',height:size+'px'});document.body.appendChild(p);
    p.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+Math.cos(a)*d+'px,'+Math.sin(a)*d+'px) scale(.2)',opacity:0}],{duration:620+Math.random()*260,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'}).finished.then(()=>p.remove(),()=>p.remove());
  }
}
// 流星：每点一次底部星星，从它的位置向上抛出一颗，沿随机抛物线飞行，带渐细的彗尾、十字星芒和沿途星屑，
// 落下前在空中散成一小簇星光。全部画在一张全屏 canvas 上，没有流星时停止绘制并移除画布。
const meteorSky={canvas:null,ctx:null,items:[],sparks:[],raf:0,last:0,dpr:1};
// 深色主题用发光叠加的浅色；浅色主题上浅色几乎看不见，改用饱和色正常叠加
const METEOR_COLORS={dark:['255,214,120','196,176,255','150,210,255','255,172,214','255,255,255'],light:['124,92,255','255,128,48','255,72,140','40,150,255','245,170,0']};
function launchMeteor(from){
  if(reducedMotion())return;
  const sky=meteorSky;
  if(!sky.canvas){const c=document.createElement('canvas');c.className='meteor-sky';c.setAttribute('aria-hidden','true');document.body.appendChild(c);sky.canvas=c;sky.ctx=c.getContext('2d');if(!sky.ctx){c.remove();sky.canvas=null;return;}}
  const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
  if(sky.canvas.width!==w||sky.canvas.height!==h){sky.canvas.width=w;sky.canvas.height=h;}sky.dpr=dpr;
  const r=from.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,g=1300+Math.random()*500;
  const rise=Math.max(160,Math.min(y-60,220+Math.random()*420)),vy=-Math.sqrt(2*g*rise),vx=(Math.random()*2-1)*(120+Math.random()*220);
  const palette=METEOR_COLORS[state.settings.theme==='night'?'dark':'light'],color=palette[Math.floor(Math.random()*palette.length)];
  sky.glow=state.settings.theme==='night';
  sky.items.push({x,y,vx,vy,g,age:0,life:.9+Math.random()*.7,trail:[],color,size:3+Math.random()*2,spin:Math.random()*Math.PI});
  // 出手时在星星处先迸一小团星屑
  for(let i=0;i<10;i++){const a=-Math.PI/2+(Math.random()-.5)*2.2,v=60+Math.random()*140;sky.sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color:i%2?color:'255,255,255',life:.35+Math.random()*.35,size:.8+Math.random()*1.4,age:0});}
  if(!sky.raf){sky.last=performance.now();sky.raf=requestAnimationFrame(stepMeteors);}
}
function stepMeteors(now){
  const sky=meteorSky,ctx=sky.ctx,dt=Math.min(.034,(now-sky.last)/1000),W=innerWidth,H=innerHeight;sky.last=now;
  ctx.setTransform(sky.dpr,0,0,sky.dpr,0,0);ctx.clearRect(0,0,W,H);ctx.globalCompositeOperation=sky.glow?'lighter':'source-over';ctx.lineCap='round';
  const sparkle=(x,y,vx,vy,color,life,size)=>sky.sparks.push({x,y,vx,vy,color,life,size,age:0});
  sky.items=sky.items.filter(m=>{
    m.age+=dt;m.vy+=m.g*dt;m.x+=m.vx*dt;m.y+=m.vy*dt;m.spin+=dt*4;
    m.trail.push([m.x,m.y]);if(m.trail.length>30)m.trail.shift();
    const fade=Math.max(0,Math.min(1,(m.life-m.age)/(m.life*.35)));
    for(let i=1;i<m.trail.length;i++){const k=i/m.trail.length;ctx.strokeStyle='rgba('+m.color+','+(k*k*.85*fade)+')';ctx.lineWidth=m.size*2.6*k;ctx.beginPath();ctx.moveTo(m.trail[i-1][0],m.trail[i-1][1]);ctx.lineTo(m.trail[i][0],m.trail[i][1]);ctx.stroke();}
    const R=m.size*7,glow=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,R);
    glow.addColorStop(0,'rgba(255,255,255,'+fade+')');glow.addColorStop(.16,'rgba(255,255,255,'+(.9*fade)+')');glow.addColorStop(.3,'rgba('+m.color+','+(.85*fade)+')');glow.addColorStop(1,'rgba('+m.color+',0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(m.x,m.y,R,0,Math.PI*2);ctx.fill();
    // 十字星芒，慢慢旋转
    ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.spin);ctx.strokeStyle=sky.glow?'rgba(255,255,255,'+(.55*fade)+')':'rgba('+m.color+','+(.6*fade)+')';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-R*1.3,0);ctx.lineTo(R*1.3,0);ctx.moveTo(0,-R*1.3);ctx.lineTo(0,R*1.3);ctx.stroke();ctx.restore();
    if(Math.random()<.8)sparkle(m.x,m.y,(Math.random()-.5)*70-m.vx*.06,(Math.random()-.5)*70-m.vy*.06,m.color,.4+Math.random()*.45,.6+Math.random()*1.3);
    const alive=m.age<m.life&&m.y<H+40&&m.x>-60&&m.x<W+60;
    if(!alive&&m.age>=m.life)for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,v=40+Math.random()*120;sparkle(m.x,m.y,Math.cos(a)*v+m.vx*.2,Math.sin(a)*v+m.vy*.2,i%3?m.color:'255,255,255',.5+Math.random()*.5,.8+Math.random()*1.4);}
    return alive;
  });
  sky.sparks=sky.sparks.filter(p=>{
    p.age+=dt;const a=1-p.age/p.life;if(a<=0)return false;
    p.vy+=240*dt;p.vx*=.985;p.x+=p.vx*dt;p.y+=p.vy*dt;
    ctx.fillStyle='rgba('+p.color+','+a+')';ctx.beginPath();ctx.arc(p.x,p.y,p.size*(.5+a*.7),0,Math.PI*2);ctx.fill();return true;
  });
  if(sky.items.length||sky.sparks.length)sky.raf=requestAnimationFrame(stepMeteors);
  else{sky.raf=0;sky.canvas.remove();sky.canvas=null;sky.ctx=null;}
}
// 系统栏图标颜色：深色主题，或弹层打开、页面顶部压暗时，状态栏用白色图标。
function syncSystemBars(){try{if(N&&N.systemBars)N.systemBars(state.settings.theme==='night',document.documentElement.classList.contains('sheet-open'));}catch(_){}}
// 弹层从底部滑出，背后的页面同时缩小下沉；关闭时先滑下去再真正 close()。
let sheetMotion=null;
// 正在滑走的弹层已经算关闭：后面的页面这时就能滑动、点按。
function sheetActive(){const sheet=$('#sheet');return sheet.open&&!sheet.classList.contains('closing');}
function stopSheetMotion(){const sheet=$('#sheet');if(sheetMotion){const list=sheetMotion;sheetMotion=null;list.forEach(a=>a.cancel());}sheet.classList.remove('closing');document.documentElement.classList.remove('sheet-fading');sheet.style.transform='';}
function showSheet(title,html){
  const sheet=$('#sheet'),wasClosing=sheet.classList.contains('closing'),animate=!reducedMotion()&&!!sheet.animate;
  stopSheetMotion();
  if(wasClosing)sheet.close();
  const swap=sheet.open;
  $('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;
  document.documentElement.classList.add('sheet-open','sheet-lowfx');syncSystemBars();
  if(!sheet.open){
    sheet.showModal();
    if(animate){sheet.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:540,easing:EASE_IOS});try{sheet.animate([{opacity:0},{opacity:1}],{duration:380,easing:'ease-out',pseudoElement:'::backdrop'});}catch(_){}}
  }else if(swap&&animate)$('#sheet-body').animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:340,easing:EASE_IOS});
  sheet.scrollTop=0;
}
function closeSheet(){
  const sheet=$('#sheet');if(!sheetActive())return;
  document.documentElement.classList.remove('sheet-open');syncSystemBars();
  if(reducedMotion()||!sheet.animate){sheet.style.transform='';sheet.close();document.documentElement.classList.remove('sheet-lowfx');return;}
  // 换成非模态再播放滑出：模态弹层会让整页 inert，滑走的 0.4 秒里点不动、划不动。
  // 非模态没有 ::backdrop，暗色遮罩改由 html.sheet-fading 的伪元素淡出。
  const from=sheet.style.transform||'translateY(0)',scroll=sheet.scrollTop;
  sheet.classList.add('closing');sheet.close();sheet.show();sheet.scrollTop=scroll;
  if(sheet.contains(document.activeElement))document.activeElement.blur();
  document.documentElement.classList.add('sheet-fading');
  const motion=[sheet.animate([{transform:from},{transform:'translateY(100%)'}],{duration:400,easing:EASE_IOS,fill:'forwards'})];
  sheetMotion=motion;
  motion[0].finished.then(()=>{if(sheetMotion!==motion)return;sheetMotion=null;sheet.classList.remove('closing');document.documentElement.classList.remove('sheet-fading','sheet-lowfx');sheet.style.transform='';sheet.close();motion.forEach(a=>a.cancel());}).catch(()=>{});
}
function detail(id){const c=visibleCourses().find(c=>c.id===id);if(!c)return;showSheet(sample?'示例课程':'课程详情','<span class="badge">'+(sample?'示例 · 不会保存':'已保存到本机')+'</span><h3 class="detail-title">'+escapeHTML(c.name)+'</h3>'+[['时间','周'+['','一','二','三','四','五','六','日'][c.day]+' · 第 '+c.start+'–'+c.end+' 节'],['周次',C.weekLabel(c.weeks)+' 周'],['地点',c.room||'未填写'],['教师',c.teacher||'未填写']].map(([a,b])=>'<div class="detail-item"><span>'+a+'</span><span>'+escapeHTML(b)+'</span></div>').join('')+(c.note?'<p class="detail-note">'+escapeHTML(c.note)+'</p>':'')+(!sample?'<div class="button-group" style="margin-top:24px"><button class="button secondary" data-action="edit" data-id="'+escapeHTML(c.id)+'">编辑课程</button><button class="button danger" data-action="delete" data-id="'+escapeHTML(c.id)+'">删除</button></div>':''));}
function courseForm(id){if(sample){toast('请退出示例模式后再编辑自己的课表');return;}const c=T().courses.find(c=>c.id===id)||{name:'',teacher:'',room:'',day:1,start:1,end:2,weeks:'1-'+T().totalWeeks,color:'lavender',note:''};courseColor=c.color;
  showSheet(id?'编辑课程':'添加一门课','<form id="course-form"><label class="field"><span>课程名称 *</span><input name="name" required maxlength="100" value="'+escapeHTML(c.name)+'" placeholder="比如：高等数学"></label><div class="field-row"><label class="field"><span>教师</span><input name="teacher" maxlength="100" value="'+escapeHTML(c.teacher)+'" placeholder="选填"></label><label class="field"><span>教室 / 地点</span><input name="room" maxlength="100" value="'+escapeHTML(c.room)+'" placeholder="选填"></label></div><div class="field-row triple"><label class="field"><span>星期</span><select name="day">'+['一','二','三','四','五','六','日'].map((d,i)=>'<option value="'+(i+1)+'" '+(c.day===i+1?'selected':'')+'>周'+d+'</option>').join('')+'</select></label><label class="field"><span>开始节次</span><input name="start" type="number" min="1" max="24" required value="'+c.start+'"></label><label class="field"><span>结束节次</span><input name="end" type="number" min="1" max="24" required value="'+c.end+'"></label></div><label class="field"><span>周次 *</span><input name="weeks" required maxlength="150" value="'+escapeHTML(Array.isArray(c.weeks)?C.weekLabel(c.weeks):c.weeks)+'" placeholder="1-16 或 1-16单周 或 1-8,10-16"></label><p class="hint">支持不连续周次、单周、双周；同一课程的不同上课时间请分别添加。</p><label class="field"><span>备注</span><textarea name="note" maxlength="500" placeholder="选填">'+escapeHTML(c.note)+'</textarea></label><label class="field"><span>课程颜色</span></label><div class="color-options">'+[['lavender','薰衣草紫'],['rose','玫瑰粉'],['mint','薄荷绿'],['sky','天空蓝'],['peach','蜜桃橙'],['lemon','柠檬黄']].map(([color,label])=>'<button type="button" aria-label="'+label+'" aria-pressed="'+(c.color===color)+'" class="color-swatch '+color+' '+(c.color===color?'selected':'')+'" data-action="course-color" data-color="'+color+'"></button>').join('')+'</div><div id="course-error"></div><button class="button full" type="submit">保存课程</button></form>');
  $('#course-form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));const item=C.validateCourse({...values,id:id||C.uid(),color:courseColor});const next=T().courses.filter(x=>x.id!==item.id).concat(item);const overlap=C.conflicts(next).filter(s=>s.includes(item.name));if(persistTimetable({courses:next})){closeSheet();render();toast(overlap.length?'已保存；有时间冲突，课表中已标记':'课程已保存');}}catch(err){$('#course-error').innerHTML='<div class="notice error">'+escapeHTML(err.message)+'</div>';}};
}
function semesterForm(){const s=T();showSheet('学期与作息 · '+s.name,'<form id="semester-form"><label class="field"><span>本学期第一周的周一 *</span><input type="date" name="semesterStart" required value="'+s.semesterStart+'"></label><div class="field-row"><label class="field"><span>总教学周数</span><input type="number" name="totalWeeks" min="1" max="40" required value="'+s.totalWeeks+'"></label><label class="field"><span>每天节次数</span><input type="number" name="periods" min="1" max="24" required value="'+s.periods+'"></label></div><label class="field"><span>作息表：每行一节，格式为 08:00-08:45 *</span><textarea name="times" rows="8" required spellcheck="false">'+escapeHTML(s.times.join('\n'))+'</textarea></label><p class="hint">首次提供的是示例作息，请按你所在校区的实际作息修改。导入课程的“节次”会对应这里的时间。</p><div id="semester-error"></div><button type="submit" class="button full">保存学期设置</button></form>');$('#semester-form').onsubmit=e=>{e.preventDefault();try{const f=Object.fromEntries(new FormData(e.target)),date=C.parseDate(f.semesterStart),totalWeeks=+f.totalWeeks,periods=+f.periods;if(date.getDay()!==1)throw new Error('请选择第一周的周一，避免教学周错位');if(!Number.isInteger(totalWeeks)||totalWeeks<1||totalWeeks>40||!Number.isInteger(periods)||periods<1||periods>24)throw new Error('教学周应为1–40，节次应为1–24');const times=f.times.split(/\n/).map(s=>s.trim()).filter(Boolean);if(times.length<periods||times.length>24||!times.every(C.validTimeRange))throw new Error('请为每一节填写有效的开始和结束时间（最多24行）');for(let i=1;i<times.length;i++)if(times[i].slice(0,5)<times[i-1].slice(6))throw new Error('相邻两节的作息时间有重叠，请检查第 '+(i+1)+' 行');if(persistTimetable({semesterStart:f.semesterStart,totalWeeks,periods,times,semesterConfigured:true})){viewWeek=Math.max(1,Math.min(totalWeeks,currentWeek()));closeSheet();render();toast('学期与作息已保存');}}catch(err){$('#semester-error').innerHTML='<div class="notice error">'+escapeHTML(err.message)+'</div>';}};}
function showWeekPicker(){showSheet('选择教学周','<p class="hint">'+(T().semesterConfigured?'点选任意一周，查看课程安排。':'请先在“设置”中核对开学日期。')+'</p><div class="week-grid">'+Array.from({length:T().totalWeeks},(_,i)=>'<button class="'+(viewWeek===i+1?'active ':'')+(currentWeek()===i+1?'current':'')+'" data-action="set-week" data-week="'+(i+1)+'">'+(i+1)+' 周</button>').join('')+'</div><button class="button secondary full" data-action="this-week">回到本周</button>');}
function confirmDialog(title,message,callback,label='确认'){showSheet(title,'<p class="subtitle" style="margin:10px 0 24px">'+escapeHTML(message)+'</p><div class="button-group"><button class="button ghost" data-action="close">取消</button><button class="button'+(/删除|清除/.test(label)?' destructive':'')+'" id="confirm-button">'+escapeHTML(label)+'</button></div>');$('#confirm-button').onclick=callback;}
function listCourses(courses,title){showSheet(title,'<div class="import-preview" style="max-height:65dvh">'+(courses.length?courses.map(c=>'<button class="preview-course" style="text-align:left;color:inherit" data-action="detail" data-id="'+escapeHTML(c.id)+'"><strong>'+escapeHTML(c.name)+'</strong><small>周'+WEEKDAYS[c.day]+' · 第 '+c.start+'–'+c.end+' 节 · '+escapeHTML(c.room||'地点未填')+'<br>'+escapeHTML(C.weekLabel(c.weeks))+' 周</small></button>').join(''):'<p class="subtitle">还没有课程，试着添加第一门吧。</p>')+'</div>');}
function switchTimetable(id){
  const t=state.timetables.find(x=>x.id===id);if(!t)return;
  if(!persist({...state,activeId:id}))return;
  sample=false;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));closeSheet();render();toast('已切换到「'+t.name+'」');
}
function timetableSheet(){
  const list=state.timetables.map(t=>'<div class="timetable-item'+(t.id===state.activeId?' active':'')+'"><button class="timetable-main" data-action="select-timetable" data-id="'+t.id+'"><strong>'+escapeHTML(t.name)+'</strong><small>'+(t.semesterConfigured?escapeHTML(t.semesterStart)+' 起 · '+t.totalWeeks+' 周':'未设置开学日期')+' · '+t.courses.length+' 项安排</small></button>'+(t.id===state.activeId?'<span class="badge">当前</span>':'')+'<div class="timetable-tools"><button class="text-button" data-action="rename-timetable" data-id="'+t.id+'">改名</button>'+(state.timetables.length>1?'<button class="text-button" data-action="delete-timetable" data-id="'+t.id+'">删除</button>':'')+'</div></div>').join('');
  showSheet('我的课表','<p class="hint">每张课表独立保存课程、学期和作息，切换或删除其中一张不会影响其他课表。共 '+state.timetables.length+' 张。</p><div class="timetable-list">'+list+'</div><button class="button full" data-action="new-timetable">'+icon('plus')+'新建一张课表</button>');
}
function newTimetableForm(){
  const suggested=uniqueTimetableName(C.semesterName(C.dateString(new Date())));
  showSheet('新建课表','<form id="new-timetable-form"><label class="field"><span>课表名称</span><input name="name" maxlength="40" required value="'+escapeHTML(suggested)+'" placeholder="比如：2027 春季学期"></label><p class="hint">会沿用当前的节次与作息，课程从空白开始；创建后可以到“设置 → 学期与作息”填写开学日期。</p><button type="submit" class="button full">创建并切换</button></form>');
  $('#new-timetable-form').onsubmit=e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name){toast('请填写课表名称');return;}const fresh=C.sanitizeTimetable({name,periods:T().periods,times:T().times,courses:[]},state.timetables.length);if(persist({...state,timetables:state.timetables.concat(fresh),activeId:fresh.id})){sample=false;viewWeek=1;closeSheet();render();toast('已新建「'+fresh.name+'」');}};
}
function renameTimetableForm(id){
  const t=state.timetables.find(x=>x.id===id);if(!t)return;
  showSheet('课表改名','<form id="rename-timetable-form"><label class="field"><span>课表名称</span><input name="name" maxlength="40" required value="'+escapeHTML(t.name)+'"></label><button type="submit" class="button full">保存</button></form>');
  $('#rename-timetable-form').onsubmit=e=>{e.preventDefault();const name=e.target.elements.name.value.trim();if(!name)return;if(persist({...state,timetables:state.timetables.map(x=>x.id===id?{...x,name}:x)})){closeSheet();render();timetableSheet();toast('已改名');}};
}
function deleteTimetable(id){
  const t=state.timetables.find(x=>x.id===id);if(!t)return;
  if(state.timetables.length<=1){toast('至少保留一张课表');return;}
  confirmDialog('删除这张课表？','「'+t.name+'」的 '+t.courses.length+' 项课程会一起删除，其他课表不受影响。',()=>{
    const list=state.timetables.filter(x=>x.id!==id),activeId=state.activeId===id?list[0].id:state.activeId;
    if(persist({...state,timetables:list,activeId})){sample=false;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));closeSheet();render();toast('已删除「'+t.name+'」');}
  },'删除');
}
function showImport(result){
  if(Array.isArray(result.timetables))return showBackupRestore(result);
  const courses=C.normalizeCourses(result.courses);if(!courses.length)throw new Error('文件中没有课程，不会改动现有课表');pendingImport={...result,courses};const overlap=C.conflicts(courses);
  const suggested=uniqueTimetableName((result.settings&&result.settings.semesterStart)?C.semesterName(result.settings.semesterStart):C.semesterName(C.dateString(new Date())));
  showSheet('核对导入结果','<div class="row" style="margin:10px 0"><strong style="font-size:19px">'+courses.length+' 项课程安排</strong><span class="badge">待你确认</span></div><p class="hint">请核对课程名、周次、节次和地点。下方确认后，才会将课表保存到本机。</p>'+((result.warnings||[]).length?'<div class="notice warning">有 '+result.warnings.length+' 项内容未能完整识别，请导入后手动补齐：<br>'+result.warnings.slice(0,6).map(escapeHTML).join('<br>')+'</div>':'')+(overlap.length?'<div class="notice warning">检测到 '+overlap.length+' 处课程时间冲突，课表中会显示冲突标记。</div>':'')+'<div class="import-preview">'+courses.map(c=>'<div class="preview-course"><strong>'+escapeHTML(c.name)+'</strong><small>周'+WEEKDAYS[c.day]+' · 第 '+c.start+'–'+c.end+' 节 · '+escapeHTML(c.room||'地点待补充')+'<br>'+escapeHTML(C.weekLabel(c.weeks))+' 周'+(c.teacher?' · '+escapeHTML(c.teacher):'')+'</small></div>').join('')+'</div><label class="field"><span>导入到哪张课表</span><select id="import-target"><option value="new">新建一张课表（保留现有课表）</option><option value="replace">替换当前课表（'+escapeHTML(T().name)+'）</option><option value="merge">合并到当前课表（'+escapeHTML(T().name)+'）</option></select></label><label class="field" id="new-name-field"><span>新课表名称</span><input id="new-timetable-name" maxlength="40" value="'+escapeHTML(suggested)+'"></label>'+(result.settings?'<label class="check-field"><input type="checkbox" id="restore-settings" checked>同时恢复文件中的学期与配色设置</label>':'')+'<p class="hint">'+(result.settings?'自选背景图片不包含在备份中，将使用预置背景。':'新建课表后，可以到“设置 → 学期与作息”填写开学日期和作息。')+'</p><button class="button full" data-action="confirm-import">确认并保存 '+courses.length+' 项安排</button>');
}
function showBackupRestore(result){
  const list=result.timetables,courses=list.reduce((n,t)=>n+t.courses.length,0);pendingImport={...result};
  showSheet('恢复整份备份','<div class="row" style="margin:10px 0"><strong style="font-size:19px">'+list.length+' 张课表 · '+courses+' 项安排</strong><span class="badge">待你确认</span></div><p class="hint">这份备份包含多张课表。恢复后会替换本机的全部课表与设置，导入前会自动保留一份可撤销的备份。</p><div class="import-preview">'+list.map(t=>'<div class="preview-course"><strong>'+escapeHTML(t.name)+'</strong><small>'+(t.semesterConfigured?escapeHTML(t.semesterStart)+' 起 · '+t.totalWeeks+' 周':'未设置开学日期')+' · '+t.courses.length+' 项安排</small></div>').join('')+'</div><button class="button full" data-action="confirm-restore">恢复这 '+list.length+' 张课表</button>');
}
function importError(message){if(tab==='import')$('#import-error').innerHTML='<div class="notice error">'+escapeHTML(message)+'</div>';else toast(message);}
window.receiveSchoolSnapshot=text=>{try{window.__rawSnapshot=text;showImport(C.parseSchoolSnapshot(JSON.parse(text)));}catch(e){window.__rawSnapshot=text;go('import');importError(e.message);}};
function snapshotFromHTML(html){const doc=new DOMParser().parseFromString(html,'text/html');return {tables:Array.from(doc.querySelectorAll('table')).map(table=>({rows:Array.from(table.rows).map(row=>({cells:Array.from(row.cells).map(cell=>C.cellSnapshot(doc,cell))}))}))};}
window.receiveImportFile=text=>{try{text=text.replace(/^\uFEFF/,'').trim();if(text.length>2*1024*1024)throw new Error('文件过大，请选择小于 2 MB 的课表文件');if(text.startsWith('{')||text.startsWith('[')){const data=JSON.parse(text);if(Array.isArray(data))showImport({courses:data});else if(Array.isArray(data.timetables)){const checked=C.sanitizeState(data);showImport({timetables:checked.timetables,settings:checked.settings,activeId:checked.activeId});}else if(Array.isArray(data.courses)){const checked=C.sanitizeState(data),first=checked.timetables[0];showImport({courses:first.courses,settings:data.settings?{...checked.settings,...pickSemester(first)}:null});}else throw new Error('不是星屿课表 JSON 格式，请使用 CSV、课表 HTML 或在教务页面识别');}else if(text.startsWith('<'))showImport(C.parseSchoolSnapshot(snapshotFromHTML(text)));else showImport({courses:C.parseCSV(text)});}catch(e){importError(e.message);}};
window.receiveBackground=()=>{customWallpaperURL='';appliedBackground='';if(updateSettings({background:'custom'})){render();toast('背景已更换，只保存在本机');}};
window.handleNativeBack=()=>{if(window.XingyuTennis&&window.XingyuTennis.isOpen()){window.XingyuTennis.close();return true;}if(sheetActive()){closeSheet();return true;}if(document.body.classList.contains('immersive')){setImmersive(false);return true;}if(tab!=='schedule'){go('schedule');return true;}if(sample){sample=false;render();return true;}return false;};
const actions={
  tab:b=>go(b.dataset.tab),add:()=>courseForm(),edit:b=>courseForm(b.dataset.id),close:closeSheet,detail:b=>detail(b.dataset.id),semester:semesterForm,today:jumpToToday,'switch-timetable':timetableSheet,timetable:timetableSheet,'select-timetable':b=>switchTimetable(b.dataset.id),'new-timetable':newTimetableForm,'rename-timetable':b=>renameTimetableForm(b.dataset.id),'delete-timetable':b=>deleteTimetable(b.dataset.id),
  'prev-week':()=>changeWeek(-1),'next-week':()=>changeWeek(1),'week-picker':showWeekPicker,'set-week':b=>{const next=+b.dataset.week;closeSheet();navigateToWeek(next);},'this-week':()=>{closeSheet();jumpToToday();},
  demo:()=>{sample=true;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));render();},'exit-demo':()=>{sample=false;render();},'theme-demo':()=>{sample=true;go('schedule');},theme:b=>{
    const next=b.dataset.theme;if(next===state.settings.theme)return;haptic('confirm');
    // 主题都在变量层切换，装扮页本身只需改选中的那张卡片，不用整页重建
    const apply=()=>{document.documentElement.classList.add('theme-switching');if(updateSettings({theme:next}))document.querySelectorAll('.theme-option').forEach(o=>{const on=o.dataset.theme===next;o.classList.toggle('selected',on);o.setAttribute('aria-pressed',on);});};
    if(reducedMotion()||!document.startViewTransition){apply();return;}
    // 新主题从点到的那张卡片处圆形展开
    const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y)),duration=900,easing='cubic-bezier(.45,.05,.25,1)';
    const vt=document.startViewTransition(apply);
    const done=()=>document.documentElement.classList.remove('theme-switching');vt.finished.then(done,done);
    vt.ready.then(()=>{
      document.documentElement.animate({clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+radius+'px at '+x+'px '+y+'px)']},{duration,easing,pseudoElement:'::view-transition-new(root)'});
      themeWave(x,y,radius,duration,easing);
    }).catch(()=>{});
  },'pick-background':()=>N?N.pickBackground():$('#browser-background').click(),'builtin-background':()=>{if(updateSettings({background:'builtin'}))render();},'none-background':()=>{if(updateSettings({background:'none'}))render();},
  'star-lit':b=>{
    starLit=!starLit;b.classList.toggle('lit',starLit);b.setAttribute('aria-pressed',starLit);
    try{localStorage.setItem('xingyu-star-lit',starLit?'1':'0');}catch(_){}
    haptic(starLit?'confirm':'tick');if(starLit)starBurst(b);
    // 隐藏彩蛋：连续点十次（每次间隔不超过 0.7 秒）打开星屿网球
    const now=Date.now();starTaps=now-starTapAt<700?starTaps+1:1;starTapAt=now;
    if(starTaps>=10&&window.XingyuTennis){
      const r=b.getBoundingClientRect();starTaps=0;
      window.XingyuTennis.open({from:{x:r.left+r.width/2,y:r.top+r.height/2,vw:innerWidth,vh:innerHeight},onExit:()=>{go('settings');}});
    }
  },
  meteor:b=>{haptic('soft');if(!reducedMotion()&&b.animate)b.animate([{transform:'scale(1)'},{transform:'scale(.82)',offset:.3},{transform:'scale(1.12)',offset:.7},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});launchMeteor(b);},
  'course-color':b=>{courseColor=b.dataset.color;haptic('tick');document.querySelectorAll('.color-swatch').forEach(el=>{const on=el.dataset.color===courseColor;el.classList.toggle('selected',on);el.setAttribute('aria-pressed',on);});},
  delete:b=>confirmDialog('删除这项课程安排？','删除后这项安排将从本学期的课表移除。如果只是改时间，可以选择编辑。',()=>{if(persistTimetable({courses:T().courses.filter(c=>c.id!==b.dataset.id)})){closeSheet();render();toast('课程已删除');}},'删除'),
  'conflict-detail':b=>listCourses(visibleCourses().filter(c=>b.dataset.ids.split(',').includes(c.id)),'同一时段的课程'),
  'all-courses':()=>listCourses(T().courses.slice().sort((a,b)=>a.day-b.day||a.start-b.start),'全部课程 · '+T().courses.length+' 项'),
  'import-file':()=>N?N.pickImportFile():$('#browser-import').click(),
  'export-snapshot':()=>{const raw=window.__rawSnapshot;if(!raw){toast('还没有可以导出的页面结构');return;}if(N)N.exportBackup(raw);else{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='页面结构.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}},
  'confirm-import':()=>{if(!pendingImport)return;try{
    const target=$('#import-target')?$('#import-target').value:'new',restore=$('#restore-settings')?.checked,imported=pendingImport,courses=imported.courses;
    if(!saveImportBackup())throw new Error('未能保存导入前备份，已停止覆盖');
    if(target==='new'){
      const name=($('#new-timetable-name')?.value||'').trim()||C.semesterName(C.dateString(new Date()));
      const seed={name,periods:T().periods,times:T().times,courses};if(restore&&imported.settings)Object.assign(seed,pickSemester(imported.settings));
      const fresh=C.sanitizeTimetable(seed,state.timetables.length);
      const settings=restore&&imported.settings?{...state.settings,...pickGlobal(imported.settings)}:state.settings;
      if(persist({...state,timetables:state.timetables.concat(fresh),activeId:fresh.id,settings})){
        undoAvailable=true;pendingImport=null;sample=false;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));closeSheet();go('schedule');toast('已新建「'+fresh.name+'」，原来的课表还在');
      }
      return;
    }
    const merge=target==='merge',next=C.normalizeCourses((merge?T().courses:[]).concat(courses));
    const patch={courses:next};if(restore&&imported.settings)Object.assign(patch,pickSemester(imported.settings));
    const settings=restore&&imported.settings?{...state.settings,...pickGlobal(imported.settings)}:state.settings;
    const timetables=state.timetables.map(t=>t.id===T().id?{...t,...patch}:t);
    if(persist({...state,timetables,settings})){
      undoAvailable=true;pendingImport=null;sample=false;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));closeSheet();go('schedule');toast('课表已保存，可在设置中撤销本次导入');
    }
  }catch(e){toast(e.message);}},
  'confirm-restore':()=>{if(!pendingImport)return;try{
    if(!saveImportBackup())throw new Error('未能保存导入前备份，已停止恢复');
    const next=C.sanitizeState({version:3,timetables:pendingImport.timetables,settings:pendingImport.settings||{},activeId:pendingImport.activeId});
    if(persist(next)){undoAvailable=true;sample=false;pendingImport=null;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));closeSheet();go('schedule');toast('已恢复 '+state.timetables.length+' 张课表');}
  }catch(e){toast(e.message);}},
'undo-import':()=>confirmDialog('恢复导入前的课表？','最近一次导入后的手动修改也会被恢复前的数据替代。',()=>{try{const previous=C.sanitizeState(JSON.parse(getBackup()));if(persist(previous)){sample=false;closeSheet();render();toast('已恢复导入前的课表');}}catch(_){toast('备份未能读取');}},'恢复'),
  export:()=>{const content=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2);if(N)N.exportBackup(content);else{const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='星屿课表-备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}},
  'clear-session':()=>confirmDialog('清除学校网站的登录状态？','下次导入时需要重新登录学校网站，已保存的课程不受影响。',()=>{if(N)N.clearSchoolSession();else toast('浏览器预览没有学校登录状态');closeSheet();},'清除'),
  'school-name':()=>{showSheet('我的学校','<form id="school-name-form"><label class="field"><span>学校名称</span><input name="name" maxlength="50" required value="'+escapeHTML(state.settings.schoolName)+'"></label><button type="submit" class="button full">保存</button></form>');$('#school-name-form').onsubmit=e=>{e.preventDefault();if(updateSettings({schoolName:e.target.elements.name.value.trim()})){closeSheet();render();}};},
  'csv-help':()=>showSheet('CSV 格式说明','<p class="subtitle">第一行为列名，推荐使用 UTF-8 编码。星期一到星期日对应 1–7。周次包含逗号时，请用英文双引号包住。</p><div class="notice" style="overflow:auto;white-space:pre;font-size:10px">课程名称,星期,开始节次,结束节次,周次,教室,教师\n高等数学,1,1,2,1-16,教三201,示例教师\n大学英语,2,3,4,"1-8,10-16",教二305,示例教师</div><p class="hint">可选列：备注。强智原始 JSON、WakeUp 的专有备份、Excel 文件目前不能直接导入；请转换成此格式，或在教务页面识别。</p>'),
  about:()=>showSheet('关于星屿课表','<h3 class="detail-title">星屿课表 <small style="font-size:12px">'+escapeHTML(window.AppVersion||'')+'</small></h3><p class="subtitle">独立制作的本地安卓课表。无广告、会员、商城、推广或统计服务。</p><div class="notice">仅需网络权限，用于打开你指定的教务网站；相册和文件通过系统选择器按次授权。</div><p class="subtitle">导入方式：在学校网站完成登录，打开整学期个人课表，再采集课程表格。按公开页面结构适配常见强智与正方教务课表；真实账号页面尚未全部实测，遇到页面变动可能需要继续适配。</p><p class="subtitle">课程、主题、自选背景和学校网站会话存储在本机。应用不会主动提取密码，也没有自建服务器。建议在分享备份前检查是否含有个人备注。卸载会清除应用内数据，请先导出备份。</p><p class="hint">网络可能需要校园网 / 学校 VPN。应用不绕过统一认证、验证码或双因子验证。默认背景为“神圣奶龙奔跑”图片，可在装扮中更换。</p>')
};
document.addEventListener('click',e=>{if(Date.now()<suppressCourseClickUntil&&e.target.closest('.timetable')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled&&actions[b.dataset.action])actions[b.dataset.action](b);});
// 沉浸阅读：点课表上的空白处收起顶部栏与底部导航，再点一次恢复。
function setImmersive(on){document.body.classList.toggle('immersive',!!on);haptic('soft');}
document.addEventListener('click',e=>{
  if(tab!=='schedule'||sheetActive())return;
  if(Date.now()<suppressCourseClickUntil)return;
  if(!$('#content')||!$('#content').contains(e.target))return;
  if(e.target.closest('[data-action],button,a,input,select,textarea,label,summary'))return;
  setImmersive(!document.body.classList.contains('immersive'));
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-action]')){e.preventDefault();e.target.click();}});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
$('#browser-import').onchange=async e=>{const file=e.target.files[0];if(file){if(file.size>2*1024*1024)importError('请选择小于 2 MB 的文件');else window.receiveImportFile(await file.text());}e.target.value='';};
$('#browser-background').onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>4*1024*1024){toast('浏览器预览请选择小于 4 MB 的图片');return;}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('xingyu-wallpaper',reader.result);window.receiveBackground();}catch(_){toast('浏览器存储空间不足');}};reader.readAsDataURL(file);e.target.value='';};
$('#sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
// 不论弹层以什么方式关掉，背后的页面都要恢复原样。
$('#sheet').addEventListener('close',()=>{if($('#sheet').open)return;document.documentElement.classList.remove('sheet-lowfx');if(document.documentElement.classList.contains('sheet-open')){document.documentElement.classList.remove('sheet-open');syncSystemBars();}});
// 按住弹层顶部往下拖可以关闭；拖得不够远或不够快就弹回去。
(()=>{
  const sheet=$('#sheet'),head=sheet.querySelector('.sheet-head');let drag=null;
  head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||sheet.classList.contains('closing'))return;drag={id:e.pointerId,y:e.clientY,lastY:e.clientY,lastT:performance.now(),v:0,dy:0};try{head.setPointerCapture(e.pointerId);}catch(_){}});
  head.addEventListener('pointermove',e=>{
    const d=drag;if(!d||e.pointerId!==d.id)return;const t=performance.now();
    d.v=(e.clientY-d.lastY)/Math.max(1,t-d.lastT);d.lastY=e.clientY;d.lastT=t;d.dy=Math.max(0,e.clientY-d.y);
    sheet.style.transform='translateY('+d.dy+'px)';
  });
  const end=e=>{
    const d=drag;if(!d||e.pointerId!==d.id)return;drag=null;
    if(d.dy>120||(d.dy>24&&d.v>.45)){haptic('soft');closeSheet();return;}
    const from=sheet.style.transform;sheet.style.transform='';
    if(from&&d.dy>0&&sheet.animate&&!reducedMotion())sheet.animate([{transform:from},{transform:'translateY(0)'}],{duration:480,easing:EASE_SPRING});
  };
  head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
})();
$('#content').addEventListener('scroll',()=>{if(!headerRaf)headerRaf=requestAnimationFrame(()=>{headerRaf=0;syncHeader();});},{passive:true});
render();revealContent();
// 每 20 秒刷新「下一堂 / 正在上」的倒计时
setInterval(tickNextBar,20000);
// 回到前台时立刻补一次：后台时定时器会被系统降频，解锁后不该先看到十几分钟前的数字
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickNextBar();});
