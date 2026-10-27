'use strict';
// 星屿网球：设置页的彩蛋（连点十次「一个安静的课表」的星星打开）。
// 横屏，人机对战或同一台手机两人对战：点屏幕跳起，球拍碰到球就打回去，拍心击球打出火焰球；
// 没接住对方得分，先得 7 分获胜，结束后回到设置页。整个场景画在一张 canvas 上。
window.XingyuTennis=(()=>{
  // 球落地只弹起一点点，会从拍子底下滚过去——没在空中接住就丢分
  const H=900,GROUND=760,GRAVITY=1500,BOUNCE=.45,BALL_R=22,WIN=7;
  // 球拍竖着举在身前：拍面中心在脚下往前 64、往上 154 处，横向半径 44、竖向半径 60。只有拍面（含拍框）碰到球才算击球
  const RACKET_X=64,RACKET_Y=154,RACKET_RX=44,RACKET_RY=60,FRAME=3;
  const RACKET_R=RACKET_RX;
  // 可以无限连跳：每点一次都重新给一个向上的速度；脚最高到 CEIL，免得跳出屏幕
  const JUMP_V=-1250,PLAYER_G=3000,STEP=1/120,BODY=112,CEIL=230;
  const COLORS={left:'#f0524f',right:'#2fa7e6'};
  let root=null,canvas,ctx,bg=null,ui={},W=1600,scale=1,offsetY=0,dpr=1,rotated=false,lw=0,lh=0,raf=0,last=0,acc=0,game=null,options={},guardUntil=0;
  const N=window.Native;
  const haptic=kind=>{try{if(N&&N.haptic)N.haptic(kind);}catch(_){}};
  const rand=(a,b)=>a+Math.random()*(b-a);

  // ---------- 打开 / 关闭 ----------
  function open(opts){
    if(root)return;options=opts||{};
    try{if(N&&N.gameMode)N.gameMode(true);}catch(_){}
    root=document.createElement('div');root.id='tennis';root.className='at-menu';root.setAttribute('role','dialog');root.setAttribute('aria-label','星屿网球');
    root.innerHTML='<canvas class="tennis-canvas"></canvas>'+
      '<div class="tennis-score" aria-live="polite"><b class="l">0</b><i>·</i><b class="r">0</b></div>'+
      '<button class="tennis-exit" type="button">EXIT</button><button class="tennis-back" type="button" aria-label="返回设置">‹ 返回</button>'+
      '<div class="tennis-hint l">红方 · 点左半屏起跳</div><div class="tennis-hint r">蓝方 · 点右半屏起跳</div>'+
      '<div class="tennis-banner"></div>'+
      '<div class="tennis-menu"><div class="tennis-card"><div class="tennis-title">星屿网球</div><p>点屏幕起跳挥拍，可以一直点、连续往上跳；<br>拍心击中打出<b>火焰球</b>，先得 7 分获胜。</p>'+
      '<button type="button" data-mode="cpu">人机对战</button><button type="button" data-mode="duo">好友对战<small>同一台手机，左右各一人</small></button></div></div>';
    document.body.appendChild(root);
    canvas=root.querySelector('canvas');ctx=canvas.getContext('2d');
    ui={score:root.querySelector('.tennis-score'),l:root.querySelector('.tennis-score .l'),r:root.querySelector('.tennis-score .r'),banner:root.querySelector('.tennis-banner'),menu:root.querySelector('.tennis-menu'),hints:root.querySelectorAll('.tennis-hint')};
    root.querySelector('.tennis-exit').onclick=close;
    root.querySelector('.tennis-back').onclick=()=>{if(performance.now()<guardUntil)return;haptic('tick');close();};
    // 菜单刚出现、或屏幕刚转过来的 0.6 秒内不响应：连点星星多点出来的几下不会误按到按钮
    root.querySelectorAll('.tennis-menu [data-mode]').forEach(b=>b.onclick=()=>{if(performance.now()<guardUntil)return;haptic('tick');start(b.dataset.mode);});
    canvas.addEventListener('pointerdown',onPress);
    addEventListener('resize',layout);addEventListener('keydown',onKey);
    guardUntil=performance.now()+600;
    layout();game=newGame('menu');layout();// 先量好场地宽度，观众才能按实际座位数入座
    last=performance.now();acc=0;raf=requestAnimationFrame(frame);
  }
  function close(){
    if(!root)return;
    cancelAnimationFrame(raf);raf=0;removeEventListener('resize',layout);removeEventListener('keydown',onKey);
    root.remove();root=null;game=null;bg=null;
    try{if(N&&N.gameMode)N.gameMode(false);}catch(_){}
    if(options.onExit)options.onExit();
  }

  // ---------- 布局：横屏直接铺满；竖屏（屏幕没转过来，或浏览器预览）时把整个场景转 90° ----------
  function layout(){
    if(!root)return;
    const vw=innerWidth,vh=innerHeight;rotated=vw<vh;lw=rotated?vh:vw;lh=rotated?vw:vh;
    Object.assign(root.style,{width:lw+'px',height:lh+'px',transform:rotated?'translateX('+vw+'px) rotate(90deg)':'none'});
    dpr=Math.min(2,window.devicePixelRatio||1);
    scale=Math.min(lh/H,lw/1400);W=lw/scale;offsetY=lh-H*scale;
    canvas.width=Math.round(lw*dpr);canvas.height=Math.round(lh*dpr);canvas.style.width=lw+'px';canvas.style.height=lh+'px';
    bg=null;if(game)placePlayers(game);
    guardUntil=Math.max(guardUntil,performance.now()+600);
    placeMenu();
  }
  // 打开游戏时手指还停在星星上。算出星星在横屏里落到哪儿，菜单卡片避开那一块：
  // 那一点在下半屏，卡片贴上边；在上半屏，卡片贴下边。返回键放在左上角。
  function starSpot(){
    const f=options.from;if(!f)return null;
    if(f.vw>f.vh)return {x:f.x,y:f.y};// 打开时已经是横屏
    if(rotated)return {x:f.y,y:f.vw-f.x};// 本页用 CSS 转了 90°
    const angle=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:((window.orientation||0)+360)%360;
    return angle===270?{x:f.vh-f.y,y:f.x}:{x:f.y,y:f.vw-f.x};
  }
  function placeMenu(){
    if(!ui.menu)return;const spot=starSpot();
    ui.menu.dataset.align=spot&&spot.y<lh/2?'bottom':'top';
  }
  // 触点换算成横屏坐标（竖屏旋转时：横屏 x = 屏幕 y，横屏 y = 屏幕宽 − 屏幕 x）
  const toLocal=e=>rotated?{x:e.clientY,y:innerWidth-e.clientX}:{x:e.clientX,y:e.clientY};

  // ---------- 对局状态 ----------
  function makePlayer(side){return {side,dir:side==='left'?1:-1,x:0,y:GROUND,vy:0,air:false,swing:0,squash:0,score:0,cheer:0};}
  function placePlayers(g){g.left.x=210;g.right.x=W-210;}
  function newGame(phase){
    const g={phase,mode:'cpu',left:makePlayer('left'),right:makePlayer('right'),ball:null,particles:[],timer:0,shake:0,flash:null,crowd:makeCrowd(),serveTo:Math.random()<.5?'left':'right',ai:{left:null,right:null},stuck:0,time:0};
    placePlayers(g);return g;
  }
  // 看台座位：两排圆角椅背，前排每 150 一个，后排错开半格；观众坐在其中一部分座位上
  const seat=(row,i)=>({x:i*150+(row?75:0)-40,y:262+row*120,w:120,h:104});
  function makeCrowd(){
    const list=[],tones=['#c9746a','#5d8fb5','#d39b5a','#8a7fc7','#6aa889'];let n=0;
    for(let row=0;row<2;row++)for(let i=0;i<Math.ceil(W/150)+1;i++){
      const st=seat(row,i);
      // 正中那格让给裁判
      if(Math.random()<.42||Math.abs(st.x+st.w/2-W/2)<90)continue;
      list.push({x:st.x+st.w/2,y:st.y+st.h-6,row,color:tones[n++%tones.length],hop:0,phase:rand(0,6)});
    }
    return list;
  }
  function start(mode){
    game=newGame('countdown');game.mode=mode;game.timer=3;
    ui.menu.classList.add('hidden');root.classList.remove('at-menu');ui.score.classList.add('show');updateScore();
    ui.hints[0].textContent=mode==='cpu'?'你 · 点屏幕任意处起跳':'红方 · 点左半屏起跳';
    ui.hints[0].classList.add('show');ui.hints[1].classList.toggle('show',mode==='duo');
    banner('3');
  }
  function updateScore(){ui.l.textContent=game.left.score;ui.r.textContent=game.right.score;ui.score.classList.remove('pop');void ui.score.offsetWidth;ui.score.classList.add('pop');}
  function banner(text,kind){ui.banner.textContent=text;ui.banner.className='tennis-banner show'+(kind?' '+kind:'');}
  function hideBanner(){ui.banner.className='tennis-banner';}
  function serve(){
    const g=game,toward=g.serveTo==='left'?-1:1,k=W/2000;
    g.ball={x:W/2,y:330,vx:toward*rand(600,720)*k,vy:0,fire:false,lastHit:null,cool:0,trail:[],spin:0};
    g.ball.vy=aimAt(g.ball,g.serveTo,g.ball.vx,rand(360,470),GRAVITY);
    g.phase='play';g.ai.left=g.ai.right=null;g.stuck=0;
  }

  // ---------- 输入 ----------
  function onPress(e){
    if(!game||game.phase==='menu')return;
    e.preventDefault();
    if(game.phase==='win'){close();return;}
    const p=toLocal(e);
    const who=game.mode==='cpu'?game.left:(p.x<lw/2?game.left:game.right);
    jump(who);
  }
  function onKey(e){
    if(!game)return;
    if(e.key==='Escape'){close();return;}
    if(game.phase==='menu'||game.phase==='win')return;
    if(e.key==='a'||e.key==='A'||e.key===' ')jump(game.left);
    if(game.mode==='duo'&&(e.key==='l'||e.key==='L'||e.key==='Enter'))jump(game.right);
  }
  // 点一下：往上跳并挥拍，在空中也能接着跳（无限连跳）。球拍一直能击球；回球大多飞得比站着时的拍子高，要跳起来才够得着
  function jump(p){
    p.swing=1;
    if(!p.air)p.squash=-.25;else for(let i=0;i<4;i++)game.particles.push({x:p.x+rand(-30,30),y:p.y-4,vx:rand(-60,60),vy:rand(40,140),g:200,age:0,life:rand(.25,.4),size:rand(6,11),kind:'dust'});
    p.vy=JUMP_V;p.air=true;haptic('soft');
    ui.hints.forEach(h=>h.classList.remove('show'));
  }

  // ---------- 主循环（固定步长 1/120 秒，快球也不会穿过球拍） ----------
  function frame(now){
    if(!root)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;acc+=dt;
    while(acc>=STEP&&root){update(STEP);acc-=STEP;}
    if(!root)return;// 本帧里对局结束并关闭了
    draw();raf=requestAnimationFrame(frame);
  }
  function update(dt){
    const g=game;g.time+=dt;
    if(g.shake>0)g.shake=Math.max(0,g.shake-dt);
    if(g.flash){g.flash.age+=dt;if(g.flash.age>.35)g.flash=null;}
    for(const p of [g.left,g.right]){
      if(p.air){p.vy+=PLAYER_G*dt;p.y+=p.vy*dt;if(p.y<CEIL){p.y=CEIL;if(p.vy<0)p.vy=0;}if(p.y>=GROUND){p.y=GROUND;p.vy=0;p.air=false;p.squash=.3;dust(p.x,GROUND,6);}}
      p.swing=Math.max(0,p.swing-dt*5);p.squash*=Math.pow(.0005,dt);
      if(p.cheer>0)p.cheer=Math.max(0,p.cheer-dt);
    }
    g.crowd.forEach(c=>{if(c.hop>0)c.hop=Math.max(0,c.hop-dt);});
    g.particles=g.particles.filter(q=>{q.age+=dt;if(q.age>=q.life)return false;q.vy+=(q.g||0)*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;return true;});
    if(g.phase==='countdown'){
      const before=Math.ceil(g.timer);g.timer-=dt;const n=Math.ceil(g.timer);
      if(n!==before&&n>0){banner(String(n));haptic('tick');}
      if(g.timer<=0){banner('开始！','go');setTimeout(()=>{if(game&&game.phase==='play')hideBanner();},600);serve();}
      return;
    }
    if(g.phase==='point'){g.timer-=dt;if(g.timer<=0){hideBanner();serve();}if(g.ball)stepBall(dt,false);return;}
    if(g.phase==='win'){g.timer-=dt;if(g.timer<=0)close();return;}
    if(g.phase!=='play')return;
    if(g.mode==='cpu'||options.demo)thinkAI(g.right,dt);
    if(options.demo)thinkAI(g.left,dt);
    stepBall(dt,true);
  }
  function stepBall(dt,live){
    const g=game,b=g.ball;
    b.vy+=GRAVITY*(b.fire?.55:1)*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.spin+=b.vx*dt*.02;
    if(b.cool>0)b.cool-=dt;
    b.trail.push([b.x,b.y]);if(b.trail.length>(b.fire?14:8))b.trail.shift();
    if(b.y+BALL_R>GROUND){b.y=GROUND-BALL_R;b.vy=-Math.abs(b.vy)*BOUNCE;b.vx*=.9;if(b.vy>-60)b.vy=0;dust(b.x,GROUND,b.fire?10:4);if(b.fire)g.shake=Math.max(g.shake,.12);}
    if(b.fire)for(let i=0;i<3;i++)g.particles.push({x:b.x+rand(-8,8),y:b.y+rand(-8,8),vx:-b.vx*.12+rand(-60,60),vy:-b.vy*.12+rand(-90,10),g:-200,age:0,life:rand(.25,.5),size:rand(10,20),kind:'fire'});
    if(!live)return;
    for(const p of [g.left,g.right]){
      if(b.lastHit===p&&b.cool>0)continue;
      if(b.bonked===p)continue;
      const r=racketPose(p),hx=r.x,hy=r.y,dx=b.x-hx,dy=b.y-hy;
      // 换到拍面自己的坐标系（挥拍前倾时拍面跟着转），用画出来的拍面椭圆判定
      const lx=dx*r.cos+dy*r.sin,ly=-dx*r.sin+dy*r.cos,ex=lx/(RACKET_RX+FRAME+BALL_R),ey=ly/(RACKET_RY+FRAME+BALL_R);
      if(ex*ex+ey*ey<1&&b.vx*p.dir<=60){
        // 拍心判定看球的飞行线离拍面中心有多近（垂直于飞行方向的距离），而不是接触瞬间两圆心的距离——那时总是挨着边
        const sp=Math.hypot(b.vx,b.vy)||1,offset=Math.abs((dx*b.vy-dy*b.vx)/sp);
        hit(p,offset,dy,hx,hy);continue;
      }
      // 球砸在身上不算接住：被撞得往下掉、慢下来，继续往身后滚，这一分照样丢
      const nx=Math.max(p.x-BODY/2,Math.min(p.x+BODY/2,b.x)),ny=Math.max(p.y-BODY,Math.min(p.y,b.y));
      if(Math.hypot(b.x-nx,b.y-ny)<BALL_R&&b.vx*p.dir<0){
        b.bonked=p;b.fire=false;b.vx*=.3;b.vy=Math.max(b.vy,180);p.squash=.22;haptic('soft');
        for(let i=0;i<6;i++)g.particles.push({x:b.x,y:b.y,vx:rand(-120,120),vy:rand(-160,-40),g:500,age:0,life:rand(.2,.35),size:rand(3,5),kind:'spark'});
      }
    }
    if(Math.abs(b.vx)<80){g.stuck+=dt;if(g.stuck>1.5){b.vx=(b.x<W/2?-1:1)*500;g.stuck=0;}}else g.stuck=0;// 球停在谁那边就算谁丢分
    if(b.x<-90)point(g.right);else if(b.x>W+90)point(g.left);
  }
  // 拍面当前的位置与倾角，和 drawPlayer 里画球拍用的是同一套几何：手在身体前下方，拍面中心在手往上 96 处，挥拍时绕手前倾
  function racketPose(p){
    const hop=p.cheer>0&&!p.air?Math.abs(Math.sin(p.cheer*12))*18:0,ang=p.dir*p.swing*.55,cos=Math.cos(ang),sin=Math.sin(ang);
    const hx=p.x+p.dir*58,hy=p.y-58-hop;
    return {x:hx+p.dir*6*cos+96*sin,y:hy+p.dir*6*sin-96*cos,cos,sin};
  }
  // 让球以水平速度 vx 飞到对方拍面那条竖线时恰好在高度 y：解出需要的竖直初速度
  function aimAt(b,toward,vx,y,gravity){
    const opp=toward==='left'?game.left:game.right,x=opp.x+opp.dir*RACKET_X,t=Math.max(.25,Math.abs(x-b.x)/Math.abs(vx));
    return Math.max(-1700,Math.min(250,(y-b.y-.5*gravity*t*t)/t));
  }
  // 落点高度：站着时拍面能接住的范围大约是 516–696。八成的球高过这一段，要跳起来接
  const arrivalHeight=fire=>Math.random()<.8?rand(300,480):rand(540,650);
  // 拍心（飞行线离拍面中心不到 36% 半径）打出火焰球：更快、更平、拖着火焰，画面一震
  function hit(p,offset,dy,hx,hy){
    const g=game,b=g.ball,k=W/2000,cpu=options.demo||(g.mode==='cpu'&&p.side==='right');
    // 电脑正中拍心也只有四成打出火焰球，免得满场都是火球；玩家不受影响
    const power=offset<RACKET_R*.36&&(!cpu||Math.random()<.4);
    if(power){
      b.vx=p.dir*rand(2050,2300)*k;b.fire=true;b.vy=aimAt(b,p.side==='left'?'right':'left',b.vx,arrivalHeight(true),GRAVITY*.55);
      g.shake=.35;g.flash={x:hx,y:hy,age:0};haptic('confirm');
      for(let i=0;i<22;i++){const a=rand(0,Math.PI*2),v=rand(200,620);g.particles.push({x:hx,y:hy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:600,age:0,life:rand(.3,.6),size:rand(6,14),kind:'fire'});}
    }else{
      b.vx=p.dir*rand(1050,1250)*k;b.fire=false;b.vy=aimAt(b,p.side==='left'?'right':'left',b.vx,arrivalHeight(false),GRAVITY);haptic('tick');
      for(let i=0;i<8;i++){const a=rand(0,Math.PI*2),v=rand(120,320);g.particles.push({x:b.x,y:b.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:500,age:0,life:rand(.2,.4),size:rand(3,6),kind:'spark'});}
    }
    b.lastHit=p;b.bonked=null;b.cool=.25;p.swing=1;
  }
  function point(scorer){
    const g=game;scorer.score++;scorer.cheer=1.2;updateScore();haptic('reject');
    g.crowd.forEach(c=>{if((scorer.side==='left')===(c.x<W/2)||Math.random()<.4)c.hop=rand(.6,1.1);});
    const name=g.mode==='cpu'?(scorer.side==='left'?'你':'电脑'):(scorer.side==='left'?'红方':'蓝方');
    g.serveTo=scorer.side==='left'?'right':'left';
    if(scorer.score>=WIN){
      g.phase='win';g.timer=4.2;g.ball=null;
      const text=g.mode==='cpu'?(scorer.side==='left'?'你赢了！':'电脑获胜'):name+'获胜！';
      banner(text+'  '+g.left.score+' : '+g.right.score,'win '+scorer.side);haptic('confirm');
      for(let i=0;i<90;i++)g.particles.push({x:rand(0,W),y:rand(-200,0),vx:rand(-80,80),vy:rand(80,260),g:220,age:0,life:rand(2,3.6),size:rand(8,14),kind:'confetti',color:['#f0524f','#2fa7e6','#ffd34d','#7ed957','#b48cff'][i%5],rot:rand(0,6)});
      return;
    }
    g.phase='point';g.timer=1.3;banner(name+' 得分','point '+scorer.side);
  }

  // ---------- 电脑：预测球飞到球拍前的时刻与高度，算准了才起跳；每一球带一点随机误差，打得赢 ----------
  function thinkAI(p,dt){
    const g=game,b=g.ball;
    if(!b||b.vx*p.dir>=0)return;
    let plan=g.ai[p.side];
    // 每一球都偏开拍心 10–48（约四分之一的球正中拍心打出火焰球）；约六分之一的球真的失误——愣住不跳或起跳晚了，
    // 接火焰球时失误率翻倍。球拍挥过的范围很大，只靠瞄准误差几乎不会漏球，所以失误要单独安排。
    if(!plan||plan.ball!==b.lastHit){
      const slip=Math.random()<(b.fire?.34:.16);
      plan=g.ai[p.side]={ball:b.lastHit,error:(Math.random()<.5?-1:1)*rand(10,48),wait:rand(0,.08),mistake:slip?(Math.random()<.5?'freeze':'late'):null,delay:0};
    }
    if(plan.wait>0){plan.wait-=dt;return;}
    if(plan.mistake==='freeze')return;
    if(plan.delay>0){plan.delay-=dt;if(plan.delay<=0)jump(p);return;}
    const hx=p.x+p.dir*RACKET_X,sim={x:b.x,y:b.y,vx:b.vx,vy:b.vy};let t=0;
    const before=()=>p.dir<0?sim.x<hx-RACKET_RX-BALL_R:sim.x>hx+RACKET_RX+BALL_R;
    while(before()&&t<2.5){sim.vy+=GRAVITY*(b.fire?.55:1)*STEP;sim.x+=sim.vx*STEP;sim.y+=sim.vy*STEP;if(sim.y+BALL_R>GROUND){sim.y=GROUND-BALL_R;sim.vy=-Math.abs(sim.vy)*BOUNCE;sim.vx*=.9;if(sim.vy>-60)sim.vy=0;}t+=STEP;}
    if(t>=2.5)return;
    // 拍面高度随时间变化：落回地面后停在站立高度，碰到头顶上限就停住
    const target=sim.y+plan.error,stand=GROUND-RACKET_Y,top=CEIL-RACKET_Y,now=p.y-RACKET_Y;
    const path=v=>Math.max(top,Math.min(stand,now+v*t+.5*PLAYER_G*t*t));
    const keep=path(p.air?p.vy:0),again=path(JUMP_V);
    if(Math.abs(keep-sim.y)<RACKET_RY+BALL_R-6&&plan.mistake!=='late')return;// 不跳也接得住
    if(Math.abs(again-target)<26){if(plan.mistake==='late')plan.delay=rand(.12,.25);else jump(p);}
  }

  // ---------- 特效 ----------
  function dust(x,y,n){for(let i=0;i<n;i++)game.particles.push({x:x+rand(-20,20),y:y-4,vx:rand(-90,90),vy:rand(-140,-40),g:300,age:0,life:rand(.3,.55),size:rand(8,16),kind:'dust'});}

  // ---------- 绘制 ----------
  function draw(){
    const g=game;
    ctx.setTransform(1,0,0,1,0,0);
    if(!bg)bg=paintBackground();
    ctx.drawImage(bg,0,0);
    const sx=g.shake>0?rand(-1,1)*g.shake*30:0,sy=g.shake>0?rand(-1,1)*g.shake*22:0;
    ctx.setTransform(dpr*scale,0,0,dpr*scale,sx*dpr*scale,(offsetY+sy*scale)*dpr);
    drawCrowd(g);drawUmpire(g);
    g.particles.filter(q=>q.kind==='dust').forEach(drawParticle);
    drawPlayer(g.left,g);drawPlayer(g.right,g);
    if(g.ball)drawBall(g.ball);
    ctx.globalCompositeOperation='lighter';g.particles.filter(q=>q.kind==='fire'||q.kind==='spark').forEach(drawParticle);ctx.globalCompositeOperation='source-over';
    if(g.flash){const a=1-g.flash.age/.35,r=40+g.flash.age*520;ctx.strokeStyle='rgba(255,210,90,'+a+')';ctx.lineWidth=10*a;ctx.beginPath();ctx.arc(g.flash.x,g.flash.y,r,0,Math.PI*2);ctx.stroke();}
    g.particles.filter(q=>q.kind==='confetti').forEach(drawParticle);
  }
  // 天空、看台、围墙、球场线只在尺寸变化时画一次
  function paintBackground(){
    const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    const x=c.getContext('2d');x.setTransform(dpr*scale,0,0,dpr*scale,0,offsetY*dpr);
    const top=-offsetY/scale;
    x.fillStyle='#9ef3f5';x.fillRect(0,top,W,260-top);
    x.fillStyle='#fff';[[W*.12,95,1],[W*.62,70,.8],[W*.86,120,.9]].forEach(([cx,cy,s])=>{x.beginPath();x.arc(cx,cy,42*s,0,7);x.arc(cx+46*s,cy-14*s,54*s,0,7);x.arc(cx+100*s,cy,40*s,0,7);x.fill();x.fillRect(cx,cy,100*s,40*s);});
    x.fillStyle='#284a62';x.fillRect(0,250,W,300);
    for(let row=0;row<2;row++)for(let i=0;i<Math.ceil(W/150)+1;i++){const st=seat(row,i);x.fillStyle=row?'#2f5874':'#2b5069';round(x,st.x,st.y,st.w,st.h,26);x.fill();}
    x.fillStyle='#34607c';x.fillRect(0,520,W,GROUND-520);
    x.strokeStyle='rgba(120,160,190,.55)';x.lineWidth=8;for(let i=0;i<Math.ceil(W/420);i++){x.beginPath();x.moveTo(i*420+60,560);x.lineTo(i*420+60,520);x.lineTo(i*420+360,520);x.lineTo(i*420+360,560);x.stroke();}
    x.fillStyle='#2a7f3a';x.fillRect(0,GROUND,W,H-GROUND);
    x.fillStyle='#38b54a';x.fillRect(0,GROUND+10,W,H-GROUND);
    x.strokeStyle='#fff';x.lineWidth=7;x.beginPath();x.moveTo(0,GROUND+18);x.lineTo(W,GROUND+18);
    x.moveTo(40,H);x.lineTo(110,GROUND+18);x.moveTo(W-40,H);x.lineTo(W-110,GROUND+18);
    x.moveTo(W*.3,H);x.lineTo(W*.33,GROUND+18);x.moveTo(W*.7,H);x.lineTo(W*.67,GROUND+18);x.stroke();
    // 裁判椅
    x.strokeStyle='#567a93';x.lineWidth=8;x.beginPath();x.moveTo(W/2-34,560);x.lineTo(W/2-34,GROUND);x.moveTo(W/2+34,560);x.lineTo(W/2+34,GROUND);
    for(let y=590;y<GROUND;y+=38){x.moveTo(W/2-34,y);x.lineTo(W/2+34,y);}x.stroke();
    return c;
  }
  function round(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath();}
  function eyes(cx,cy,lookX,lookY,size,closed){
    for(const ox of [-size*.55,size*.55]){
      ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(cx+ox,cy,size*.42,closed?size*.12:size*.5,0,0,7);ctx.fill();
      if(!closed){ctx.fillStyle='#22262e';ctx.beginPath();ctx.arc(cx+ox+lookX*size*.18,cy+lookY*size*.22,size*.22,0,7);ctx.fill();}
    }
  }
  function lookAt(x,y,g){if(!g.ball)return [0,0];const dx=g.ball.x-x,dy=g.ball.y-y,d=Math.hypot(dx,dy)||1;return [dx/d,dy/d];}
  // 观众坐在椅背里：身体底边贴着座位下沿，欢呼时在座位里往上蹦；被裁在座位范围内，不会跑出看台
  function drawCrowd(g){
    g.crowd.forEach(c=>{
      const hop=c.hop>0?Math.abs(Math.sin(c.hop*14))*20:Math.sin(g.time*1.6+c.phase)*1.5,x=c.x,bottom=c.y,top=bottom-74-hop;
      ctx.save();ctx.beginPath();ctx.rect(x-60,c.row?382:262,120,104);ctx.clip();
      ctx.fillStyle=c.color;round(ctx,x-38,top,76,bottom-top+20,34);ctx.fill();
      ctx.fillStyle='#7d7f86';round(ctx,x-36,top-4,58,14,7);ctx.fill();
      const [lx,ly]=lookAt(x,top+30,g);eyes(x+4,top+30,lx,ly,14,c.hop>0);
      ctx.restore();
    });
  }
  function drawUmpire(g){
    const x=W/2,y=520;ctx.fillStyle='#22364a';ctx.beginPath();ctx.arc(x,y-6,48,0,7);ctx.fill();
    ctx.fillStyle='#16222e';round(ctx,x-42,y-56,72,16,8);ctx.fill();
    const [lx,ly]=lookAt(x,y,g);eyes(x,y-6,lx,ly,17,false);
  }
  function drawPlayer(p,g){
    const sq=p.squash,w=BODY*(1+sq*.5),h=BODY*(1-sq*.5),x=p.x,y=p.y,hop=p.cheer>0&&!p.air?Math.abs(Math.sin(p.cheer*12))*18:0;
    const air=Math.min(1,(GROUND-p.y)/260);
    ctx.fillStyle='rgba(20,60,30,'+(.35-air*.2)+')';ctx.beginPath();ctx.ellipse(x,GROUND+8,62*(1-air*.4),12*(1-air*.4),0,0,7);ctx.fill();
    const top=y-h-hop;
    // 身体与头饰
    ctx.fillStyle='#2e333d';round(ctx,x-w/2,top,w,h,30);ctx.fill();
    ctx.strokeStyle='#1d2027';ctx.lineWidth=5;ctx.stroke();
    if(p.side==='left'){
      ctx.fillStyle=COLORS.left;ctx.beginPath();ctx.moveTo(x-w/2,top+34);ctx.quadraticCurveTo(x-w/2,top-6,x,top-6);ctx.quadraticCurveTo(x+w/2,top-6,x+w/2,top+34);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.ellipse(x+w/2+8,top+30,30,9,0,0,7);ctx.fill();
    }else{
      ctx.fillStyle=COLORS.right;ctx.fillRect(x-w/2,top+12,w,20);
      const flap=Math.sin(g.time*14)*8;ctx.beginPath();ctx.moveTo(x+w/2-4,top+16);ctx.lineTo(x+w/2+40,top+2+flap);ctx.lineTo(x+w/2+34,top+20+flap);ctx.closePath();ctx.fill();
    }
    const [lx,ly]=lookAt(x,top+56,g);eyes(x+p.dir*16,top+60,lx,ly,22,false);
    // 球拍竖着举在身前：握柄从手里朝上伸出，拍面是竖着的椭圆；点屏幕时朝球网方向前倾一下
    const hand={x:x+p.dir*58,y:y-58-hop},ang=p.dir*p.swing*.55;
    ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(ang);
    ctx.lineCap='round';ctx.strokeStyle='#22262e';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(p.dir*3,-38);ctx.stroke();
    ctx.strokeStyle=COLORS[p.side];ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(p.dir*3,-36);ctx.stroke();
    ctx.fillStyle='#22262e';ctx.beginPath();ctx.arc(0,4,10,0,7);ctx.fill();
    const rx=p.dir*6,ry=-96;
    ctx.save();ctx.beginPath();ctx.ellipse(rx,ry,RACKET_RX-2,RACKET_RY-2,0,0,7);ctx.fillStyle='#fff';ctx.fill();ctx.clip();
    ctx.strokeStyle='rgba(60,70,90,.45)';ctx.lineWidth=5;ctx.beginPath();for(let i=-66;i<=66;i+=14){ctx.moveTo(rx+i*.7,ry-64);ctx.lineTo(rx+i*.7,ry+64);ctx.moveTo(rx-48,ry+i);ctx.lineTo(rx+48,ry+i);}ctx.stroke();ctx.restore();
    ctx.lineWidth=9;ctx.strokeStyle='#22262e';ctx.beginPath();ctx.ellipse(rx,ry,RACKET_RX+2,RACKET_RY+2,0,0,7);ctx.stroke();
    ctx.lineWidth=6;ctx.strokeStyle=COLORS[p.side];ctx.beginPath();ctx.ellipse(rx,ry,RACKET_RX-2,RACKET_RY-2,0,0,7);ctx.stroke();
    ctx.restore();
  }
  function drawBall(b){
    const speed=Math.hypot(b.vx,b.vy);
    for(let i=0;i<b.trail.length;i++){const k=i/b.trail.length;ctx.fillStyle=b.fire?'rgba(255,120,40,'+(k*.35)+')':'rgba(255,255,255,'+(k*.35)+')';ctx.beginPath();ctx.arc(b.trail[i][0],b.trail[i][1],BALL_R*k,0,7);ctx.fill();}
    if(b.fire){const gl=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,BALL_R*3.2);gl.addColorStop(0,'rgba(255,230,120,.9)');gl.addColorStop(.4,'rgba(255,120,30,.45)');gl.addColorStop(1,'rgba(255,60,0,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(b.x,b.y,BALL_R*3.2,0,7);ctx.fill();}
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));const stretch=1+Math.min(.35,speed/6000);ctx.scale(stretch,1/stretch);ctx.rotate(b.spin-Math.atan2(b.vy,b.vx));
    ctx.fillStyle=b.fire?'#ffb347':'#cfe83a';ctx.strokeStyle='#2a2f38';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,BALL_R,0,7);ctx.fill();ctx.stroke();
    ctx.strokeStyle=b.fire?'#fff3c4':'#fff';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(-BALL_R*.9,0,BALL_R*.75,-1,1);ctx.stroke();ctx.beginPath();ctx.arc(BALL_R*.9,0,BALL_R*.75,Math.PI-1,Math.PI+1);ctx.stroke();
    ctx.restore();
  }
  function drawParticle(q){
    const a=1-q.age/q.life;
    if(q.kind==='fire'){const r=q.size*(.4+a*.8);const gl=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r);gl.addColorStop(0,'rgba(255,240,170,'+a+')');gl.addColorStop(.45,'rgba(255,140,30,'+(a*.8)+')');gl.addColorStop(1,'rgba(220,40,0,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(q.x,q.y,r,0,7);ctx.fill();}
    else if(q.kind==='spark'){ctx.fillStyle='rgba(255,255,220,'+a+')';ctx.beginPath();ctx.arc(q.x,q.y,q.size*a,0,7);ctx.fill();}
    else if(q.kind==='dust'){ctx.fillStyle='rgba(230,245,220,'+(a*.6)+')';ctx.beginPath();ctx.arc(q.x,q.y,q.size*(1.4-a*.6),0,7);ctx.fill();}
    else{ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot+q.age*6);ctx.fillStyle=q.color;ctx.globalAlpha=Math.min(1,a*2);ctx.fillRect(-q.size/2,-q.size/4,q.size,q.size/2);ctx.restore();ctx.globalAlpha=1;}
  }

  // _state 仅供自动化测试读取对局状态
  return {open,close,isOpen:()=>!!root,_state:()=>game};
})();
