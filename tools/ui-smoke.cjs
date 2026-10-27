const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
  const output=path.join(__dirname,'../build/qa');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href);
  await page.getByRole('heading',{name:'新学期，从这里开始'}).waitFor();
  await page.screenshot({path:path.join(output,'01-empty.png')});
  await page.getByRole('button',{name:'先看看装扮效果 →'}).click();
  assert.equal(await page.locator('.course-card').count(),8);
  await page.screenshot({path:path.join(output,'02-demo.png')});
  // 顶部两栏：各有一个标签行（内含倒计时位置）、课程名与说明，整块带用于刷新的签名。
  assert.equal(await page.locator('.next-class').evaluate(n=>n.children.length),2);
  assert.equal(await page.locator('.next-class .next-tag').count(),2);
  assert.ok(await page.locator('.next-half').evaluateAll(ns=>ns.every(n=>n.querySelector('.next-tag')&&n.querySelector('strong')&&n.querySelector('small'))));
  assert.ok(await page.locator('.next-class').getAttribute('data-bar'));
  await page.getByRole('button',{name:'退出示例',exact:true}).click();
  await page.locator('[data-action="add"]').first().click();
  await page.locator('#course-form [name="name"]').fill('本地保存验证');
  await page.locator('#course-form [name="room"]').fill('教三 201');
  await page.locator('#course-form [name="weeks"]').fill('1-16单周');
  await page.getByRole('button',{name:'保存课程',exact:true}).click();
  assert.equal(await page.locator('.course-card').count(),1);
  await page.reload();
  assert.equal(await page.locator('.course-card').count(),1);
  await page.locator('#navigation [data-tab="theme"]').click();
  await page.locator('[data-theme="sakura"]').click();
  // 换主题走 View Transition，新主题在下一帧才生效
  await page.waitForFunction(()=>document.body.dataset.theme==='sakura');
  await page.screenshot({path:path.join(output,'03-themes.png')});
  await page.locator('[data-theme="night"]').click();
  await page.screenshot({path:path.join(output,'04-night.png')});
  await page.locator('#navigation [data-tab="import"]').click();
  await page.screenshot({path:path.join(output,'05-import.png')});
  const activeTimetable=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('xingyu-state'));return s.timetables.find(t=>t.id===s.activeId);});
  await page.evaluate(()=>window.receiveImportFile('课程名称,星期,开始节次,结束节次,周次,教室,教师\nCSV导入验证,2,3,4,"1-8,10-16",教二305,示例教师'));
  await page.getByRole('heading',{name:'核对导入结果'}).waitFor();
  assert.equal(await page.locator('.preview-course').count(),1);
  await page.locator('#import-target').selectOption('replace');
  await page.locator('[data-action="confirm-import"]').click();
  let current=await activeTimetable();
  assert.equal(current.courses.length,1);assert.equal(current.courses[0].name,'CSV导入验证');
  await page.locator('#navigation [data-tab="settings"]').click();
  await page.locator('[data-action="undo-import"]').click();
  await page.locator('#confirm-button').click();
  current=await activeTimetable();
  assert.equal(current.courses[0].name,'本地保存验证');
  await page.evaluate(text=>window.receiveImportFile(text),fs.readFileSync(path.join(__dirname,'../examples/qiangzhi-demo.html'),'utf8'));
  assert.equal(await page.locator('.preview-course').count(),3);
  await page.locator('[data-action="close"]').click();
  // 正方 demo: one cell holds two courses separated by a blank line, one of them is 单周.
  await page.evaluate(text=>window.receiveImportFile(text),fs.readFileSync(path.join(__dirname,'../examples/zhengfang-demo.html'),'utf8'));
  assert.equal(await page.locator('.preview-course').count(),4);
  const zfText=await page.locator('.import-preview').innerText();
  assert.ok(zfText.includes('实验楼301')&&zfText.includes('教305'),'正方合并单元格拆分');
  assert.ok(zfText.includes('1,3,5,7,9,11,13,15'),'正方单周');
  await page.locator('[data-action="close"]').click();
  // 多张课表：导入时选“新建”，原课表保留，可以从课表切换器来回切
  await page.locator('#navigation [data-tab="import"]').click();
  await page.evaluate(()=>window.receiveImportFile('课程名称,星期,开始节次,结束节次,周次,教室,教师\n下学期课程,1,1,2,"1-20",教101,示例教师'));
  await page.getByRole('heading',{name:'核对导入结果'}).waitFor();
  assert.equal(await page.locator('#import-target').inputValue(),'new');
  await page.locator('#new-timetable-name').fill('2027 春季学期');
  await page.locator('[data-action="confirm-import"]').click();
  let multi=await page.evaluate(()=>JSON.parse(localStorage.getItem('xingyu-state')));
  assert.equal(multi.timetables.length,2,'新建课表后应当有两张');
  assert.equal(multi.timetables[0].courses[0].name,'本地保存验证');
  assert.equal(multi.timetables[1].name,'2027 春季学期');
  assert.equal(multi.timetables[1].courses[0].name,'下学期课程');
  assert.equal(multi.activeId,multi.timetables[1].id);
  assert.ok((await page.locator('.timetable-chip').innerText()).includes('2027 春季学期'));
  await page.screenshot({path:path.join(output,'07-two-timetables.png')});
  await page.locator('.timetable-chip').click();
  assert.equal(await page.locator('.timetable-item').count(),2);
  await page.screenshot({path:path.join(output,'08-timetable-sheet.png')});
  await page.locator('.timetable-main').first().click();
  multi=await page.evaluate(()=>JSON.parse(localStorage.getItem('xingyu-state')));
  assert.equal(multi.activeId,multi.timetables[0].id);
  assert.equal(await page.locator('.course-card').count(),1,'切回第一张课表应只显示它自己的课程');
  // 整份备份恢复：带 timetables 的文件走“恢复全部课表”流程
  const snapshot=await page.evaluate(()=>localStorage.getItem('xingyu-state'));
  await page.evaluate(text=>window.receiveImportFile(text),snapshot);
  await page.getByRole('heading',{name:'恢复整份备份'}).waitFor();
  assert.equal(await page.locator('.preview-course').count(),2);
  await page.locator('[data-action="confirm-restore"]').click();
  const restoredAll=await page.evaluate(()=>JSON.parse(localStorage.getItem('xingyu-state')));
  assert.equal(restoredAll.timetables.length,2,'恢复备份后课表数量应保持');
  // School presets: 北邮 强智 与 北化 正方 各自预填网址，徽标跟着变。
  await page.locator('#navigation [data-tab="import"]').click();
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#school-preset option')].map(o=>o.value)),['generic','bupt','buct']);
  await page.locator('#school-preset').selectOption('bupt');
  assert.equal(await page.locator('#school-url').inputValue(),'https://jwgl.bupt.edu.cn/');
  assert.ok((await page.locator('.import-hero .badge').innerText()).includes('强智'));
  await page.locator('#school-preset').selectOption('buct');
  assert.equal(await page.locator('#school-url').inputValue(),'http://jwglxt.buct.edu.cn');
  assert.ok((await page.locator('.import-hero .badge').innerText()).includes('正方'));
  await page.locator('#school-preset').selectOption('generic');
  // 回归：设置里手填“北京邮电大学”必须原样保存，不能被旧默认值迁移逻辑改写。
  await page.locator('#navigation [data-tab="settings"]').click();
  await page.locator('[data-action="school-name"]').click();
  await page.fill('#school-name-form [name="name"]','北京邮电大学');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.reload();
  const savedName=await page.evaluate(()=>JSON.parse(localStorage.getItem('xingyu-state')).settings.schoolName);
  assert.equal(savedName,'北京邮电大学','手填的学校名被改写');
  // 设置页底部显示跟随 version.properties 的版本号与创作者水印
  await page.locator('#navigation [data-tab="settings"]').click();
  const footerText=await page.locator('.settings-footer').innerText();
  assert.ok(/星屿课表 v\d+\.\d+\.\d+/.test(footerText),'设置页应显示版本号');
  assert.ok(footerText.includes('暗物质鞭炮'),'设置页应有创作者水印');
  // Input values, scripts, and hidden login forms must not be captured by the school extractor.
  const school=await context.newPage();await school.setContent('<form><input value="private-password"></form><table><tr><td>星期一</td></tr><tr><td>课程甲<br><span title="教师">王老师</span><br>1-16周[01-02节]<br><span title="教室">教三201</span></td></tr></table>');
  const script=require('../app/src/main/assets/core.js').snapshotScript();
  const captured=await school.evaluate(script);assert.ok(!captured.includes('private-password'));assert.ok(captured.includes('【教师】'));assert.ok(captured.includes('教三201'));
  // 北化正方：字段是行内 span，中间只有空图标（display:block），没有任何 <br>。
  // 抽取必须按渲染坐标换行，否则整格文字会粘连成一行。
  const buctPage=await context.newPage();
  await buctPage.setContent([
    '<style>td{width:150px;vertical-align:top} .ic{display:block;height:8px}</style>',
    '<table><tr><td>节次</td><td>星期一</td><td>星期二</td><td>星期三</td><td>星期四</td><td>星期五</td><td>星期六</td><td>星期日</td></tr>',
    '<tr><td>第1节</td><td>',
    '<i class="ic"></i><span>示例程序设计★</span>',
    '<i class="ic"></i><span>(1-2节)1-9周,11-13周</span>',
    '<i class="ic"></i><span title="地点">示例楼-A-101</span>',
    '<i class="ic"></i><span title="教师">示例教师</span>',
    '<i class="ic"></i><span>示例程序设计-0005</span>',
    '<i class="ic"></i><span>考查</span>',
    '<i class="ic"></i><span>2.0</span>',
    '<i class="ic"></i><span>示例数学A★</span>',
    '<i class="ic"></i><span>(3-4节)1-5周,7-8周</span>',
    '<i class="ic"></i><span title="地点">示例楼 A-101</span>',
    '<i class="ic"></i><span title="教师">示例教师辛</span>',
    '<i class="ic"></i><span>考试</span>',
    '</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>'
  ].join(''));
  const buctCaptured=JSON.parse(await buctPage.evaluate(script));
  const buctCellText=buctCaptured.tables[0].rows[1].cells[1].text;
  assert.ok(buctCellText.split('\n').filter(Boolean).length>=10,'行内字段应按渲染坐标各占一行');
  const buctParsed=require('../app/src/main/assets/core.js').parseSchoolSnapshot(buctCaptured);
  assert.equal(buctParsed.courses.length,2,'一格两门课应拆成两条');
  assert.deepEqual(buctParsed.courses.map(c=>[c.name,c.teacher,c.room]),[['示例程序设计','示例教师','示例楼-A-101'],['示例数学A','示例教师辛','示例楼 A-101']]);
  assert.deepEqual(buctParsed.courses.map(c=>[c.start,c.end,c.weeks.length]),[[1,2,12],[3,4,7]]);
  // File-derived text is displayed as text, including characters that resemble HTML.
  await page.locator('#navigation [data-tab="import"]').click();
  await page.evaluate(()=>window.receiveImportFile(JSON.stringify({courses:[{name:'<img src=x onerror=alert(1)>',day:1,start:1,end:2,weeks:'1-16'}]})));
  assert.equal(await page.locator('.preview-course img').count(),0);assert.ok((await page.locator('.preview-course').innerText()).includes('<img'));
  await page.locator('[data-action="close"]').click();
  // All main screens must fit the phone width.
  for(const tab of ['schedule','import','theme','settings']){await page.locator('#navigation [data-tab="'+tab+'"]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow: '+tab);}
  // 仓库入口在小屏幕上完整可读，并能导航到正确地址。
  const repositoryUrl='https://github.com/dmbanger/xingyu-schedule';
  const repositoryLink=page.getByRole('link',{name:'GitHub 项目仓库（在浏览器中打开）'});
  assert.equal(await repositoryLink.getAttribute('href'),repositoryUrl);
  assert.ok((await page.locator('.settings-footer').innerText()).includes('v0.4.11'));
  for(const width of [320,360,393]){
    await page.setViewportSize({width,height:852});
    await repositoryLink.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Repository link overflow: '+width);
    const bounds=await repositoryLink.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height>=44);
  }
  await page.screenshot({path:path.join(output,'09-repository-link.png')});
  await page.route(repositoryUrl,route=>route.fulfill({contentType:'text/html',body:'<title>项目仓库</title><p>GitHub 项目仓库</p>'}));
  await repositoryLink.click();await page.waitForURL(repositoryUrl);
  await page.goBack();
  await page.setViewportSize({width:360,height:740});
  await page.locator('#navigation [data-tab="schedule"]').click();await page.locator('[data-action="week-picker"]').click();await page.screenshot({path:path.join(output,'06-small-phone.png')});
  const mobile=await browser.newContext({viewport:{width:393,height:852},isMobile:true,deviceScaleFactor:2});
  const desktopTest=await mobile.newPage();await desktopTest.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><h1>教务页面</h1><table><tr><td>课表</td></tr></table>');
  assert.ok(await desktopTest.evaluate(()=>innerWidth<500));
  await desktopTest.evaluate(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/desktop-viewport.js'),'utf8'));
  await desktopTest.waitForFunction(()=>innerWidth>=1280);assert.equal(await desktopTest.locator('meta[name="viewport"]').getAttribute('content'),'width=1280');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'ui-smoke-result.json'),JSON.stringify({passed:true,checks:['empty state','demo isolation','course creation','reload persistence','themes','CSV preview and replace','import rollback','强智 demo import','正方 demo import with 单周 and merged cell','multi timetable: import as new, switch back keeps both','multi timetable backup restore','school presets: 北邮强智 + 北化正方 prefill and badges','manually typed school name survives reload','school extractor excludes form values','untrusted text rendering','phone widths','repository link: small-screen layout and navigation'],pageErrors:errors},null,2));
  console.log('UI smoke: 17 flows passed; screenshots: '+output);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
