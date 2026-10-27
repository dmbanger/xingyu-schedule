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
  // 1) 10:20：连堂课第 3 节，胶囊倒数 15 分钟后课间，上方小字是 65 分钟后下课；下一堂还有 70 分钟上课。
  assert.equal(await count('.next-now .next-count'),'距课间 15 分钟');
  assert.equal(await count('.next-now .next-total'),'距下课 65 分钟');
  assert.equal(await count('.next-up .next-count'),'70 分钟后');
  assert.equal(await count('.next-now strong'),'计算机网络');
  assert.equal(await count('.next-up strong'),'高等数学');
  assert.ok(await tagRowFits('.next-now .next-tag')&&await tagRowFits('.next-up .next-tag'),'tag 行不应溢出');
  await page.screenshot({path:path.join(output,'01-countdown.png')});
  // 2) 从后台回到前台：不依赖定时器，visibilitychange 立刻补一次文案。
  await page.evaluate(()=>window.__advance(5*60000));
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await count('.next-now .next-count'),'距课间 10 分钟');
  assert.equal(await count('.next-now .next-total'),'距下课 60 分钟');
  assert.equal(await count('.next-up .next-count'),'65 分钟后');
  // 时间线按节分段：第 3、4 节两段，中间一段课间（5 分钟，按总长 95 分钟的 10% 即 9.5 计宽）；
  // 10:25 走到 35/(45+9.5+45)≈35.18%。
  assert.equal(await page.locator('.next-now .tl-track .tl-seg').count(),2);
  assert.equal(await page.locator('.next-now .tl-track .tl-gap').count(),1);
  assert.equal(await page.locator('.next-now .next-timeline').evaluate(n=>n.style.getPropertyValue('--p')),'35.18%');
  // 2b) 10:37：连堂课第 3、4 节之间的课间，标签换成「课间」，倒计时数到 10:40 继续上课，课间那段在呼吸。
  await page.evaluate(()=>window.__advance(12*60000));
  await page.evaluate(()=>window.tickNextBar());
  assert.ok((await count('.next-now .next-label')).includes('课间'));
  assert.equal(await count('.next-now strong'),'计算机网络');
  assert.equal(await count('.next-now .next-count'),'还剩 3 分钟');
  assert.equal(await count('.next-now .next-total'),'距下课 48 分钟');
  assert.ok((await count('.next-now small')).includes('第 4 节 10:40 继续'));
  assert.equal(await page.locator('.next-now .tl-track .tl-gap.now').count(),1);
  await page.screenshot({path:path.join(output,'01b-break.png')});
  // 3) 11:23 回到上课状态（课间 → 上课会整栏重绘一次）；到 11:24 两个倒计时同时变短，且不重绘整页。
  await page.evaluate(()=>window.__advance(46*60000));
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await count('.next-now .next-label'),'正在上');
  // 第 4 节是这门课最后一节，后面没有课间：胶囊直接倒数下课，不再显示上方小字。
  assert.equal(await page.locator('.next-now .next-total').count(),0);
  await page.locator('.next-class').evaluate(n=>{n.dataset.keep=n.id;window.__bar=n;});
  await page.evaluate(()=>window.__advance(60*1000));
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await count('.next-now .next-count'),'即将下课','剩余 1 分钟显示即将下课');
  assert.equal(await count('.next-up .next-count'),'6 分钟后');
  assert.equal(await page.evaluate(()=>window.__bar===document.querySelector('.next-class')),true,'仅更新时间文案，不重建节点');
  // 3) 11:25 下课：第 4、5 节之间是课间且第 5 节有课，「正在上」换成课间休息；「下一堂」仍是 11:30 的那门课。
  await page.evaluate(()=>window.__advance(60*1000));
  await page.evaluate(()=>window.tickNextBar());
  assert.equal(await count('.next-now strong'),'课间休息');
  assert.equal(await count('.next-now .next-count'),'还剩 5 分钟');
  assert.ok((await count('.next-now small')).includes('计算机网络 已下课'));
  assert.equal(await page.locator('.next-now .tl-track .tl-seg').count(),2);
  assert.equal(await count('.next-up .next-count'),'5 分钟后');
  await page.screenshot({path:path.join(output,'01c-gap.png')});
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
  fs.writeFileSync(path.join(output,'countdown-result.json'),JSON.stringify({passed:true,checks:['ongoing minutes left','segmented timeline','break inside a double period','break before the next class','next class minutes away','in-place tick without re-render','class end swaps halves','next class on another day hides countdown','off-semester hides countdown'],pageErrors:errors},null,2));
  console.log('Countdown checks passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
