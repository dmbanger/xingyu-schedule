const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const output=path.join(__dirname,'../build/qa/012');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true,deviceScaleFactor:2,locale:'zh-CN'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);
  await page.goto(pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href);
  await page.getByRole('button',{name:'先看看装扮效果 →'}).click();
  const week=async()=>+(await page.locator('.week-current').innerText()).match(/\d+/)[0];
  async function touchSwipe(x1,y1,x2,y2){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1,id:0}]});
    for(let i=1;i<=8;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*i/8,y:y1+(y2-y1)*i/8,id:0}]});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const grid=await page.locator('.timetable').boundingBox(),y=grid.y+92;
  const headerHeight=await page.locator('.app-header').evaluate(n=>n.getBoundingClientRect().height);
  assert.ok(headerHeight<=44,'Header must fit in 44 CSS px');
  assert.ok((await page.locator('#wallpaper').evaluate(n=>getComputedStyle(n).backgroundImage)).includes('wallpaper.png'));
  assert.equal(await week(),1);
  await touchSwipe(330,y,90,y+3);assert.equal(await week(),2,'Left swipe advances a week');
  assert.equal(await page.locator('#sheet').evaluate(n=>n.open),false,'Swipe must not open a course');
  await touchSwipe(90,y,330,y+2);assert.equal(await week(),1,'Right swipe goes back');
  await touchSwipe(90,y,330,y);assert.equal(await week(),1,'Cannot move before week one');
  await page.locator('[data-action="week-picker"]').click();await page.locator('[data-action="set-week"][data-week="20"]').click();
  await touchSwipe(330,y,90,y);assert.equal(await week(),20,'Cannot move beyond final week');
  await page.locator('[data-action="week-picker"]').click();await page.locator('[data-action="set-week"][data-week="1"]').click();
  // A vertical drag scrolls the timetable without changing the academic week.
  await touchSwipe(230,grid.y+260,233,grid.y+70);assert.equal(await week(),1);
  await page.waitForFunction(()=>document.querySelector('#content').scrollTop>20);
  await page.screenshot({path:path.join(output,'swipe-and-scroll.png')});
  // Wait for the normal short post-swipe click guard before a deliberate tap.
  await page.waitForTimeout(450);
  await page.locator('.course-card').first().click();assert.equal(await page.locator('#sheet').evaluate(n=>n.open),true);
  await page.locator('[data-action="close"]').click();
  // Native multi-touch is treated as zoom/cancel, not as a week change.
  await page.locator('.timetable').scrollIntoViewIfNeeded();
  const pinchGrid=await page.locator('.timetable').boundingBox(),py=Math.max(pinchGrid.y+80,170);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:py,id:1},{x:240,y:py,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:125,y:py,id:1},{x:265,y:py,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await week(),1);
  // Background is the exact supplied PNG, not a generated or recompressed image.
  const bundled=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/wallpaper.png'));
  if(process.env.XINGYU_WALLPAPER_SOURCE)assert.deepEqual(bundled,fs.readFileSync(process.env.XINGYU_WALLPAPER_SOURCE));
  assert.equal(fs.existsSync(path.join(__dirname,'../app/src/main/assets/wallpaper.jpg')),false);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'swipe-result.json'),JSON.stringify({passed:true,headerHeight,checks:['left/right week changes','first/last week boundaries','vertical scrolling','swipe does not trigger course taps','normal course tap','multi-touch does not change weeks','exact replacement wallpaper'],pageErrors:errors},null,2));
  console.log('Swipe checks passed; header height: '+headerHeight+' CSS px');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
