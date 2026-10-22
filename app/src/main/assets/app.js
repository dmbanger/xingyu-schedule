'use strict';
const C=ScheduleCore,$=s=>document.querySelector(s),N=window.Native;
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-3.7c-1-.6-.6-2.3.6-2.3H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7.5 10h.01M11 6.5h.01M16 8h.01M6.5 14h.01"/>',settings:'<path d="m9 3-.5 2.5-2 1.2L4 6l-2 3 2 2v2l-2 2 2 3 2.5-.7 2 1.2L9 21h5l.5-2.5 2-1.2 2.5.7 2-3-2-2v-2l2-2-2-3-2.5.7-2-1.2L14 3Z"/><circle cx="11.5" cy="12" r="3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',school:'<path d="m2 9 10-6 10 6-10 6L2 9Zm4 3v6c4 3 8 3 12 0v-6m4-3v9"/>',file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 14h8m-8 3h5"/>',star:'<path d="m12 2 2.8 6.1 6.7.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6L2.5 9l6.7-.9Z"/>',image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.star)+'</svg>';
let state=C.defaultState(),tab='schedule',sample=false,viewWeek=1,toastTimer,pendingImport=null,courseColor='lavender',undoAvailable=false,suppressCourseClickUntil=0;
const T=()=>state.timetables.find(t=>t.id===state.activeId)||state.timetables[0];
function uniqueTimetableName(base){let name=base,n=2;while(state.timetables.some(t=>t.name===name))name=base+' '+(n++);return name;}
function persistTimetable(patch){const cur=T(),next={...cur,...patch};return persist({...state,timetables:state.timetables.map(t=>t.id===next.id?next:t)});}
function pickSemester(s){const out={};for(const k of ['semesterStart','totalWeeks','periods','times','semesterConfigured'])if(s&&s[k]!==undefined)out[k]=s[k];return out;}
function pickGlobal(s){const out={};for(const k of ['schoolName','schoolUrl','schoolPreset','theme'])if(s&&typeof s[k]==='string')out[k]=s[k];if(s&&typeof s.cardOpacity==='number')out.cardOpacity=s.cardOpacity;out.background=s&&s.background==='none'?'none':'builtin';return out;}
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
function persist(next){try{next=C.sanitizeState(next);const text=JSON.stringify(next);if(N){if(!N.saveState(text))throw new Error('保存失败，请检查手机剩余空间');}else localStorage.setItem('xingyu-state',text);state=next;applyTheme();return true;}catch(e){toast(e.message||'未能保存');return false;}}
function updateSettings(patch){return persist({...state,settings:{...state.settings,...patch}});}
function getBackup(){try{return N?N.getImportBackup():localStorage.getItem('xingyu-before-import')||'';}catch(_){return '';}}
function saveImportBackup(){const text=JSON.stringify(state);if(N)return N.backupBeforeImport(text);localStorage.setItem('xingyu-before-import',text);return true;}
try{const text=N?N.getState():localStorage.getItem('xingyu-state');if(text)state=C.sanitizeState(JSON.parse(text));}catch(_){toast('保存的数据未能读取，请从备份恢复。');}
undoAvailable=!!getBackup();
function currentWeek(){return C.weekAt(T().semesterStart);}
viewWeek=Math.min(T().totalWeeks,Math.max(1,currentWeek()));
function backgroundURL(){if(state.settings.background==='none')return '';if(state.settings.background==='custom')return N?'https://appassets.androidplatform.net/wallpaper?v='+Date.now():localStorage.getItem('xingyu-wallpaper')||'';return 'wallpaper.png';}
function applyTheme(){document.body.dataset.theme=state.settings.theme;document.documentElement.style.setProperty('--card-alpha',state.settings.cardOpacity/100);const url=backgroundURL();$('#wallpaper').style.backgroundImage=url?'url("'+url.replace(/["\\\n\r]/g,'')+'")':'';}
function render(){stopWeekMotion();applyTheme();$('#today-button').hidden=tab!=='schedule';if(tab!=='schedule')$('#week-feedback').classList.remove('visible');$('#navigation').innerHTML=[['schedule','calendar','课表'],['import','download','导入'],['theme','palette','装扮'],['settings','settings','设置']].map(([id,ico,label])=>'<button class="nav-item '+(tab===id?'active':'')+'" data-action="tab" data-tab="'+id+'" aria-current="'+(tab===id?'page':'false')+'"><span class="nav-icon">'+icon(ico)+'</span>'+label+'</button>').join('');$('#content').innerHTML=({schedule:renderSchedule,import:renderImport,theme:renderTheme,settings:renderSettings}[tab])();bindView();}
function go(next){tab=next;render();$('#content').scrollTop=0;}
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
function navigateToWeek(next,{offset=0,focusToday=false}={}){
  next=Math.max(1,Math.min(T().totalWeeks,next));
  if(next===viewWeek){if(focusToday)focusTodayCourses();return false;}
  stopWeekMotion();
  const direction=next>viewWeek?1:-1,oldPage=$('.week-stage>.week-page:not(.week-preview)'),scrollTop=$('#content').scrollTop;
  viewWeek=next;render();$('#content').scrollTop=scrollTop;
  const stage=$('.week-stage'),page=stage.querySelector('.week-page');
  if(oldPage){oldPage.classList.add('week-outgoing');oldPage.setAttribute('aria-hidden','true');oldPage.inert=true;stage.appendChild(oldPage);}
  showWeekFeedback(next,false,focusToday?'今天':'');
  animateWeekPages(stage,page,oldPage,direction,offset,true,focusToday?focusTodayCourses:null);
  return true;
}
function changeWeek(delta,offset=0){return navigateToWeek(viewWeek+delta,{offset});}
function resetWeekDrag(stage,direction,offset){
  const page=stage.querySelector('.week-page:not(.week-preview)'),preview=stage.querySelector('.week-preview');
  animateWeekPages(stage,page,preview,direction,offset,false);showWeekFeedback(viewWeek);
}
function paintWeekDrag(stage,dx){
  const direction=dx<0?1:-1,target=viewWeek+direction,page=stage.querySelector('.week-page:not(.week-preview)'),width=stage.clientWidth+12;
  const valid=target>=1&&target<=T().totalWeeks,offset=valid?Math.max(-width,Math.min(width,dx)):dx*.22;
  let preview=stage.querySelector('.week-preview');
  if(valid&&preview?.dataset.week!==String(target)){
    preview?.remove();preview=document.createElement('div');preview.className='week-page week-preview';preview.dataset.week=target;preview.setAttribute('aria-hidden','true');preview.inert=true;preview.innerHTML=renderTimetable(target);stage.appendChild(preview);
  }else if(!valid){preview?.remove();preview=null;}
  page.style.transform='translateX('+offset+'px)';
  if(preview)preview.style.transform='translateX('+(offset+direction*width)+'px)';
  showWeekFeedback(valid?target:viewWeek,true);
  return {direction,offset};
}
function focusTodayCourses(){
  if(tab!=='schedule')return;
  const now=new Date(),day=(now.getDay()+6)%7+1,courses=T().courses.filter(c=>c.day===day&&c.weeks.includes(viewWeek)).sort((a,b)=>a.start-b.start);
  const minutes=now.getHours()*60+now.getMinutes();
  const next=courses.find(c=>{const end=T().times[c.end-1]?.slice(6);return end&&(+end.slice(0,2)*60+ +end.slice(3))>=minutes;})||courses[0];
  const target=next?Array.from(document.querySelectorAll('.week-stage>.week-page:not(.week-outgoing) .course-card')).find(n=>n.dataset.ids.split(',').includes(next.id)):$('.day.today');
  const content=$('#content'),top=target?content.scrollTop+target.getBoundingClientRect().top-content.getBoundingClientRect().top-46:0;
  content.scrollTo({top:Math.max(0,top),behavior:reducedMotion()?'auto':'smooth'});
  const header=$('.day.today');if(header){header.classList.remove('today-focus');void header.offsetWidth;header.classList.add('today-focus');}
  showWeekFeedback(viewWeek,false,'今天 '+(now.getMonth()+1)+'月'+now.getDate()+'日');
}
function jumpToToday(){
  if(!T().semesterConfigured){toast('请先设置开学日期，才能定位今天');semesterForm();return;}
  const week=currentWeek();if(week<1||week>T().totalWeeks){toast('今天不在当前学期内，请核对开学日期和教学周数');return;}
  stopWeekMotion();if(sample){sample=false;render();}
  navigateToWeek(week,{focusToday:true});
}
function bindWeekSwipe(){
  const timetable=$('.week-stage');if(!timetable)return;
  let gesture=null;
  timetable.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false){if(gesture)resetWeekDrag(timetable,gesture.direction||1,gesture.offset||0);gesture=null;return;}
    if((e.pointerType==='mouse'&&e.button!==0)||$('#sheet').open||e.target.closest('.empty-schedule,input,textarea,select'))return;
    stopWeekMotion();gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),axis:null,offset:0,direction:1};
  },{passive:true});
  timetable.addEventListener('pointermove',e=>{
    if(!gesture||e.pointerId!==gesture.id)return;
    const dx=Math.abs(e.clientX-gesture.x),dy=Math.abs(e.clientY-gesture.y);
    if(!gesture.axis&&Math.max(dx,dy)>=12){
      if(dx>dy*1.4){gesture.axis='x';try{timetable.setPointerCapture(e.pointerId);}catch(_) {}}
      else if(dy>dx){gesture=null;}
    }
    if(gesture?.axis==='x')Object.assign(gesture,paintWeekDrag(timetable,e.clientX-gesture.x));
  },{passive:true});
  timetable.addEventListener('pointerup',e=>{
    const start=gesture;gesture=null;if(!start||e.pointerId!==start.id)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(start.axis==='x'&&Math.abs(dx)>=20)suppressCourseClickUntil=Date.now()+400;
    if(tab!=='schedule'||$('#sheet').open||Math.abs(dx)<56||Math.abs(dx)<=Math.abs(dy)*1.5||performance.now()-start.time>1500){if(start.axis==='x')resetWeekDrag(timetable,start.direction,start.offset);return;}
    suppressCourseClickUntil=Date.now()+400;
    if(!changeWeek(dx<0?1:-1,start.offset)){resetWeekDrag(timetable,start.direction,start.offset);toast(dx<0?'已经是本学期最后一周':'已经是第一周');}
  },{passive:true});
  timetable.addEventListener('pointercancel',()=>{if(gesture?.axis==='x')resetWeekDrag(timetable,gesture.direction,gesture.offset);gesture=null;},{passive:true});
}
function nextClass(){
  if(sample)return {title:'正在体验示例课表',sub:'所有课程均为演示，不会写入你的课表',tag:'PREVIEW'};
  if(!T().semesterConfigured)return {title:'先设好开学日期吧',sub:'设置后将自动切换教学周 · 作息时间也可以调整',tag:'去设置',action:'semester'};
  const now=new Date(),cw=currentWeek();if(cw<1||cw>T().totalWeeks)return {title:'当前不在本学期教学周',sub:'课表仍可翻阅，下个学期也可以继续使用',tag:'休息一下'};
  const day=(now.getDay()+6)%7+1,minutes=now.getHours()*60+now.getMinutes();
  const list=T().courses.filter(c=>c.weeks.includes(cw)).map(c=>{const t=T().times[c.start-1]?.slice(0,5);const start=t?(+t.slice(0,2)*60+(+t.slice(3))):null;return {...c,t,start};}).filter(c=>c.day>day||(c.day===day&&c.start!==null&&c.start>=minutes)).sort((a,b)=>a.day-b.day||a.start-b.start);
  if(!list.length)return {title:T().courses.length?'本周剩下的时间，自由安排':'还没有属于你的课程',sub:T().courses.length?'愿你在课业之外，也有自己的小宇宙':'从教务导入，或者手动添加第一门课',tag:'✧'};
  const c=list[0],when=c.day===day?'今天':c.day===day+1?'明天':'周'+['','一','二','三','四','五','六','日'][c.day];return {title:c.name,sub:when+' '+(c.t||'第'+c.start+'节')+' · '+(c.room||'地点待补充'),tag:'下一堂',action:'detail',id:c.id};
}
function renderSchedule(){
  const s=T(),start=C.monday(C.parseDate(s.semesterStart));start.setDate(start.getDate()+(viewWeek-1)*7);const next=nextClass(),today=C.dateString(new Date());
  let html=sample?'<div class="notice demo">示例模式 · 不会改动你的课表<button class="text-button" data-action="exit-demo">退出示例</button></div>':'';
  html+='<div class="week-toolbar"><div class="month-label">'+(start.getMonth()+1)+'月 <small>'+start.getFullYear()+' · '+escapeHTML(state.settings.schoolName||'我的学期')+'</small></div><div class="week-switch"><button class="icon-button" data-action="prev-week" aria-label="上一周" '+(viewWeek===1?'disabled':'')+'>‹</button><button class="week-current" data-action="week-picker">第 '+viewWeek+' / '+s.totalWeeks+' 周 ⌄</button><button class="icon-button" data-action="next-week" aria-label="下一周" '+(viewWeek===s.totalWeeks?'disabled':'')+'>›</button></div></div>';
  html+='<div class="next-class" '+(next.action?'data-action="'+next.action+'" data-id="'+escapeHTML(next.id||'')+'" role="button" tabindex="0"':'')+'><span class="next-icon">'+icon('clock')+'</span><div class="next-text"><strong>'+escapeHTML(next.title)+'</strong><small>'+escapeHTML(next.sub)+'</small></div><span class="tag">'+escapeHTML(next.tag)+'</span></div>';
  const weekCourses=visibleCourses().filter(c=>c.weeks.includes(viewWeek));
  html+='<div class="timetable-row"><button class="timetable-chip" data-action="switch-timetable"><span class="chip-icon">'+icon('calendar')+'</span>'+escapeHTML(s.name)+'<span class="chip-caret">⌄</span></button>'+(state.timetables.length>1?'<span class="chip-count">共 '+state.timetables.length+' 张</span>':'')+'</div>';
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
  for(let day=1;day<=7;day++){
    const list=weekCourses.filter(c=>c.day===day).sort((a,b)=>a.start-b.start),groups=[];
    for(const c of list){const last=groups[groups.length-1];if(last&&c.start<=last.end){last.items.push(c);last.end=Math.max(last.end,c.end);}else groups.push({start:c.start,end:c.end,items:[c]});}
    for(const group of groups){const c=group.items[0],multiple=group.items.length>1;html+='<button class="course-card color-'+c.color+(multiple?' overlap':'')+'" style="grid-column:'+(day+1)+';grid-row:'+group.start+' / '+(group.end+1)+'" data-action="'+(multiple?'conflict-detail':'detail')+'" data-id="'+escapeHTML(c.id)+'" data-ids="'+escapeHTML(group.items.map(c=>c.id).join(','))+'"><span class="course-name">'+escapeHTML(multiple?group.items.map(c=>c.name).join(' / '):c.name)+'</span><span class="course-room">'+escapeHTML(c.room||'地点待填')+'</span><span class="course-teacher">'+escapeHTML(c.teacher)+'</span>'+(multiple?'<b>'+group.items.length+' 门冲突</b>':'')+'</button>';}
  }
  html+='</div>';
  if(!sample&&!T().courses.length)html+='<div class="empty-schedule"><div class="empty-star">✧</div><h2>新学期，从这里开始</h2><p>把课程装进星光里。<br>导入教务课表，留出更多时间给喜欢的事。</p><button class="button full" data-action="tab" data-tab="import">'+icon('download')+'导入我的课表</button><button class="text-button" data-action="demo">先看看装扮效果 →</button></div>';
  html+='</div>';return html;
}
function renderImport(){return '<p class="eyebrow">A NEW SEMESTER</p><h1 class="page-title">装进一整个学期</h1><p class="subtitle">一次导入，每天安心出发。</p><div id="import-error"></div><div class="import-layout"><section class="import-hero"><div class="hero-icon">'+icon('school')+'</div><span class="badge">'+escapeHTML(C.schoolPreset(state.settings.schoolPreset).badge)+'</span><h2 style="margin-top:13px">从学校教务导入</h2><p>在学校官方页面登录，打开整学期个人课表，再识别并核对课程。账号和密码由你在学校页面输入。</p><div class="steps"><div class="step"><b>01 / 登录</b>学校教务网站</div><div class="step"><b>02 / 识别</b>整学期课表</div><div class="step"><b>03 / 核对</b>保存到本机</div></div><form id="school-form"><label class="field"><span>学校与教务系统</span><select id="school-preset">'+C.SCHOOL_PRESETS.map(p=>'<option value="'+p.id+'" '+(state.settings.schoolPreset===p.id?'selected':'')+'>'+escapeHTML(p.label)+'</option>').join('')+'</select></label><label class="field"><span>教务入口网址</span><input id="school-url" type="url" required maxlength="500" value="'+escapeHTML(state.settings.schoolUrl)+'" placeholder="https://学校教务网址"></label><button class="button full" type="submit">'+icon('school')+'打开学校网站</button></form><p class="hint">'+escapeHTML(C.schoolPreset(state.settings.schoolPreset).hint)+' 浏览器默认开启桌面模式，顶部按钮可切回手机模式；如需校园网，请先连接学校 VPN。</p></section><div><section class="panel"><div class="row"><span class="file-icon">'+icon('file')+'</span><div style="flex:1"><h3>从文件导入</h3><p>星屿 JSON 备份、CSV 或课表 HTML</p></div></div><p>没有网络也可以恢复备份。文件识别后会展示课程预览，不会立即覆盖现有课表。</p><button class="button secondary full" data-action="import-file">选择课表文件</button><button class="text-button" data-action="csv-help" style="margin-top:10px">查看 CSV 格式说明 →</button></section><section class="panel"><div class="row"><span class="file-icon">'+icon('plus')+'</span><div style="flex:1"><h3>手动添加课程</h3><p>支持单双周、不连续周次和跨节课程</p></div></div><p>识别不了的课程，也可以自己补齐。</p><button class="button ghost full" data-action="add">添加一门课</button></section></div></div>';}
function renderTheme(){return '<p class="eyebrow">YOUR LITTLE UNIVERSE</p><h1 class="page-title">让课表，也心动</h1><p class="subtitle">换一种颜色，收集一点上课的好心情。</p><div class="theme-layout"><div><div class="section-title">主题色调 <small>全部本地使用</small></div><div class="theme-options">'+[['starlight','星屿暮色','柔紫 · 像黄昏一样温柔'],['sakura','樱花来信','浅粉 · 轻轻落在这一页'],['night','银河漫游','深色 · 留一片星空']].map(([id,name,desc])=>'<button class="theme-option '+id+' '+(state.settings.theme===id?'selected':'')+'" data-action="theme" data-theme="'+id+'" aria-pressed="'+(state.settings.theme===id)+'"><div class="theme-sample"><div class="sample-grid"><i></i><i></i><i></i><i></i></div></div><strong>'+name+'</strong><small>'+desc+'</small></button>').join('')+'</div><section class="panel" style="margin-top:22px"><div class="row"><h3>课程卡片不透明度</h3><span class="badge" id="opacity-value">'+state.settings.cardOpacity+'%</span></div><label class="field"><input aria-label="课程卡片不透明度" type="range" id="card-opacity" min="35" max="100" value="'+state.settings.cardOpacity+'"></label><p class="hint">数值越大，文字越清晰；数值越小，背景越通透。</p></section><button class="button ghost full" data-action="theme-demo">'+icon('calendar')+'用示例课程预览</button></div><section class="panel"><div class="row"><h3>二次元背景</h3><span class="badge">奶龙壁纸 / 自选图片</span></div><div class="wallpaper-preview" id="wallpaper-preview"></div><p>默认使用“神圣奶龙奔跑”壁纸，也可以从手机中选择喜欢的图片。图片仅保存到本机。</p><div class="button-group"><button class="button secondary" data-action="pick-background">'+icon('image')+'选择图片</button><button class="button ghost" data-action="builtin-background">恢复预置</button></div><button class="text-button" data-action="none-background" style="margin-top:13px">使用纯色背景</button><p class="hint">手机系统可能会自动调整相册图片方向。如背景方向不合适，请先在相册旋转后保存。</p></section></div>';}
function renderSettings(){const s=T();return '<p class="eyebrow">JUST YOUR TIMETABLE</p><h1 class="page-title">刚刚好的设置</h1><p class="subtitle">只留下课表需要的东西。</p><section class="panel"><div class="setting-row"><div><strong>学期与作息</strong><small>'+(s.semesterConfigured?'开学日期 '+escapeHTML(s.semesterStart)+' · '+s.totalWeeks+' 周':'请设置本学期第一周的周一')+'<br>'+s.periods+' 节 / 天 · 当前使用'+(s.semesterConfigured?'自定':'示例')+'作息，请按校区校准</small></div><button class="button secondary small" data-action="semester">编辑</button></div><div class="setting-row"><div><strong>我的学校</strong><small>'+escapeHTML(state.settings.schoolName)+'<br>教务网址可在导入页面修改</small></div><button class="text-button" data-action="school-name">修改</button></div><div class="setting-row"><div><strong>我的课表</strong><small>共 '+state.timetables.length+' 张 · 当前「'+escapeHTML(T().name)+'」<br>每张课表独立保存课程、学期与作息</small></div><button class="text-button" data-action="switch-timetable">管理</button></div><div class="setting-row"><div><strong>全部课程</strong><small>已保存 '+T().courses.length+' 项安排 · 点击可编辑</small></div><button class="text-button" data-action="all-courses">查看</button></div></section><div class="section-title">数据与备份</div><section class="panel"><div class="setting-row"><div><strong>导出本地备份</strong><small>保存全部课表、学期和配色设置<br>自选背景图片需另行保留</small></div><button class="button secondary small" data-action="export">导出</button></div><div class="setting-row"><div><strong>恢复备份 / 导入文件</strong><small>确认预览后才会保存</small></div><button class="text-button" data-action="import-file">选择文件</button></div>'+(undoAvailable?'<div class="setting-row"><div><strong>撤销最近一次导入</strong><small>恢复覆盖之前的课程与设置</small></div><button class="text-button" data-action="undo-import">恢复</button></div>':'')+'<div class="setting-row"><div><strong>清除教务登录状态</strong><small>退出本应用内学校网站的登录</small></div><button class="text-button" data-action="clear-session">清除</button></div></section><section class="panel"><div class="row"><span class="file-icon">'+icon('star')+'</span><div style="flex:1"><h3>一个安静的课表</h3><p>无广告 · 无会员 · 无商城</p></div></div><p>课程保存在本机。应用不含广告、统计、支付或账号服务。只有你打开学校网站时，才需要网络连接。</p><button class="text-button" data-action="about">关于星屿课表与导入适配 →</button></section><div class="settings-footer"><div class="footer-star">✦</div>星屿课表 0.1.3<br>愿每一个平常日，都有小小的期待</div>';}
function bindView(){
  if(tab==='schedule')bindWeekSwipe();
  const school=$('#school-form');if(school)school.onsubmit=e=>{e.preventDefault();const url=$('#school-url').value.trim();try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw 0;}catch(_){toast('请输入完整的学校教务网址');return;}if(!updateSettings({schoolUrl:url}))return;if(N)N.openSchool(url);else toast('教务网站导入请使用安卓安装包。浏览器预览支持文件导入。');};
  const preset=$('#school-preset');if(preset)preset.onchange=()=>{const p=C.schoolPreset(preset.value);if(updateSettings({schoolPreset:p.id,...(p.url?{schoolUrl:p.url}:{})}))render();};
  const slider=$('#card-opacity');if(slider){slider.oninput=()=>{$('#opacity-value').textContent=slider.value+'%';document.documentElement.style.setProperty('--card-alpha',Number(slider.value)/100);};slider.onchange=()=>updateSettings({cardOpacity:Number(slider.value)});}
  const target=$('#import-target');if(target)target.onchange=()=>{const box=$('#new-name-field');if(box)box.style.display=target.value==='new'?'':'none';};
  const preview=$('#wallpaper-preview');if(preview){const url=backgroundURL();if(url)preview.style.backgroundImage='url("'+url.replace(/["\\\n\r]/g,'')+'")';}
}
function showSheet(title,html){$('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;if(!$('#sheet').open)$('#sheet').showModal();$('#sheet').scrollTop=0;}
function closeSheet(){$('#sheet').close();}
function detail(id){const c=visibleCourses().find(c=>c.id===id);if(!c)return;showSheet(sample?'示例课程':'课程详情','<span class="badge">'+(sample?'示例 · 不会保存':'已保存到本机')+'</span><h3 class="detail-title">'+escapeHTML(c.name)+'</h3>'+[['时间','周'+['','一','二','三','四','五','六','日'][c.day]+' · 第 '+c.start+'–'+c.end+' 节'],['周次',C.weekLabel(c.weeks)+' 周'],['地点',c.room||'未填写'],['教师',c.teacher||'未填写']].map(([a,b])=>'<div class="detail-item"><span>'+a+'</span><span>'+escapeHTML(b)+'</span></div>').join('')+(c.note?'<p class="detail-note">'+escapeHTML(c.note)+'</p>':'')+(!sample?'<div class="button-group" style="margin-top:24px"><button class="button secondary" data-action="edit" data-id="'+escapeHTML(c.id)+'">编辑课程</button><button class="button danger" data-action="delete" data-id="'+escapeHTML(c.id)+'">删除</button></div>':''));}
function courseForm(id){if(sample){toast('请退出示例模式后再编辑自己的课表');return;}const c=T().courses.find(c=>c.id===id)||{name:'',teacher:'',room:'',day:1,start:1,end:2,weeks:'1-'+T().totalWeeks,color:'lavender',note:''};courseColor=c.color;
  showSheet(id?'编辑课程':'添加一门课','<form id="course-form"><label class="field"><span>课程名称 *</span><input name="name" required maxlength="100" value="'+escapeHTML(c.name)+'" placeholder="比如：高等数学"></label><div class="field-row"><label class="field"><span>教师</span><input name="teacher" maxlength="100" value="'+escapeHTML(c.teacher)+'" placeholder="选填"></label><label class="field"><span>教室 / 地点</span><input name="room" maxlength="100" value="'+escapeHTML(c.room)+'" placeholder="选填"></label></div><div class="field-row triple"><label class="field"><span>星期</span><select name="day">'+['一','二','三','四','五','六','日'].map((d,i)=>'<option value="'+(i+1)+'" '+(c.day===i+1?'selected':'')+'>周'+d+'</option>').join('')+'</select></label><label class="field"><span>开始节次</span><input name="start" type="number" min="1" max="24" required value="'+c.start+'"></label><label class="field"><span>结束节次</span><input name="end" type="number" min="1" max="24" required value="'+c.end+'"></label></div><label class="field"><span>周次 *</span><input name="weeks" required maxlength="150" value="'+escapeHTML(Array.isArray(c.weeks)?C.weekLabel(c.weeks):c.weeks)+'" placeholder="1-16 或 1-16单周 或 1-8,10-16"></label><p class="hint">支持不连续周次、单周、双周；同一课程的不同上课时间请分别添加。</p><label class="field"><span>备注</span><textarea name="note" maxlength="500" placeholder="选填">'+escapeHTML(c.note)+'</textarea></label><label class="field"><span>课程颜色</span></label><div class="color-options">'+['lavender','rose','mint','sky','peach','lemon'].map(color=>'<button type="button" aria-label="'+color+'" class="color-swatch '+color+' '+(c.color===color?'selected':'')+'" data-action="course-color" data-color="'+color+'">'+color+'</button>').join('')+'</div><div id="course-error"></div><button class="button full" type="submit">保存课程</button></form>');
  $('#course-form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.target));const item=C.validateCourse({...values,id:id||C.uid(),color:courseColor});const next=T().courses.filter(x=>x.id!==item.id).concat(item);const overlap=C.conflicts(next).filter(s=>s.includes(item.name));if(persistTimetable({courses:next})){closeSheet();render();toast(overlap.length?'已保存；有时间冲突，课表中已标记':'课程已保存');}}catch(err){$('#course-error').innerHTML='<div class="notice error">'+escapeHTML(err.message)+'</div>';}};
}
function semesterForm(){const s=T();showSheet('学期与作息 · '+s.name,'<form id="semester-form"><label class="field"><span>本学期第一周的周一 *</span><input type="date" name="semesterStart" required value="'+s.semesterStart+'"></label><div class="field-row"><label class="field"><span>总教学周数</span><input type="number" name="totalWeeks" min="1" max="40" required value="'+s.totalWeeks+'"></label><label class="field"><span>每天节次数</span><input type="number" name="periods" min="1" max="24" required value="'+s.periods+'"></label></div><label class="field"><span>作息表：每行一节，格式为 08:00-08:45 *</span><textarea name="times" rows="8" required spellcheck="false">'+escapeHTML(s.times.join('\n'))+'</textarea></label><p class="hint">首次提供的是示例作息，请按你所在校区的实际作息修改。导入课程的“节次”会对应这里的时间。</p><div id="semester-error"></div><button type="submit" class="button full">保存学期设置</button></form>');$('#semester-form').onsubmit=e=>{e.preventDefault();try{const f=Object.fromEntries(new FormData(e.target)),date=C.parseDate(f.semesterStart),totalWeeks=+f.totalWeeks,periods=+f.periods;if(date.getDay()!==1)throw new Error('请选择第一周的周一，避免教学周错位');if(!Number.isInteger(totalWeeks)||totalWeeks<1||totalWeeks>40||!Number.isInteger(periods)||periods<1||periods>24)throw new Error('教学周应为1–40，节次应为1–24');const times=f.times.split(/\n/).map(s=>s.trim()).filter(Boolean);if(times.length<periods||times.length>24||!times.every(C.validTimeRange))throw new Error('请为每一节填写有效的开始和结束时间（最多24行）');for(let i=1;i<times.length;i++)if(times[i].slice(0,5)<times[i-1].slice(6))throw new Error('相邻两节的作息时间有重叠，请检查第 '+(i+1)+' 行');if(persistTimetable({semesterStart:f.semesterStart,totalWeeks,periods,times,semesterConfigured:true})){viewWeek=Math.max(1,Math.min(totalWeeks,currentWeek()));closeSheet();render();toast('学期与作息已保存');}}catch(err){$('#semester-error').innerHTML='<div class="notice error">'+escapeHTML(err.message)+'</div>';}};}
function showWeekPicker(){showSheet('选择教学周','<p class="hint">'+(T().semesterConfigured?'点选任意一周，查看课程安排。':'请先在“设置”中核对开学日期。')+'</p><div class="week-grid">'+Array.from({length:T().totalWeeks},(_,i)=>'<button class="'+(viewWeek===i+1?'active ':'')+(currentWeek()===i+1?'current':'')+'" data-action="set-week" data-week="'+(i+1)+'">'+(i+1)+' 周</button>').join('')+'</div><button class="button secondary full" data-action="this-week">回到本周</button>');}
function confirmDialog(title,message,callback,label='确认'){showSheet(title,'<p class="subtitle" style="margin:10px 0 24px">'+escapeHTML(message)+'</p><div class="button-group"><button class="button ghost" data-action="close">取消</button><button class="button" id="confirm-button">'+escapeHTML(label)+'</button></div>');$('#confirm-button').onclick=callback;}
function listCourses(courses,title){showSheet(title,'<div class="import-preview" style="max-height:65dvh">'+(courses.length?courses.map(c=>'<button class="preview-course" style="text-align:left;color:inherit" data-action="detail" data-id="'+escapeHTML(c.id)+'"><strong>'+escapeHTML(c.name)+'</strong><small>周'+c.day+' · 第 '+c.start+'–'+c.end+' 节 · '+escapeHTML(c.room||'地点未填')+'<br>'+escapeHTML(C.weekLabel(c.weeks))+' 周</small></button>').join(''):'<p class="subtitle">还没有课程，试着添加第一门吧。</p>')+'</div>');}
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
  showSheet('核对导入结果','<div class="row" style="margin:10px 0"><strong style="font-size:19px">'+courses.length+' 项课程安排</strong><span class="badge">待你确认</span></div><p class="hint">请核对课程名、周次、节次和地点。下方确认后，才会将课表保存到本机。</p>'+((result.warnings||[]).length?'<div class="notice warning">有 '+result.warnings.length+' 项内容未能完整识别，请导入后手动补齐：<br>'+result.warnings.slice(0,6).map(escapeHTML).join('<br>')+'</div>':'')+(overlap.length?'<div class="notice warning">检测到 '+overlap.length+' 处课程时间冲突，课表中会显示冲突标记。</div>':'')+'<div class="import-preview">'+courses.map(c=>'<div class="preview-course"><strong>'+escapeHTML(c.name)+'</strong><small>周'+c.day+' · 第 '+c.start+'–'+c.end+' 节 · '+escapeHTML(c.room||'地点待补充')+'<br>'+escapeHTML(C.weekLabel(c.weeks))+' 周'+(c.teacher?' · '+escapeHTML(c.teacher):'')+'</small></div>').join('')+'</div><label class="field"><span>导入到哪张课表</span><select id="import-target"><option value="new">新建一张课表（保留现有课表）</option><option value="replace">替换当前课表（'+escapeHTML(T().name)+'）</option><option value="merge">合并到当前课表（'+escapeHTML(T().name)+'）</option></select></label><label class="field" id="new-name-field"><span>新课表名称</span><input id="new-timetable-name" maxlength="40" value="'+escapeHTML(suggested)+'"></label>'+(result.settings?'<label class="check-field"><input type="checkbox" id="restore-settings" checked>同时恢复文件中的学期与配色设置</label>':'')+'<p class="hint">'+(result.settings?'自选背景图片不包含在备份中，将使用预置背景。':'新建课表后，可以到“设置 → 学期与作息”填写开学日期和作息。')+'</p><button class="button full" data-action="confirm-import">确认并保存 '+courses.length+' 项安排</button>');
}
function showBackupRestore(result){
  const list=result.timetables,courses=list.reduce((n,t)=>n+t.courses.length,0);pendingImport={...result};
  showSheet('恢复整份备份','<div class="row" style="margin:10px 0"><strong style="font-size:19px">'+list.length+' 张课表 · '+courses+' 项安排</strong><span class="badge">待你确认</span></div><p class="hint">这份备份包含多张课表。恢复后会替换本机的全部课表与设置，导入前会自动保留一份可撤销的备份。</p><div class="import-preview">'+list.map(t=>'<div class="preview-course"><strong>'+escapeHTML(t.name)+'</strong><small>'+(t.semesterConfigured?escapeHTML(t.semesterStart)+' 起 · '+t.totalWeeks+' 周':'未设置开学日期')+' · '+t.courses.length+' 项安排</small></div>').join('')+'</div><button class="button full" data-action="confirm-restore">恢复这 '+list.length+' 张课表</button>');
}
function importError(message){if(tab==='import')$('#import-error').innerHTML='<div class="notice error">'+escapeHTML(message)+'</div>';else toast(message);}
window.receiveSchoolSnapshot=text=>{try{showImport(C.parseSchoolSnapshot(JSON.parse(text)));}catch(e){go('import');importError(e.message);}};
function snapshotFromHTML(html){const doc=new DOMParser().parseFromString(html,'text/html');return {tables:Array.from(doc.querySelectorAll('table')).map(table=>({rows:Array.from(table.rows).map(row=>({cells:Array.from(row.cells).map(cell=>C.cellSnapshot(doc,cell))}))}))};}
window.receiveImportFile=text=>{try{text=text.replace(/^\uFEFF/,'').trim();if(text.length>2*1024*1024)throw new Error('文件过大，请选择小于 2 MB 的课表文件');if(text.startsWith('{')||text.startsWith('[')){const data=JSON.parse(text);if(Array.isArray(data))showImport({courses:data});else if(Array.isArray(data.timetables)){const checked=C.sanitizeState(data);showImport({timetables:checked.timetables,settings:checked.settings,activeId:checked.activeId});}else if(Array.isArray(data.courses)){const checked=C.sanitizeState(data),first=checked.timetables[0];showImport({courses:first.courses,settings:data.settings?{...checked.settings,...pickSemester(first)}:null});}else throw new Error('不是星屿课表 JSON 格式，请使用 CSV、课表 HTML 或在教务页面识别');}else if(text.startsWith('<'))showImport(C.parseSchoolSnapshot(snapshotFromHTML(text)));else showImport({courses:C.parseCSV(text)});}catch(e){importError(e.message);}};
window.receiveBackground=()=>{if(updateSettings({background:'custom'})){render();toast('背景已更换，只保存在本机');}};
window.handleNativeBack=()=>{if($('#sheet').open){closeSheet();return true;}if(tab!=='schedule'){go('schedule');return true;}if(sample){sample=false;render();return true;}return false;};
const actions={
  tab:b=>go(b.dataset.tab),add:()=>courseForm(),edit:b=>courseForm(b.dataset.id),close:closeSheet,detail:b=>detail(b.dataset.id),semester:semesterForm,today:jumpToToday,'switch-timetable':timetableSheet,timetable:timetableSheet,'select-timetable':b=>switchTimetable(b.dataset.id),'new-timetable':newTimetableForm,'rename-timetable':b=>renameTimetableForm(b.dataset.id),'delete-timetable':b=>deleteTimetable(b.dataset.id),
  'prev-week':()=>changeWeek(-1),'next-week':()=>changeWeek(1),'week-picker':showWeekPicker,'set-week':b=>{const next=+b.dataset.week;closeSheet();navigateToWeek(next);},'this-week':()=>{closeSheet();jumpToToday();},
  demo:()=>{sample=true;viewWeek=Math.max(1,Math.min(T().totalWeeks,currentWeek()));render();},'exit-demo':()=>{sample=false;render();},'theme-demo':()=>{sample=true;go('schedule');},theme:b=>{if(updateSettings({theme:b.dataset.theme}))render();},'pick-background':()=>N?N.pickBackground():$('#browser-background').click(),'builtin-background':()=>{if(updateSettings({background:'builtin'}))render();},'none-background':()=>{if(updateSettings({background:'none'}))render();},
  'course-color':b=>{courseColor=b.dataset.color;document.querySelectorAll('.color-swatch').forEach(el=>el.classList.toggle('selected',el.dataset.color===courseColor));},
  delete:b=>confirmDialog('删除这项课程安排？','删除后这项安排将从本学期的课表移除。如果只是改时间，可以选择编辑。',()=>{if(persistTimetable({courses:T().courses.filter(c=>c.id!==b.dataset.id)})){closeSheet();render();toast('课程已删除');}},'删除'),
  'conflict-detail':b=>listCourses(visibleCourses().filter(c=>b.dataset.ids.split(',').includes(c.id)),'同一时段的课程'),
  'all-courses':()=>listCourses(T().courses.slice().sort((a,b)=>a.day-b.day||a.start-b.start),'全部课程 · '+T().courses.length+' 项'),
  'import-file':()=>N?N.pickImportFile():$('#browser-import').click(),
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
  about:()=>showSheet('关于星屿课表','<h3 class="detail-title">星屿课表 <small style="font-size:12px">0.2.0</small></h3><p class="subtitle">独立制作的本地安卓课表。无广告、会员、商城、推广或统计服务。</p><div class="notice">仅需网络权限，用于打开你指定的教务网站；相册和文件通过系统选择器按次授权。</div><p class="subtitle">导入方式：在学校网站完成登录，打开整学期个人课表，再采集课程表格。按公开页面结构适配常见强智与正方教务课表；真实账号页面尚未全部实测，遇到页面变动可能需要继续适配。</p><p class="subtitle">课程、主题、自选背景和学校网站会话存储在本机。应用不会主动提取密码，也没有自建服务器。建议在分享备份前检查是否含有个人备注。卸载会清除应用内数据，请先导出备份。</p><p class="hint">网络可能需要校园网 / 学校 VPN。应用不绕过统一认证、验证码或双因子验证。默认背景为“神圣奶龙奔跑”图片，可在装扮中更换。</p>')
};
document.addEventListener('click',e=>{if(Date.now()<suppressCourseClickUntil&&e.target.closest('.timetable')){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled&&actions[b.dataset.action])actions[b.dataset.action](b);});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-action]')){e.preventDefault();e.target.click();}});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
$('#browser-import').onchange=async e=>{const file=e.target.files[0];if(file){if(file.size>2*1024*1024)importError('请选择小于 2 MB 的文件');else window.receiveImportFile(await file.text());}e.target.value='';};
$('#browser-background').onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>4*1024*1024){toast('浏览器预览请选择小于 4 MB 的图片');return;}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('xingyu-wallpaper',reader.result);window.receiveBackground();}catch(_){toast('浏览器存储空间不足');}};reader.readAsDataURL(file);e.target.value='';};
render();
