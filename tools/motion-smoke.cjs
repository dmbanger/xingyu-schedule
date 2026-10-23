const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const output=path.join(__dirname,'../build/qa/013');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:2,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);
  await page.goto(pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href);
  await page.getByRole('button',{name:'先看看装扮效果 →'}).click();
  const week=async()=>+(await page.locator('.week-current').innerText()).match(/\d+/)[0];
  const settled=()=>page.waitForFunction(()=>document.querySelectorAll('.week-preview,.week-outgoing,.week-track').length===0&&!document.querySelector('.week-moving'));
  async function drag(x1,y1,x2,y2,end=true){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1,id:0}]});
    for(let i=1;i<=8;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8,id:0}]});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
    if(end)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const box=await page.locator('.week-stage').boundingBox(),y=box.y+100;
  // The old week follows the finger while the correct adjacent week is revealed.
  await drag(330,y,200,y,false);
  assert.equal(await week(),1);assert.equal(await page.locator('.week-preview').getAttribute('data-week'),'2');
  assert.ok(await page.locator('.week-stage>.week-page:not(.week-preview)').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41<-100));
  await page.screenshot({path:path.join(output,'01-follow-finger.png')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80,y,id:0}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await week(),2);assert.ok((await page.locator('#week-feedback').innerText()).includes('2 / 20'));
  assert.equal(await page.locator('.week-outgoing').count(),1);
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*.45;}));
  await page.screenshot({path:path.join(output,'02-page-transition.png')});
  await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));await settled();
  assert.equal(await page.locator('#sheet').evaluate(n=>n.open),false);
  // A short drag snaps back instead of changing the week.
  await drag(250,y,220,y);assert.equal(await week(),2);await settled();assert.equal(await page.locator('.week-page').count(),1);
  // A new navigation can interrupt a running transition without leaving overlays.
  await page.locator('[data-action="next-week"]').click();await page.locator('[data-action="prev-week"]').click();
  assert.equal(await week(),2);await settled();assert.equal(await page.locator('.week-page').count(),1);
  // Today uses the configured semester, returns from a different week and focuses the day.
  await page.evaluate(()=>{
    const s=ScheduleCore.defaultState(),now=new Date(),start=ScheduleCore.monday(now);start.setDate(start.getDate()-21);
    const t=s.timetables[0];
    t.semesterStart=ScheduleCore.dateString(start);t.semesterConfigured=true;
    t.courses=ScheduleCore.normalizeCourses([{id:'today-course',name:'今日课程验证',day:(now.getDay()+6)%7+1,start:1,end:2,weeks:'1-20',room:'测试教室'}]);
    localStorage.setItem('xingyu-state',JSON.stringify(s));
  });
  await page.reload();assert.equal(await week(),4);
  await page.locator('[data-action="week-picker"]').click();await page.locator('[data-action="set-week"][data-week="10"]').click();await settled();
  await page.locator('#today-button').click();assert.equal(await week(),4);await settled();
  await page.waitForFunction(()=>document.querySelector('#week-feedback').textContent.includes('今天'));
  assert.equal(await page.locator('.day.today').count(),1);await page.locator('.course-card').waitFor({state:'visible'});
  const fab=await page.locator('#today-button').boundingBox(),nav=await page.locator('#navigation').boundingBox();
  assert.equal(Math.round(fab.width),48);assert.equal(Math.round(fab.height),48);assert.ok(fab.y+fab.height<nav.y);
  await page.screenshot({path:path.join(output,'03-today-button.png')});
  // Today is only present on the timetable screen.
  await page.locator('[data-tab="theme"]').click();assert.equal(await page.locator('#today-button').isVisible(),false);
  await page.locator('[data-tab="schedule"]').click();assert.equal(await page.locator('#today-button').isVisible(),true);
  // Reduced motion still updates the week and gives a textual page indication.
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-action="next-week"]').click();
  assert.equal(await week(),5);assert.equal(await page.locator('.week-outgoing').count(),0);assert.ok((await page.locator('#week-feedback').innerText()).includes('5 / 20'));
  // Dates outside the semester must not silently jump to its first or last week.
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('xingyu-state')),d=ScheduleCore.monday(new Date());d.setDate(d.getDate()+56);const t=s.timetables.find(x=>x.id===s.activeId);t.semesterStart=ScheduleCore.dateString(d);localStorage.setItem('xingyu-state',JSON.stringify(s));});
  await page.reload();await page.locator('#today-button').click();assert.equal(await week(),1);assert.ok((await page.locator('#toast').innerText()).includes('不在当前学期'));
  await page.evaluate(()=>localStorage.removeItem('xingyu-state'));await page.reload();await page.locator('#today-button').click();await page.locator('#semester-form').waitFor();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'motion-result.json'),JSON.stringify({passed:true,checks:['finger follows and adjacent week preview','animated page settle','short drag snaps back','rapid navigation cleanup','today returns to actual semester week','today focus and circular button position','button hidden outside timetable','reduced motion','out-of-semester and unset-semester handling'],pageErrors:errors},null,2));
  console.log('Motion and today checks passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
