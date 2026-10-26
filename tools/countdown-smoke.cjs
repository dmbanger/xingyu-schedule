// 「正在上 / 下一堂」倒计时验证：固定时钟，检查两种文案、跨课切换、非当天不显示倒计时。
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const output=path.join(__dirname,'../build/qa/countdown');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:2,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // 2026-10-14 是星期三；10:20 正好落在第 3–4 节（09:50–11:25）内。
  await page.addInitScript(()=>{
    const RealDate=Date,base=RealDate.parse('2026-10-14T10:20:00+08:00');let offset=0;
    class FakeDate extends RealDate{
      constructor(...a){if(a.length===0){super(base+offset);}else{super(...a);}}
      static now(){return base+offset;}
    }
    window.Date=FakeDate;
    window.__advance=ms=>{offset+=ms;};
  });
  await page.goto(pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href);
  await page.evaluate(()=>{
    const s=ScheduleCore.defaultState(),t=s.timetables[0],now=new Date(),start=ScheduleCore.monday(now);
    start.setDate(start.getDate()-7);
    t.semesterStart=ScheduleCore.dateString(start);t.semesterConfigured=true;
    t.courses=ScheduleCore.normalizeCourses([
      {id:'cur',name:'计算机网络',day:3,start:3,end:4,weeks:'1-20',room:'教三-301'},
      {id:'up',name:'高等数学',day:3,start:5,end:6,weeks:'1-20',room:'教一-101'},
      {id:'thu',name:'大学英语',day:4,start:1,end:2,weeks:'1-20',room:'教二-204'}
    ]);
    localStorage.setItem('xingyu-state',JSON.stringify(s));
  });
  await page.reload();
  const count=sel=>page.locator(sel).innerText();
  const tagRowFits=sel=>page.locator(sel).evaluate(n=>n.scrollWidth<=n.clientWidth+1);
  // 1) 10:20：正在上还有 65 分钟下课，下一堂还有 70 分钟上课。
  assert.equal(await count('.next-now .next-count'),'还剩 65 分钟');
  assert.equal(await count('.next-up .next-count'),'70 分钟后');
  assert.equal(await count('.next-now strong'),'计算机网络');
  assert.equal(await count('.next-up strong'),'高等数学');
  assert.ok(await tagRowFits('.next-now .next-tag')&&await tagRowFits('.next-up .next-tag'),'tag 行不应溢出');
  await page.screenshot({path:path.join(output,'01-countdown.png')});
  // 2) 从后台回到前台：不依赖定时器，visibilitychange 立刻补一次文案。
  await page.evaluate(()=>window.__advance(5*60000));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await count('.next-now .next-count'),'还剩 60 分钟');
  assert.equal(await count('.next-up .next-count'),'65 分钟后');
  // 3) 到 11:24：两个倒计时同时变短，且不重绘整页。
  await page.evaluate(()=>window.__advance(59*60000));
  await page.locator('.next-class').evaluate(n=>{n.dataset.keep=n.id;window.__bar=n;});
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await count('.next-now .next-count'),'即将下课','剩余 1 分钟显示即将下课');
  assert.equal(await count('.next-up .next-count'),'6 分钟后');
  assert.equal(await page.evaluate(()=>window.__bar===document.querySelector('.next-class')),true,'仅更新时间文案，不重建节点');
  // 3) 11:25 下课：正在上换回占位，「下一堂」自动变成刚才 11:30 的那门课。
  await page.evaluate(()=>window.__advance(60*1000));
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await page.locator('.next-now .next-count').count(),0);
  assert.ok((await count('.next-now strong')).includes('当前时段没有课'));
  assert.equal(await count('.next-up .next-count'),'5 分钟后');
  // 4) 11:31 已上课：下一堂指向更晚的课（明天），因此不再显示“分钟后”。
  await page.evaluate(()=>window.__advance(6*60000));
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await count('.next-now strong'),'高等数学');
  assert.equal(await page.locator('.next-up .next-count').count(),0);
  assert.equal(await count('.next-up strong'),'大学英语');
  await page.screenshot({path:path.join(output,'02-next-day.png')});
  // 5) 停课周之外不显示倒计时。
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('xingyu-state')),t=s.timetables.find(x=>x.id===s.activeId);t.semesterStart=ScheduleCore.dateString(new Date(2026,2,2));localStorage.setItem('xingyu-state',JSON.stringify(s));});
  await page.reload();assert.equal(await page.locator('.next-count').count(),0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'countdown-result.json'),JSON.stringify({passed:true,checks:['ongoing minutes left','next class minutes away','in-place tick without re-render','class end swaps halves','next class on another day hides countdown','off-semester hides countdown'],pageErrors:errors},null,2));
  console.log('Countdown checks passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
