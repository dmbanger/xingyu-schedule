// 星屿网球彩蛋验证：连点十次星星打开、菜单返回、电脑对电脑打完一整局（有回合、有火焰球、先到 7 分）、
// 结束后自动回到设置页，以及竖屏时整体旋转 90° 兜底。
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const output=path.join(__dirname,'../build/qa/tennis');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:853,height:384},deviceScaleFactor:2,locale:'zh-CN',hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'../app/src/main/assets/index.html')).href);
  await page.locator('[data-tab="settings"]').click();
  // 连点十次（间隔 120ms），第十次打开游戏；星星点了偶数次，回到原来的样子
  for(let i=0;i<10;i++){await page.evaluate(()=>document.querySelector('.star-toggle').click());await page.waitForTimeout(120);}
  await page.locator('#tennis .tennis-menu').waitFor();
  // 连点多出来的几下（刚打开时）不应触发任何按钮
  await page.evaluate(()=>{document.querySelector('.tennis-menu [data-mode="cpu"]').click();document.querySelector('.tennis-back').click();});
  assert.equal(await page.locator('#tennis.at-menu').count(),1,'刚打开时的误触不应开局或退出');
  assert.equal(await page.locator('.star-toggle.lit').count(),0);
  await page.screenshot({path:path.join(output,'01-menu.png')});
  // 返回在左上角；菜单刚出现的 0.6 秒内点不动
  await page.waitForTimeout(700);await page.locator('.tennis-back').click();
  assert.equal(await page.locator('#tennis').count(),0);
  assert.equal(await page.locator('#content').getAttribute('data-tab'),'settings');
  // 只有拍面碰到球才算击球：把球直接打向红方身体下半部（拍面够不着的高度），不应算回球
  await page.evaluate(()=>window.XingyuTennis.open({}));await page.waitForTimeout(700);
  await page.locator('.tennis-menu [data-mode="duo"]').click();await page.waitForTimeout(3300);
  const bodyHit=await page.evaluate(async()=>{
    const g=window.XingyuTennis._state(),b=g.ball,p=g.left;
    Object.assign(b,{x:p.x+160,y:p.y-30,vx:-900,vy:0,fire:false,lastHit:g.right,cool:0,bonked:null});
    await new Promise(r=>setTimeout(r,350));
    return {lastHit:b.lastHit&&b.lastHit.side,bonked:b.bonked&&b.bonked.side,vx:b.vx};
  });
  assert.equal(bodyHit.lastHit,'right','球砸在身上不应算红方回球');
  assert.equal(bodyHit.bonked,'left');assert.ok(bodyHit.vx<0,'球应继续往身后滚');
  await page.evaluate(()=>window.XingyuTennis.close());
  // 演示模式：两边都由电脑操作，打完一整局
  await page.evaluate(()=>window.XingyuTennis.open({demo:true,onExit:()=>{window.__exited=true;}}));await page.waitForTimeout(700);
  await page.locator('.tennis-menu [data-mode="duo"]').click();
  // 看台上要有观众坐着，且都在座位范围内
  const crowd=await page.evaluate(()=>window.XingyuTennis._state().crowd.map(c=>({x:c.x,y:c.y,row:c.row})));
  assert.ok(crowd.length>=6,'看台上应有观众');
  assert.ok(crowd.every(c=>c.y===(c.row?382:262)+104-6),'观众应坐在座位里');
  let hits=0,fires=0,lastHit=null,score='0:0',winSeen=false;
  const t0=Date.now();
  while(Date.now()-t0<150000){
    const s=await page.evaluate(()=>{const g=window.XingyuTennis._state();if(!g)return null;const b=g.ball;return {phase:g.phase,l:g.left.score,r:g.right.score,fire:b?b.fire:false,hit:b&&b.lastHit?b.lastHit.side:null};});
    if(!s)break;
    const now=s.l+':'+s.r;if(now!==score){score=now;lastHit=null;}
    if(s.hit&&s.hit!==lastHit){lastHit=s.hit;hits++;if(s.fire)fires++;}
    if(s.phase==='win'&&!winSeen){winSeen=true;await page.screenshot({path:path.join(output,'02-win.png')});}
    await page.waitForTimeout(40);
  }
  const [l,r]=score.split(':').map(Number);
  assert.ok(winSeen,'应当打完一整局');assert.equal(Math.max(l,r),7);
  assert.ok(hits>=10,'应有来回击球');assert.ok(fires>=1,'应至少出现一次火焰球');
  await page.waitForFunction(()=>!document.querySelector('#tennis'),null,{timeout:8000});
  assert.equal(await page.evaluate(()=>window.__exited),true);
  // 竖屏兜底
  await page.setViewportSize({width:384,height:853});
  await page.evaluate(()=>window.XingyuTennis.open({}));
  assert.ok((await page.locator('#tennis').getAttribute('style')).includes('rotate(90deg)'));
  await page.screenshot({path:path.join(output,'03-portrait.png')});
  await page.evaluate(()=>window.XingyuTennis.close());
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'tennis-result.json'),JSON.stringify({passed:true,score,hits,fires,pageErrors:errors},null,2));
  console.log('Tennis checks passed (body hit not counted): '+score+', '+hits+' hits, '+fires+' fire shots');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
