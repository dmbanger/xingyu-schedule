(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScheduleCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_WEEKS=40, MAX_PERIODS=24;
  // School presets only prefill the login entry. Every school can still type its own URL.
  const SCHOOL_PRESETS=[
    {id:'generic',label:'通用：手动填写教务网址',badge:'多校适配 · 正方 / 强智',url:'',hint:'填写你学校的教务入口网址。识别读取页面里的课表表格，正方、强智等常见教务系统都可以尝试；结构特殊的页面可能需要继续适配。'},
    {id:'bupt',label:'北京邮电大学 · 强智教务',badge:'强智教务 · 已预置北邮入口',url:'https://jwgl.bupt.edu.cn/',hint:'已预置北京邮电大学教务入口。登录后进入“个人课表 / 学期理论课表”，选对学期、显示整学期课表后点“识别课表”。如需校园网，请先连接学校 VPN。'},
    {id:'buct',label:'北京化工大学 · 正方教务',badge:'正方教务 · 已预置北化入口',url:'http://jwglxt.buct.edu.cn',hint:'已预置北京化工大学教务管理系统入口，会跳转学校统一身份认证。登录后进入“教务管理系统 → 信息查询 → 学生课表”，显示整学期课表后点“识别课表”。'}
  ];
  function schoolPreset(id){return SCHOOL_PRESETS.find(p=>p.id===id)||SCHOOL_PRESETS[0];}
  function uid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function parseWeeks(input,max=MAX_WEEKS){
    if(Array.isArray(input)){
      if(!input.length||input.some(n=>!Number.isInteger(n)||n<1||n>max))throw new Error('周次必须在 1–'+max+' 之间');
      return [...new Set(input)].sort((a,b)=>a-b);
    }
    let raw=String(input||'').trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296));
    const odd=/单/.test(raw),even=/双/.test(raw);
    if(odd&&even)throw new Error('请分别录入单周和双周安排');
    raw=raw.replace(/第|周次|周|单|双|[()（）\[\]【】\s]/g,'').replace(/[，、；;]/g,',').replace(/[—–~～至]/g,'-');
    if(!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(raw))throw new Error('周次格式示例：1-16、1-16单周、1-8,10-16');
    let result=[];
    for(const part of raw.split(',')){
      const [a,b=a]=part.split('-').map(Number);
      if(a<1||b>max||b<a)throw new Error('周次范围无效（1–'+max+'）');
      for(let n=a;n<=b;n++)if((!odd||n%2===1)&&(!even||n%2===0))result.push(n);
    }
    result=[...new Set(result)].sort((a,b)=>a-b);
    if(!result.length)throw new Error('周次为空，请检查单双周设置');
    return result;
  }
  function weekLabel(weeks){
    const list=parseWeeks(weeks);let result=[],start=list[0],end=start;
    for(let i=1;i<=list.length;i++){if(list[i]===end+1){end=list[i];continue;}result.push(start===end?String(start):start+'-'+end);start=end=list[i];}
    return result.join(',');
  }
  function validateCourse(c){
    const v={id:String(c.id||uid()),name:String(c.name||'').trim().slice(0,100),teacher:String(c.teacher||'').trim().slice(0,100),room:String(c.room||'').trim().slice(0,100),day:Number(c.day),start:Number(c.start),end:Number(c.end),weeks:parseWeeks(c.weeks),color:String(c.color||'lavender'),note:String(c.note||'').slice(0,500)};
    if(!v.name)throw new Error('请填写课程名称');
    if(!Number.isInteger(v.day)||v.day<1||v.day>7)throw new Error(v.name+'：星期应为 1–7');
    if(!Number.isInteger(v.start)||!Number.isInteger(v.end)||v.start<1||v.end<v.start||v.end>MAX_PERIODS)throw new Error(v.name+'：节次范围无效');
    if(!['lavender','rose','mint','sky','peach','lemon'].includes(v.color))v.color='lavender';
    return v;
  }
  function normalizeCourses(list){
    if(!Array.isArray(list)||list.length>1000)throw new Error('课程列表无效或超过 1000 条');
    const result=[],keys=new Set(),ids=new Set();
    for(const raw of list){const c=validateCourse(raw),key=[c.name,c.teacher,c.room,c.day,c.start,c.end,c.weeks.join(',')].join('|');if(keys.has(key))continue;keys.add(key);if(ids.has(c.id))c.id=uid();ids.add(c.id);result.push(c);}
    return result;
  }
  function monday(date=new Date()){let d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
  function dateString(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function parseDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw new Error('日期格式无效');const [y,m,d]=s.split('-').map(Number),v=new Date(y,m-1,d);if(dateString(v)!==s)throw new Error('日期无效');return v;}
  function weekAt(start,now=new Date()){const a=monday(parseDate(start)),b=monday(now);return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/604800000)+1;}
  function defaultState(){return {version:2,courses:[],settings:{schoolName:'我的学校',schoolUrl:'',schoolPreset:'generic',semesterStart:dateString(monday()),semesterConfigured:false,totalWeeks:20,periods:12,theme:'starlight',background:'builtin',cardOpacity:88,times:['08:00-08:45','08:50-09:35','09:50-10:35','10:40-11:25','11:30-12:15','13:30-14:15','14:20-15:05','15:20-16:05','16:10-16:55','18:30-19:15','19:20-20:05','20:10-20:55']}};}
  function sanitizeState(raw){
    const d=defaultState();if(!raw||typeof raw!=='object')return d;d.courses=normalizeCourses(raw.courses||[]);const s=raw.settings||{};
    for(const key of ['schoolName','schoolUrl'])if(typeof s[key]==='string')d.settings[key]=s[key].slice(0,500);
    // Pre-0.2.0 builds baked one school in. Migrate that saved default exactly once: after the
    // first save the state carries version 2, so anything the user types later is left alone.
    if(Number(raw.version||1)<2){
      if(d.settings.schoolName==='北京邮电大学')d.settings.schoolPreset='bupt';
      if(/^https?:\/\/auth\.bupt\.edu\.cn\/?$/.test(d.settings.schoolUrl))d.settings.schoolUrl='https://jwgl.bupt.edu.cn/';
    }
    try{parseDate(s.semesterStart);d.settings.semesterStart=s.semesterStart;}catch(_){}
    d.settings.semesterConfigured=s.semesterConfigured===true;
    for(const [key,min,max] of [['totalWeeks',1,40],['periods',1,24],['cardOpacity',35,100]])if(Number.isInteger(Number(s[key]))&&Number(s[key])>=min&&Number(s[key])<=max)d.settings[key]=Number(s[key]);
    if(['starlight','sakura','night'].includes(s.theme))d.settings.theme=s.theme;
    if(SCHOOL_PRESETS.some(p=>p.id===s.schoolPreset))d.settings.schoolPreset=s.schoolPreset;
    if(['builtin','custom','none'].includes(s.background))d.settings.background=s.background;
    if(Array.isArray(s.times)&&s.times.length<=24&&s.times.every(t=>validTimeRange(t)))d.settings.times=s.times;
    return d;
  }
  function validTimeRange(t){if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(t))return false;return t.slice(0,5)<t.slice(6);}
  function parseCSV(text){
    const rows=[];let row=[],field='',quoted=false;
    text=String(text).replace(/^\uFEFF/,'');
    for(let i=0;i<=text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field==='')quoted=true;else if(quoted)quoted=false;else field+=c;}else if((c===','||c==='\n'||c===undefined)&&!quoted){row.push(field.replace(/\r$/,''));field='';if(c!==','){if(row.some(x=>x.trim()))rows.push(row);row=[];}}else if(c!==undefined)field+=c;}
    if(quoted)throw new Error('CSV 引号未闭合');
    const aliases={name:['name','课程','课程名称'],teacher:['teacher','教师','老师'],room:['room','地点','教室'],day:['day','星期','星期几'],start:['start','开始节次','起始节'],end:['end','结束节次','结束节'],weeks:['weeks','周次'],note:['note','备注']};
    const header=rows.shift()||[],idx={};for(const key of Object.keys(aliases))idx[key]=header.findIndex(h=>aliases[key].includes(h.trim()));
    if(['name','day','start','end','weeks'].some(k=>idx[k]<0))throw new Error('CSV 需包含：课程名称、星期、开始节次、结束节次、周次');
    return normalizeCourses(rows.map((r,i)=>{let c={};for(const k of Object.keys(idx))if(idx[k]>=0)c[k]=r[idx[k]];c.color=['lavender','rose','mint','sky','peach','lemon'][i%6];return c;}));
  }
  function periodRanges(numbers){
    const sorted=[...new Set(numbers)].sort((a,b)=>a-b),ranges=[];
    for(const n of sorted){if(!Number.isInteger(n)||n<1||n>MAX_PERIODS)throw new Error('节次应在 1–24 之间');const last=ranges[ranges.length-1];if(last&&n===last[1]+1)last[1]=n;else ranges.push([n,n]);}
    return ranges;
  }
  function parsePeriodRanges(input){
    let text=String(input||'').replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296));
    const cn={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
    const numberCN=s=>{if(s==='十')return 10;if(s.includes('十')){const [a,b]=s.split('十');return (a?cn[a]:1)*10+(b?cn[b]:0);}return cn[s];};
    text=text.replace(/第?([一二三四五六七八九十、，,至和及\-—~～\s]+)节/g,(_,label)=>label.replace(/[一二三四五六七八九十]+/g,value=>{
      const tokens=value.match(/[二三四五六七八九]十[一二三四五六七八九]?|十[一二三四五六七八九]?|[一二三四五六七八九]/g)||[];
      return tokens.map(numberCN).join(',');
    })+'节');
    text=text.replace(/节\s*[至到\-—~～]\s*第?/g,'-').replace(/[（(]\s*节\s*[）)]/g,'节');
    const chunks=[];
    // Capture the complete list before 节; matching only a pair drops earlier periods.
    for(const m of text.matchAll(/([0-9][0-9\s,，、\-—–~～至和及]*)\s*[\]】)）]?\s*节/g))chunks.push(m[1]);
    if(!chunks.length){const labeled=text.match(/(?:【节次】|节次\s*[:：])\s*([0-9][0-9\s,，、\-—–~～至和及]*)/);if(labeled)chunks.push(labeled[1]);}
    if(!chunks.length&&/^[\s第\[【(（]*[0-9][0-9\s,，、\-—–~～至和及]*[\]】)）\s]*$/.test(text))chunks.push(text.replace(/第|[\[【(（\]】)）]/g,''));
    if(!chunks.length)return null;
    const values=[];
    for(let chunk of chunks){chunk=chunk.replace(/\s/g,'').replace(/[，、和及]/g,',').replace(/[—–~～至]/g,'-');
      for(const part of chunk.split(',')){
        if(!part)continue;
        if(/^\d{4,}$/.test(part)&&part.length%2===0){for(const token of part.match(/\d{2}/g))values.push(+token);continue;}
        if(!/^\d+(?:-\d+)*$/.test(part))throw new Error('节次格式无法确认');
        const list=part.split('-').map(Number);
        if(list.length===2){const [a,b]=list;if(a<1||b<a||b>24)throw new Error('节次范围无效');for(let n=a;n<=b;n++)values.push(n);}
        else values.push(...list);
      }
    }
    if(!values.length)throw new Error('节次为空');
    return periodRanges(values);
  }
  function parsePeriods(text){const ranges=parsePeriodRanges(text);if(!ranges)return null;if(ranges.length!==1)throw new Error('节次不连续，请分段录入');return ranges[0];}
  function parseBlock(block,day,fallbackPeriods,index){
    const text=String(block||'').trim();if(!text||/^(无|暂无|空|[-—\s]+)$/.test(text))return null;
    const lines=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const weekLine=lines.find(s=>/\d.*周|周次.*\d/.test(s)&&!/星期/.test(s));
    if(!weekLine)throw new Error('无法识别周次：'+lines[0]);
    const withoutPeriods=weekLine.replace(/[\[【(（][^\]】)）]*节[^\]】)）]*[\]】)）]/g,'').replace(/\d{1,2}\s*[-,，、至~～]\s*\d{1,2}\s*节/g,'');
    const weekMatches=[...withoutPeriods.matchAll(/\d[\d\s,，、\-—–~～至]*(?:\(周\)|（周）|周|[（(][单双]周[）)])(?:[（(]?[单双]周?[）)]?)?/g)];
    if(!weekMatches.length)throw new Error('无法识别周次：'+weekLine);
    const parsedWeeks=parseWeeks(weekMatches.flatMap(m=>parseWeeks(m[0])));
    const periods=parsePeriodRanges(lines.filter(x=>/节/.test(x)).join(' '))||fallbackPeriods;
    if(!periods)throw new Error('无法识别节次：'+lines[0]);
    const labeled=(kind)=>{const re=new RegExp('^(?:【)?(?:'+kind+')(?:】|[:：]|[ \u3000])');const l=lines.find(s=>re.test(s));return l?l.replace(re,'').trim():'';};
    const name=labeled('课程|课程名称')||lines.find(s=>!s.startsWith('【')&&!/^(教师|老师|教室|地点|周次|课程编号|学分|考查|考试)[:： 　]/.test(s)&&!/\d.*周|第?\d+.*节/.test(s));
    if(!name)throw new Error('无法识别课程名');
    const unlabeled=lines.filter(s=>s!==name&&s!==weekLine&&!s.startsWith('【')&&!/^(教师|老师|教室|地点|周次|课程编号|学分)[:： 　]/.test(s)&&!/^第?\d.*节/.test(s));
    let teacher=labeled('教师|老师'),room=labeled('教室|地点|上课地点');const rest=unlabeled.slice();
    if(!teacher&&rest.length)teacher=rest.shift();
    if(!room&&rest.length)room=rest.pop();
    return periods.map(([start,end])=>validateCourse({name,teacher,room,day,start,end,weeks:parsedWeeks,color:['lavender','mint','sky','rose','peach','lemon'][index%6]}));
  }
  // A cell can stack several courses: 强智 separates them with a horizontal rule, 正方 with a
  // blank line. A single course may contain blank lines too, so blank-line groups only count
  // when every group carries week information.
  function courseBlocks(cell){
    const LF=String.fromCharCode(10),text=String(cell&&cell.text||'');
    let blocks=Array.isArray(cell.blocks)&&cell.blocks.length>1?cell.blocks:null;
    if(!blocks){
      blocks=[];let current=[];
      for(const line of text.split(LF)){
        if(/^[ \t]*[-—]{3,}[ \t]*$/.test(line)){if(current.length){blocks.push(current.join(LF));current=[];}continue;}
        current.push(line);
      }
      if(current.length)blocks.push(current.join(LF));
      if(!blocks.length)blocks=[text];
    }
    if(blocks.length>1)return blocks;
    const groups=[];let group=[];
    for(const line of text.split(LF)){if(!line.trim()){if(group.length){groups.push(group.join(LF));group=[];}continue;}group.push(line);}
    if(group.length)groups.push(group.join(LF));
    return groups.length>1&&groups.every(s=>/[0-9]/.test(s)&&/周/.test(s))?groups:[text];
  }
  function parseSchoolSnapshot(snapshot){
    if(!snapshot||!Array.isArray(snapshot.tables))throw new Error('未找到课表表格，请进入个人课表页面再识别');
    let courses=[],warnings=[],matched=false;
    const weekday=s=>{const t=String(s).replace(/\s/g,'');const m=t.match(/^(?:星期|周|礼拜)([一二三四五六日天])(?:[（(\d].*)?$/);return m?{'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7}[m[1]]:0;};
    for(const table of snapshot.tables){
      const rows=table.rows||[];let grid=[],orig=[];
      for(let r=0;r<rows.length;r++){grid[r]??=[];let col=0;orig[r]=[];for(const cell of (rows[r].cells||[])){const rs=Math.min(cell.rowSpan===0?rows.length-r:Math.max(+cell.rowSpan||1,1),50),cs=Math.min(Math.max(+cell.colSpan||1,1),20);while(Array.from({length:cs},(_,i)=>grid[r][col+i]).some(Boolean))col++;orig[r].push({cell,col,rowSpan:rs,colSpan:cs});for(let dr=0;dr<rs;dr++){grid[r+dr]??=[];for(let dc=0;dc<cs;dc++)grid[r+dr][col+dc]=cell;}col+=cs;}}
      let header=-1,dayCols={};for(let r=0;r<Math.min(grid.length,8);r++){const map={};(grid[r]||[]).forEach((c,i)=>{const day=weekday(c?.text);if(day)map[i]=day;});if(new Set(Object.values(map)).size>=5){header=r;dayCols=map;break;}}
      if(header<0)continue;matched=true;
      const firstDayCol=Math.min(...Object.keys(dayCols).map(Number));
      const rowPeriods=grid.map(cells=>{for(let col=firstDayCol-1;col>=0;col--){try{const ranges=parsePeriodRanges(cells[col]?.text);if(ranges)return ranges;}catch(_){return null;}}return null;});
      for(let r=header+1;r<rows.length;r++){
        for(const {cell,col,rowSpan,colSpan} of orig[r]||[]){const day=dayCols[col];if(!day)continue;const blocks=courseBlocks(cell);
          const spannedRows=rowPeriods.slice(r,r+rowSpan);let fallback=null;
          if(spannedRows.length===rowSpan&&spannedRows.every(Boolean))fallback=periodRanges(spannedRows.flatMap(ranges=>ranges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i))));
          for(const block of blocks){try{if(colSpan>1&&Array.from({length:colSpan},(_,i)=>dayCols[col+i]).some(d=>d&&d!==day))throw new Error('单元格跨越多个星期，请手动确认上课日');const parsed=parseBlock(block,day,fallback,courses.length);if(parsed)courses.push(...parsed);}catch(e){if(String(block).trim())warnings.push('星期'+day+'：'+e.message);}}
        }
      }
    }
    courses=normalizeCourses(courses);
    if(!matched)throw new Error('未识别到按星期排列的课表。请打开“个人课表 / 学期理论课表”，并切换到整学期视图。');
    if(!courses.length)throw new Error(warnings.length?'找到表格，但课程格式未匹配。'+warnings.slice(0,2).join('；'):'当前表格没有可导入的课程，请确认学期和课表视图。');
    return {courses,warnings:[...new Set(warnings)],source:snapshot.sourceHost||''};
  }
  function conflicts(courses){const result=[];for(let i=0;i<courses.length;i++)for(let j=i+1;j<courses.length;j++){const a=courses[i],b=courses[j];if(a.day===b.day&&a.start<=b.end&&b.start<=a.end&&a.weeks.some(w=>b.weeks.includes(w)))result.push(a.name+' / '+b.name+'（周'+a.day+'）');}return result;}
  // Reads one table cell into text with one field per line. The injected page extractor
  // serialises this function, so it must stay dependency-free and backslash-free.
  function cellSnapshot(doc,cell){
    const LF=String.fromCharCode(10);
    const clone=cell.cloneNode(true);
    clone.querySelectorAll('input,textarea,select,button,script,style,form').forEach(n=>n.remove());
    clone.querySelectorAll('br').forEach(n=>n.replaceWith(doc.createTextNode(LF)));
    clone.querySelectorAll('hr').forEach(n=>n.replaceWith(doc.createTextNode(LF+'---'+LF)));
    clone.querySelectorAll('div,p,li,dt,dd,section,article,header,footer').forEach(n=>{if((n.textContent||'').slice(-1)!==LF)n.appendChild(doc.createTextNode(LF));});
    clone.querySelectorAll('[title]').forEach(n=>{const t=n.getAttribute('title')||'';const tag=/教师|老师/.test(t)?'【教师】':/教室|地点/.test(t)?'【地点】':/周次|周数/.test(t)?'【周次】':'';if(!tag)return;const prev=n.previousSibling;if(!prev||!(prev.textContent||'').endsWith(LF))n.prepend(doc.createTextNode(LF));n.prepend(doc.createTextNode(tag));});
    return {text:(clone.textContent||'').trim(),rowSpan:cell.rowSpan,colSpan:cell.colSpan};
  }
  function snapshotScript(){return `(function(){var out={sourceHost:location.hostname,tables:[]};var capture=${cellSnapshot.toString()};function scan(doc){Array.from(doc.querySelectorAll("table")).forEach(function(table){if(table.rows.length>80)return;out.tables.push({rows:Array.from(table.rows).map(function(row){return {cells:Array.from(row.cells).map(function(cell){return capture(doc,cell);})};})});});Array.from(doc.querySelectorAll("iframe,frame")).forEach(function(f){try{if(f.contentDocument)scan(f.contentDocument);}catch(e){}});}scan(document);return JSON.stringify(out);})()`;}
  return {uid,parseWeeks,weekLabel,validateCourse,normalizeCourses,monday,dateString,parseDate,weekAt,defaultState,sanitizeState,validTimeRange,parseCSV,parsePeriods,parsePeriodRanges,parseSchoolSnapshot,conflicts,snapshotScript,cellSnapshot,SCHOOL_PRESETS,schoolPreset};
});
