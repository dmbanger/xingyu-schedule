const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/src/main/assets/core.js');
const cell=(text='',extra={})=>({text,rowSpan:1,colSpan:1,...extra});
const row=(...cells)=>({cells});
const header=row(cell('节次'),...['一','二','三','四','五','六','日'].map(d=>cell('星期'+d)));
const course=(extra={})=>({name:'离散数学',day:1,start:1,end:2,weeks:'1-16',...extra});

test('周次：区间、不连续周次、全角、单双周',()=>{
  assert.deepEqual(C.parseWeeks('1-3,5,7-8'),[1,2,3,5,7,8]);
  assert.deepEqual(C.parseWeeks('第１～６周（单）'),[1,3,5]);
  assert.deepEqual(C.parseWeeks('1-6(双周)'),[2,4,6]);
  assert.deepEqual(C.parseWeeks('1-4(周)'),[1,2,3,4]);
  assert.equal(C.weekLabel([1,2,3,5,7,8]),'1-3,5,7-8');
});
test('周次错误不得被替换成整学期',()=>{
  for(const input of ['','0-16','16-1','1-41','下半学期','1-16单双周',[]])assert.throws(()=>C.parseWeeks(input));
});
test('识别节次时不把周次误认为节次',()=>{
  assert.deepEqual(C.parsePeriods('1-16(周)[03-04节]'),[3,4]);
  assert.deepEqual(C.parsePeriods('第1-2节'),[1,2]);
  assert.deepEqual(C.parsePeriods('第一二节'),[1,2]);
  assert.equal(C.parsePeriods('1-16周'),null);
});
test('三节与四节课必须读取完整列表，不能只取末尾两节',()=>{
  for(const label of ['第1,2,3节','第1、2、3节','[01-02-03节]','[01,02,03]节','第０１，０２，０３节','第1-3节','[010203节]','第一二三节'])assert.deepEqual(C.parsePeriods(label),[1,3],label);
  assert.deepEqual(C.parsePeriods('[01,02,03,04节]'),[1,4]);
  assert.deepEqual(C.parsePeriods('第十一、十二、十三节'),[11,13]);
  assert.deepEqual(C.parsePeriods('第1节至第3节'),[1,3]);
});
test('不连续节次要分段，不能补出不存在的中间课程',()=>{
  assert.deepEqual(C.parsePeriodRanges('第1,3,5节'),[[1,1],[3,3],[5,5]]);
  assert.throws(()=>C.parsePeriods('第1,3,5节'),/不连续/);
  assert.throws(()=>C.parsePeriodRanges('第1,2,33节'),/1–24/);
  const out=C.parseSchoolSnapshot({tables:[{rows:[header,row(cell('1-2'),cell('实验课\n1-16周[01,03,05节]'),...Array.from({length:6},()=>cell()))]}]});
  assert.deepEqual(out.courses.map(c=>[c.start,c.end]),[[1,1],[3,3],[5,5]]);
});
test('三节课的完整导入：明确节次优先于两节一组的行标题',()=>{
  const out=C.parseSchoolSnapshot({tables:[{rows:[header,row(cell('第1-2节'),cell('三节实验\n王老师\n1-16周[01,02,03节]\n实验楼101'),...Array.from({length:6},()=>cell()))]}]});
  assert.deepEqual([out.courses[0].day,out.courses[0].start,out.courses[0].end],[1,1,3]);
});
test('无明确节次的跨三行课程根据各行节次恢复长度与星期',()=>{
  const rows=[row(cell('时段'),cell('节次'),...['一','二','三','四','五','六','日'].map(d=>cell('星期'+d))),
    row(cell('上午',{rowSpan:3}),cell('1'),cell('跨三行课程\n1-16周',{rowSpan:3}),cell('星期二课程甲\n1-16周'),...Array.from({length:5},()=>cell())),
    row(cell('2'),cell('星期二课程乙\n1-16周'),...Array.from({length:5},()=>cell())),
    row(cell('3'),cell('星期二课程丙\n1-16周'),...Array.from({length:5},()=>cell()))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.deepEqual([out.courses[0].day,out.courses[0].start,out.courses[0].end],[1,1,3]);
  assert.deepEqual(out.courses.slice(1).map(c=>[c.day,c.start,c.end]),[[2,1,1],[2,2,2],[2,3,3]]);
});
test('rowspan=0 占据剩余行，不能挤偏后续课程的星期列',()=>{
  const out=C.parseSchoolSnapshot({tables:[{rows:[header,row(cell('1'),cell('跨行课\n1-16周',{rowSpan:0}),cell(),...Array.from({length:5},()=>cell())),row(cell('2'),cell('第二天课程\n1-16周'),...Array.from({length:5},()=>cell())),row(cell('3'),cell(),...Array.from({length:5},()=>cell()))]}]});
  assert.deepEqual([out.courses[0].day,out.courses[0].start,out.courses[0].end],[1,1,3]);assert.equal(out.courses[1].day,2);
});
test('带日期的星期标题和跨多个星期的模糊格子',()=>{
  const datedHeader=row(cell('节次'),...['一','二','三','四','五','六','日'].map(d=>cell('星期'+d+'\n2026-10-22')));
  const out=C.parseSchoolSnapshot({tables:[{rows:[datedHeader,row(cell('1-3'),cell('可确认课程\n1-16周'),cell('跨两天的未确认内容\n1-16周',{colSpan:2}),...Array.from({length:4},()=>cell()))]}]});
  assert.equal(out.courses.length,1);assert.equal(out.warnings.length,1);assert.match(out.warnings[0],/跨越多个星期/);
});
test('强智单元格：带标签的教师、教室、单周和精确节次',()=>{
  const snapshot={tables:[{rows:[header,row(cell('1-2'),cell('高等数学\n【教师】王老师\n【周次】1-16(单周)[01-02节]\n【地点】教三-201'),...Array.from({length:6},()=>cell()))]}]};
  const out=C.parseSchoolSnapshot(snapshot);assert.equal(out.courses.length,1);const c=out.courses[0];
  assert.equal(c.teacher,'王老师');assert.equal(c.room,'教三-201');assert.deepEqual(c.weeks,[1,3,5,7,9,11,13,15]);assert.deepEqual([c.day,c.start,c.end],[1,1,2]);assert.deepEqual(out.warnings,[]);
});
test('强智一个格子中的多门课与分段周次',()=>{
  const snapshot={tables:[{rows:[header,row(cell('第3-4节'),cell('大学英语\n张老师\n1-8周,10-16周[03-04节]\n教二305\n---\n大学英语\n张老师\n9(周)[03-04节]\n教二306'),...Array.from({length:6},()=>cell()))]}]};
  const out=C.parseSchoolSnapshot(snapshot);assert.equal(out.courses.length,2);assert.equal(out.courses[0].weeks.includes(9),false);assert.equal(out.courses[0].weeks.includes(16),true);assert.deepEqual(out.courses[1].weeks,[9]);assert.equal(out.courses[0].teacher,'张老师');
});
test('rowspan 不应导致星期列错位',()=>{
  const data={tables:[{rows:[header,row(cell('第1-2节'),cell('课程甲\n1-16周[01-04节]',{rowSpan:2}),cell('课程乙\n1-16周[01-02节]'),...Array.from({length:5},()=>cell())),row(cell('第3-4节'),cell('课程丙\n1-16周[03-04节]'),...Array.from({length:5},()=>cell()))]}]};
  const out=C.parseSchoolSnapshot(data);assert.equal(out.courses.length,3);assert.equal(out.courses.find(c=>c.name==='课程丙').day,2);assert.equal(out.courses.find(c=>c.name==='课程甲').end,4);
});
test('colspan 题头与同课程重复表格',()=>{
  const rows=[row(cell('学期课表',{colSpan:8})),header,row(cell('1-2'),cell('离散数学\n1-8周'),...Array.from({length:6},()=>cell()))];
  const out=C.parseSchoolSnapshot({tables:[{rows},{rows}]});assert.equal(out.courses.length,1);
});
test('部分单元格缺少周次：保留可识别课程并明确报告',()=>{
  const out=C.parseSchoolSnapshot({tables:[{rows:[header,row(cell('1-2'),cell('离散数学\n1-16周'),cell('未确认周次的课程\n某教室'),...Array.from({length:5},()=>cell()))]}]});
  assert.equal(out.courses.length,1);assert.equal(out.warnings.length,1);assert.match(out.warnings[0],/无法识别周次/);
});
test('登录页面或空课表不会导出空集合覆盖已有课表',()=>{
  assert.throws(()=>C.parseSchoolSnapshot({tables:[]}),/未识别到/);
  assert.throws(()=>C.parseSchoolSnapshot({tables:[{rows:[header,row(...Array.from({length:8},()=>cell()))]}]}),/没有可导入/);
});
test('CSV 支持中文表头、带逗号周次、引号与换行',()=>{
  const csv='课程名称,星期,开始节次,结束节次,周次,教室,教师,备注\r\n"算法,设计",2,3,4,"1-3,5",教三201,王老师,"带有""引号""\n的备注"';
  const [c]=C.parseCSV(csv);assert.equal(c.name,'算法,设计');assert.deepEqual(c.weeks,[1,2,3,5]);assert.equal(c.note,'带有"引号"\n的备注');assert.equal(c.day,2);
  assert.throws(()=>C.parseCSV('课程名称,星期\n测试,1'),/需包含/);
  assert.throws(()=>C.parseCSV('"未闭合'),/引号未闭合/);
});
test('冲突检查同时考虑星期、节次和周次',()=>{
  assert.equal(C.conflicts(C.normalizeCourses([course(),course({name:'另一门课',start:2,end:3})])).length,1);
  assert.equal(C.conflicts(C.normalizeCourses([course({weeks:'1-16单周'}),course({name:'另一门课',weeks:'1-16双周'})])).length,0);
  assert.equal(C.conflicts(C.normalizeCourses([course(),course({name:'另一门课',day:2})])).length,0);
});
test('备份验证：无效节次不得被接受，重复ID不能互相覆盖',()=>{
  assert.throws(()=>C.sanitizeState({courses:[course({end:0})]}));
  const result=C.normalizeCourses([course({id:'same'}),course({name:'另一门课',id:'same'})]);assert.notEqual(result[0].id,result[1].id);
  assert.equal(C.normalizeCourses([course(),course()]).length,1);
});
test('正方课表：课程名 / 教师 / 周次 / 节次 / 地点 分行的单元格',()=>{
  const rows=[header,row(cell('第1节'),cell('高等数学A\n张三\n1-16周\n1-2节\n教101'),...Array.from({length:6},()=>cell()))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.equal(out.courses.length,1);
  const c=out.courses[0];
  assert.deepEqual([c.name,c.teacher,c.room,c.day,c.start,c.end],['高等数学A','张三','教101',1,1,2]);
  assert.deepEqual(c.weeks,[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
  assert.deepEqual(out.warnings,[]);
});
test('北邮强智课表（模拟导出）：同一门课的摘要和明细不能拆成两条',()=>{
  const single=[
    '示例理论课',
    '【周次】3-18(周)',
    '【地点】示例楼101',
    '示例理论课',
    '【教师】示例教师甲',
    '【周次】3-18(周)[01-02节]',
    '【地点】示例楼101'
  ].join('\n');
  const withClass=[
    '示例图形课',
    '(B班)',
    '【周次】3-18(周)',
    '【地点】示例楼202室',
    '示例图形课',
    '(B班)',
    '【教师】示例教师乙',
    '【周次】3-18(周)[01-02节]',
    '【地点】示例楼202室'
  ].join('\n');
  const rows=[header,
    row(cell('1'),cell(single),cell(withClass),cell(''),cell(''),cell(''),cell(''),cell(''))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.deepEqual(out.warnings,[]);
  assert.equal(out.courses.length,2);
  const [prob,graphics]=out.courses;
  assert.deepEqual([prob.name,prob.teacher,prob.room,prob.day,prob.start,prob.end],['示例理论课','示例教师甲','示例楼101',1,1,2]);
  assert.deepEqual(prob.weeks,[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]);
  assert.deepEqual([graphics.name,graphics.teacher,graphics.room],['示例图形课','示例教师乙','示例楼202室']);
});
test('北邮强智课表：一格两段不同周次/教室要拆开，备注行不算课表',()=>{
  const twoLectures=[
    '示例课程 P',
    '【周次】7(周)',
    '【地点】示例楼203',
    '----------------------',
    '示例课程 P',
    '【周次】9,11,13(周)',
    '【地点】示例楼204',
    '示例课程 P',
    '【教师】示例教师丙,示例教师丁',
    '【周次】7(周)[01-02节]',
    '【地点】示例楼203',
    '---------------------',
    '示例课程 P',
    '【教师】示例教师丙,示例教师丁',
    '【周次】9,11,13(周)[02-03节]',
    '【地点】示例楼204'
  ].join('\n');
  const rows=[header,
    row(cell('1'),cell(twoLectures),cell(''),cell(''),cell(''),cell(''),cell(''),cell('')),
    row(cell('备注:'),cell('示例在线课程 示例临班 3-18周',{colSpan:7}))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.deepEqual(out.warnings,[]);
  assert.equal(out.courses.length,2);
  const [first,second]=out.courses;
  assert.deepEqual([first.name,first.start,first.end,first.weeks,first.room],[ '示例课程 P',1,2,[7],'示例楼203']);
  assert.deepEqual([second.start,second.end,second.weeks,second.room],[2,3,[9,11,13],'示例楼204']);
  assert.equal(second.teacher,'示例教师丙,示例教师丁');
});
test('北化正方课表（模拟导出格式）：整格文字粘连成一行也能拆出课程',()=>{
  // 下面三段使用虚构课程、教师和地点，仅保留导出结构与解析边界
  const cellA='示例程序设计★(1-2节)1-9周,11-13周【地点】示例楼A-101【教师】示例教师示例程序设计-0005示例甲2501;示例甲2502;示例甲2503;示例甲2504;示例乙C2501;示例乙C2502;示例丙2501;示例丙2502;示例丁2501;示例丁2502考查讲课:24,上机:163242.0';
  const cellB='示例实验课程B（I）○(1-4节)11-18周【地点】示例校区未排地点【教师】示例教师戊示例实验课程B（I）-0060示例丁2502考查实验:323321.0示例数学A★(3-4节)1-5周,7-8周【地点】示例楼A-101【教师】示例教师己示例数学A-0006示例乙C2501;示例乙C2502;示例丙2501;示例丙2502;示例丁2501;示例丁2502考试讲课:564563.5';
  const cellC='示例语言课3★(6-7节)1-2周,4-5周,7-8周,11-13周(单),14-16周(双),17周【地点】示例楼D-202【教师】示例教师庚示例语言课3-00312025考试讲课:322322.0示例语言课3★(6-7节)3周,6周,9周,12周,15周【地点】示例楼F-203【教师】示例教师庚示例语言课3-00312025考试讲课:322322.0';
  const rows=[header,
    row(cell('1'),cell(cellA),cell(''),cell(''),cell(''),cell(''),cell(''),cell('')),
    row(cell('2'),cell(''),cell(cellB),cell(''),cell(''),cell(''),cell(''),cell(''))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.deepEqual(out.warnings,[]);
  assert.equal(out.courses.length,3);
  const [c1,c2,c3]=out.courses;
  assert.deepEqual([c1.name,c1.teacher,c1.room,c1.day,c1.start,c1.end],['示例程序设计','示例教师','示例楼A-101',1,1,2]);
  assert.deepEqual(c1.weeks,[1,2,3,4,5,6,7,8,9,11,12,13]);
  assert.deepEqual([c2.name,c2.teacher,c2.room,c2.day,c2.start,c2.end],['示例实验课程B（I）','示例教师戊','示例校区未排地点',2,1,4]);
  assert.deepEqual(c2.weeks,[11,12,13,14,15,16,17,18]);
  assert.deepEqual([c3.name,c3.teacher,c3.start,c3.end],['示例数学A','示例教师己',3,4]);
  assert.deepEqual(c3.weeks,[1,2,3,4,5,7,8]);
  // 同一格两段不同周次 / 地点（模拟的示例语言课3 分两个教室上课）
  const out2=C.parseSchoolSnapshot({tables:[{rows:[header,row(cell('1'),cell(cellC),cell(''),cell(''),cell(''),cell(''),cell(''),cell(''))]}]});
  assert.equal(out2.courses.length,2);
  assert.deepEqual(out2.courses.map(c=>[c.name,c.teacher,c.room]),[['示例语言课3','示例教师庚','示例楼D-202'],['示例语言课3','示例教师庚','示例楼F-203']]);
  assert.deepEqual(out2.courses[0].weeks,[1,2,4,5,7,8,11,13,14,16,17]);
  assert.deepEqual(out2.courses[1].weeks,[3,6,9,12,15]);
});
test('北化正方课表：图标前缀 + 每门课自带周次行 + 无空行分隔',()=>{
  const buctCell=[
    '示例实验课程 B (I) ○',
    '⊙ (1-4节)11-18周',
    '📍 示例校区 未排地点',
    '👤 示例教师戊',
    '🏫 示例实验课程 B (I) -0060',
    '🏛 示例丁2502',
    '⚙ 考察',
    '⚙',
    '⚙ 实验:32',
    '⚙ 3',
    '⚙ 32',
    '⚙ 1.0',
    '示例数学A★',
    '⊙ (3-4节)1-5周,7-8周',
    '📍 示例楼 A-101',
    '👤 示例教师辛',
    '🏫 示例数学A -0061',
    '🏛 示例丁2502',
    '⚙ 考察',
    '⚙ 1.5'
  ].join('\n');
  const rows=[header,row(cell('第1节'),cell(buctCell),...Array.from({length:6},()=>cell()))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.equal(out.courses.length,2,'一格两门课应拆成两条安排');
  const chem=out.courses[0],lin=out.courses[1];
  assert.equal(chem.name,'示例实验课程 B (I)');
  assert.deepEqual([chem.day,chem.start,chem.end],[1,1,4]);
  assert.deepEqual(chem.weeks,[11,12,13,14,15,16,17,18]);
  assert.equal(chem.teacher,'示例教师戊');
  assert.equal(chem.room,'示例校区 未排地点');
  assert.equal(lin.name,'示例数学A');
  assert.deepEqual([lin.start,lin.end],[3,4]);
  assert.deepEqual(lin.weeks,[1,2,3,4,5,7,8]);
  assert.equal(lin.teacher,'示例教师辛');
  assert.equal(lin.room,'示例楼 A-101');
  assert.deepEqual(out.warnings,[]);
});
test('正方课表：一个格子用空行分隔两门课、单周写法与空格标签',()=>{
  const twoCourses=cell('大学英语\n李四\n1-8周\n3-4节\n教201\n\n数据结构\n王五\n1-16周(单)\n5-6节\n地点 实验楼301');
  const rows=[header,row(cell('第3节'),twoCourses,...Array.from({length:6},()=>cell()))];
  const out=C.parseSchoolSnapshot({tables:[{rows}]});
  assert.equal(out.courses.length,2);
  const english=out.courses.find(c=>c.name==='大学英语'),data=out.courses.find(c=>c.name==='数据结构');
  assert.deepEqual([english.teacher,english.room,english.start,english.end],['李四','教201',3,4]);
  assert.deepEqual(english.weeks,[1,2,3,4,5,6,7,8]);
  assert.deepEqual([data.teacher,data.room],[ '王五','实验楼301']);
  assert.deepEqual(data.weeks,[1,3,5,7,9,11,13,15]);
});
test('学校预设：北邮强智与北化正方入口，其余选项已移除',()=>{
  assert.deepEqual(C.SCHOOL_PRESETS.map(p=>p.id),['generic','bupt','buct']);
  const bupt=C.schoolPreset('bupt'),buct=C.schoolPreset('buct');
  assert.equal(bupt.url,'https://jwgl.bupt.edu.cn/');
  assert.match(bupt.label,/北京邮电大学/);
  assert.match(bupt.label,/强智/);
  assert.equal(buct.url,'http://jwglxt.buct.edu.cn');
  assert.match(buct.label,/北京化工大学/);
  assert.match(buct.label,/正方/);
  assert.equal(C.schoolPreset('zhengfang').id,'generic');
  assert.equal(C.schoolPreset('missing').id,'generic');
});
test('旧版内置默认值只迁移一次；之后手填“北京邮电大学”不再被改写',()=>{
  const legacy=C.sanitizeState({version:1,courses:[],settings:{schoolName:'北京邮电大学',schoolUrl:'https://auth.bupt.edu.cn/',semesterStart:'2026-09-07'}});
  assert.equal(legacy.settings.schoolName,'北京邮电大学');
  assert.equal(legacy.settings.schoolPreset,'bupt');
  assert.equal(legacy.settings.schoolUrl,'https://jwgl.bupt.edu.cn/');
  assert.equal(legacy.version,3);
  // 迁移之后保存的 state 带当前版本号：用户手填的学校名与网址必须原样保留
  const edited=C.sanitizeState({version:2,courses:[],settings:{schoolName:'北京邮电大学',schoolUrl:'https://auth.bupt.edu.cn/'}});
  assert.equal(edited.settings.schoolName,'北京邮电大学');
  assert.equal(edited.settings.schoolUrl,'https://auth.bupt.edu.cn/');
  assert.equal(edited.settings.schoolPreset,'generic');
  // 无版本的旧备份按 legacy 处理，自定义学校名不受影响
  const kept=C.sanitizeState({courses:[],settings:{schoolName:'某某大学',schoolUrl:'https://jw.example.edu.cn/'}});
  assert.equal(kept.settings.schoolName,'某某大学');
  assert.equal(kept.settings.schoolUrl,'https://jw.example.edu.cn/');
  assert.equal(C.defaultState().settings.schoolName,'我的学校');
  assert.equal(C.defaultState().settings.schoolUrl,'');
});
test('旧版单课表升级为一张课表，课程、学期与作息一起迁移',()=>{
  const migrated=C.sanitizeState({version:2,courses:[{name:'高等数学',day:1,start:1,end:2,weeks:'1-16'}],settings:{semesterStart:'2026-09-07',semesterConfigured:true,totalWeeks:18,periods:15,times:['08:00-08:45','08:50-09:35'],theme:'night',background:'none',cardOpacity:70,schoolName:'某某大学'}});
  assert.equal(migrated.version,3);
  assert.equal(migrated.timetables.length,1);
  const t=migrated.timetables[0];
  assert.equal(t.courses.length,1);
  assert.equal(t.semesterStart,'2026-09-07');
  assert.equal(t.semesterConfigured,true);
  assert.equal(t.totalWeeks,18);
  assert.equal(t.periods,15);
  assert.equal(t.times.length,2);
  assert.equal(t.name,'2026 秋季学期');
  // 主题/背景/学校属于全局设置
  assert.equal(migrated.settings.theme,'night');
  assert.equal(migrated.settings.background,'none');
  assert.equal(migrated.settings.cardOpacity,70);
  assert.equal(migrated.settings.schoolName,'某某大学');
  assert.equal(migrated.activeId,t.id);
});
test('多张课表：各自保留课程与学期，activeId 决定当前课表',()=>{
  const raw={version:3,activeId:'tb',timetables:[
    {id:'ta',name:'2026 秋季学期',semesterStart:'2026-09-07',semesterConfigured:true,totalWeeks:18,periods:12,times:['08:00-08:45'],courses:[{name:'高等数学',day:1,start:1,end:2,weeks:'1-16'}]},
    {id:'tb',name:'2027 春季学期',semesterStart:'2027-02-22',semesterConfigured:true,totalWeeks:20,periods:12,times:['08:00-08:45'],courses:[{name:'大学英语',day:2,start:3,end:4,weeks:'1-16'}]}
  ],settings:{schoolName:'某某大学',theme:'sakura'}};
  const state=C.sanitizeState(raw);
  assert.equal(state.timetables.length,2);
  assert.equal(state.activeId,'tb');
  assert.deepEqual(state.timetables.map(t=>t.name),['2026 秋季学期','2027 春季学期']);
  assert.deepEqual(state.timetables.map(t=>t.courses.map(c=>c.name)),[['高等数学'],['大学英语']]);
  assert.deepEqual(state.timetables.map(t=>t.semesterStart),['2026-09-07','2027-02-22']);
  assert.equal(state.settings.theme,'sakura');
  assert.equal(state.settings.schoolName,'某某大学');
  // 课程不会在课表之间串味
  assert.notEqual(state.timetables[0].courses[0].id,state.timetables[1].courses[0].id);
});
test('多张课表的边界：非法 activeId、重复 id、空列表与数量上限',()=>{
  const fallback=C.sanitizeState({version:3,activeId:'missing',timetables:[{id:'ta',name:'A'},{id:'tb',name:'B'}]});
  assert.equal(fallback.activeId,'ta');
  const dupes=C.sanitizeState({version:3,timetables:[{id:'same',name:'A'},{id:'same',name:'B'}]});
  assert.equal(dupes.timetables.length,2);
  assert.notEqual(dupes.timetables[0].id,dupes.timetables[1].id);
  const empty=C.sanitizeState({version:3,timetables:[]});
  assert.equal(empty.timetables.length,1);
  const many=C.sanitizeState({version:3,timetables:Array.from({length:30},(_,i)=>({name:'课表 '+(i+1)}))});
  assert.equal(many.timetables.length,12);
});
test('学期名称按开学日期推断季节',()=>{
  assert.equal(C.semesterName('2026-09-07'),'2026 秋季学期');
  assert.equal(C.semesterName('2027-01-11'),'2026 秋季学期');
  assert.equal(C.semesterName('2027-02-22'),'2027 春季学期');
  assert.equal(C.semesterName('2027-07-05'),'2027 春季学期');
});
test('教学周和日期校验：周日仍属于同一周，周一进入下一周',()=>{
  assert.equal(C.weekAt('2026-09-07',new Date(2026,8,13)),1);
  assert.equal(C.weekAt('2026-09-07',new Date(2026,8,14)),2);
  assert.throws(()=>C.parseDate('2026-02-30'));
  assert.equal(C.validTimeRange('08:00-08:45'),true);assert.equal(C.validTimeRange('08:45-08:00'),false);assert.equal(C.validTimeRange('25:00-26:00'),false);
});
