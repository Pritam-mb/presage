/* Presentation for the capture instruments. All readouts are produced by the renderer. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const element = (tag, cls, text) => {
    const item = document.createElement(tag);
    if (cls) item.className = cls;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const vector = (tag, attrs, text) => window.SpoofCharts.svg(tag, attrs, text);
  function glyph(path, label) {
    const svg = vector('svg', {viewBox:'0 0 24 24', width:24, height:24, fill:'none', stroke:'currentColor', 'stroke-width':1.5, 'aria-hidden':'true'});
    svg.append(vector('path', {d:path,'stroke-linecap':'round','stroke-linejoin':'round'}));
    if (label) svg.append(vector('title',{},label));
    return svg;
  }
  const paths = {
    sensor:'M2 12h5l2-6 4 12 3-8 2 2h4', policy:'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4',
    verdict:'M5 3h14v18H5zM8 9h8m-8 5 2 2 5-5', camera:'M3 6h12v12H3zM15 10l6-3v10l-6-3',
    tick:'m4 12 5 5L20 6', pending:'M12 6v6l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    info:'M3 5h18v14H3zM9 9h6m-6 4h6', plus:'M2 12h20m-10-10v20'
  };
  const consoleView = byId('view-capture');
  if (!consoleView || !window.SpoofCharts) return;
  const monitor = consoleView.querySelector('.monitor');
  const placeholder = byId('placeholder');
  const original = placeholder.querySelector('.face-outline');
  original?.remove();
  const reticle = vector('svg',{viewBox:'0 0 200 140',class:'monitor-reticle','aria-hidden':'true'});
  for(let x=0;x<=200;x+=20)reticle.append(vector('line',{x1:x,x2:x,y1:0,y2:140,class:'reticle-grid'}));
  for(let y=0;y<=140;y+=20)reticle.append(vector('line',{x1:0,x2:200,y1:y,y2:y,class:'reticle-grid'}));
  reticle.append(vector('path',{d:'M46 52V28h24m60 0h24v24m0 36v24h-24m-60 0H46V88',class:'reticle-corners'}));
  reticle.append(vector('circle',{cx:100,cy:70,r:28,class:'reticle-scope'}),vector('path',{d:'M90 70h20m-10-10v20',class:'reticle-corners'}));
  const intro = element('div','monitor-intro');
  intro.append(byId('preview-heading'),byId('preview-detail'));
  placeholder.replaceChildren(reticle,intro);
  byId('preview-heading').textContent='Prepare your source';
  byId('preview-detail').textContent='Choose an input, confirm consent, then check the camera frame rate.';
  const warm=consoleView.querySelector('.warmup');
  const ring=vector('svg',{viewBox:'0 0 44 44',width:40,height:40,'aria-hidden':'true'});
  const arc=vector('circle',{cx:22,cy:22,r:17,pathLength:100,'stroke-dasharray':'0 100',class:'ring-arc'});
  ring.append(vector('circle',{cx:22,cy:22,r:17,class:'ring-base'}),arc);
  warm.prepend(ring);
  const fpsTile=element('div','capture-fps'), fpsLabel=element('span','console-kicker','Camera FPS'), fpsText=element('strong','','Unavailable');
  fpsTile.append(fpsLabel,fpsText);
  warm.append(fpsTile);
  const rateMeter=element('meter'); rateMeter.min=0; rateMeter.max=60; rateMeter.setAttribute('aria-label','Delivered camera frames per second');rateMeter.hidden=true;
  fpsTile.append(rateMeter);
  const grid=consoleView.querySelector('.capture-grid'),steps=[...grid.querySelectorAll('details.bench-step')];
  const startGroup=steps.pop(), startBar=element('section','capture-start-bar');
  startBar.setAttribute('aria-label','Trial controls');
  const checks=element('div','capture-checks');
  const readiness=element('p','capture-ready-reason');
  const actionRow=startGroup.querySelector('.action-row');
  startBar.append(checks,actionRow,readiness,byId('status'),byId('error'));
  startGroup.remove();
  consoleView.querySelector('.footnote').after(startBar);
  steps.forEach((step,index)=>{step.open=index===0;});
  const checkNames=['Consent','Frame rate','Source'];
  const checkNodes=checkNames.map(label=>{
    const cell=element('span','capture-check');
    checks.append(cell);return {label,cell};
  });
  const detail=consoleView.querySelector('.setup-panel .panel-heading .micro');
  const monitorPanel=consoleView.querySelector('.monitor-panel');
  const readoutRow=consoleView.querySelector('.readouts');
  monitorPanel.insertBefore(readoutRow,monitor);
  const previewBanner=byId('preview-banner');
  previewBanner.textContent='Report workspace. Open the Electron app to capture a live trial.';
  const metrics=['pulse','breathing','confidence'].map(id=>{
    const cell=byId(id).parentElement;
    const spark=element('div','mini-trace');cell.append(spark);return {id,spark};
  });
  consoleView.querySelector('.signal-panel h2').lastChild.textContent=' Pulse timeline';
  const guide=element('span','monitor-guide');
  guide.setAttribute('aria-hidden','true');
  monitor.append(guide);
  const timeline=element('div','capture-timeline');timeline.tabIndex=0;
  timeline.setAttribute('role','group');timeline.setAttribute('aria-label','Pulse timeline. Use left and right arrows to inspect each estimate.');
  byId('chart').after(timeline);
  byId('chart').hidden=true;
  const trust=byId('view-trust'), lanes=trust.querySelectorAll('.trust-flow article');
  const laneSpecs=[['01 / Measurement','SDK observations','sensor'],['02 / Policy','Frozen rule','policy'],['03 / Verdict','Rule outcome','verdict']];
  lanes.forEach((lane,i)=>{
    lane.firstElementChild.textContent=laneSpecs[i][0];
    lane.querySelector('h2').textContent=laneSpecs[i][1];
    lane.prepend(glyph(paths[laneSpecs[i][2]]));
  });
  trust.querySelector('.eyebrow').textContent='Evidence flow';
  trust.querySelector('.trust-flow article:nth-of-type(2) p').textContent='The rule checks the saved pulse range, confidence, timing, and optional blink response.';
  const cards=trust.querySelectorAll('.two-columns section');
  cards[0].querySelector('h2').textContent='What the rule knew';
  cards[1].querySelector('h2').textContent='What it could not know';
  cards[1].querySelector('.explain-list').replaceChildren(...['Who provided the input','Whether someone was present at capture time','Where the camera stream originated','How the rule would perform for new participants'].map(t=>element('li','',t)));

  let lastTrial=null, pointerIndex=null, lastStatus='';
  let points=[], visibleDuration=90, warmupSec=12;
  const line = (svg,attrs) => svg.append(vector('line',attrs));
  function hatch(svg) {return window.SpoofCharts.hatch(svg);}
  function sparkSeries(holder,rows,field,unit){
    const values=(rows||[]).filter(s=>Number.isFinite(s[field])&&Number.isFinite(s.elapsedSec)).slice(-24);
    if(!values.length){
      if(holder.dataset.shape!=='empty')holder.replaceChildren(element('span','missing-note','Awaiting samples'));
      holder.dataset.shape='empty';return;
    }
    const stamp=values.length+'|'+values.at(-1).elapsedSec+'|'+values.at(-1)[field];
    if(holder.dataset.shape===stamp)return;
    holder.dataset.shape=stamp;
    const svg=vector('svg',{viewBox:'0 0 120 24',preserveAspectRatio:'none',role:'img','aria-label':unit+' trend, '+values.length+' recent samples. Last value '+values.at(-1)[field]+' '+unit+'.'});
    const min=Math.min(...values.map(s=>s[field])),max=Math.max(...values.map(s=>s[field]));
    const domain=values.at(-1).elapsedSec-values[0].elapsedSec;
    const x=s=>2+(domain?(s.elapsedSec-values[0].elapsedSec)/domain*116:58);
    const y=s=>max===min?12:22-((s[field]-min)/(max-min))*20;
    let d='';
    values.forEach((s,i)=>{d+=(i&&s.elapsedSec-values[i-1].elapsedSec<=5?' L':' M')+x(s)+' '+y(s);});
    svg.append(vector('path',{d,fill:'none',stroke:'currentColor','stroke-width':1.75,'vector-effect':'non-scaling-stroke'}));
    const end=values.at(-1), dot=vector('circle',{cx:x(end),cy:y(end),r:2,fill:'currentColor'});dot.append(vector('title',{},end[field]+' '+unit+'; n = '+values.length));svg.append(dot);
    holder.replaceChildren(svg);
  }
  function timelineDraw(){
    const w=Math.max(250,Math.round(timeline.clientWidth||560)), h=134, left=38,right=w-14,top=12,bottom=h-24;
    const svg=vector('svg',{viewBox:'0 0 '+w+' '+h,width:'100%',height:h,role:'img','aria-label':points.length+' pulse estimates, shaded warm-up, hatched observation gaps'});
    const x=t=>left+t/visibleDuration*(right-left),y=v=>bottom-v/180*(bottom-top);
    svg.append(vector('rect',{x:left,y:top,width:x(Math.min(warmupSec,visibleDuration))-left,height:bottom-top,fill:'var(--signal-dim)',opacity:.26}));
    const fill=hatch(svg);
    for(const val of [0,60,120,180]){
      line(svg,{x1:left,x2:right,y1:y(val),y2:y(val),stroke:'var(--text)',opacity:.08});
      svg.append(vector('text',{x:left-7,y:y(val)+4,'text-anchor':'end'},String(val)));
    }
    for(const fraction of [0,.5,1])svg.append(vector('text',{x:x(fraction*visibleDuration),y:h-4,'text-anchor':'middle'},Math.round(fraction*visibleDuration)+'s'));
    if(!points.length){
      if (right>x(warmupSec)) svg.append(vector('rect',{x:x(warmupSec),y:top,width:right-x(warmupSec),height:bottom-top,fill}));
      byId('chart-caption').textContent='Start a trial to see timestamped pulse estimates.';
    }else{
      let d='';const clippedY=v=>Math.min(bottom,Math.max(top,y(v)));
      points.forEach((p,i)=>{
        const previous=points[i-1], gap=previous&&p.elapsedSec-previous.elapsedSec>5;
        if(gap)svg.append(vector('rect',{x:x(previous.elapsedSec),y:top,width:x(p.elapsedSec)-x(previous.elapsedSec),height:bottom-top,fill}));
        d+=(!i||gap?' M':' L')+x(p.elapsedSec)+' '+clippedY(p.value);
        const dot=vector('circle',{cx:x(p.elapsedSec),cy:clippedY(p.value),r:2,fill:'var(--signal)'});
        dot.append(vector('title',{},p.elapsedSec.toFixed(2)+' s · '+p.value+' BPM · n = '+points.length));svg.append(dot);
      });
      svg.append(vector('path',{d,stroke:'var(--signal)',fill:'none','stroke-width':1.7,'pointer-events':'none'}));
      const selected=Number.isInteger(pointerIndex)?points[pointerIndex]:null;
      if(selected){
        line(svg,{x1:x(selected.elapsedSec),x2:x(selected.elapsedSec),y1:top,y2:bottom,stroke:'var(--neutral)','stroke-dasharray':'3 3'});
        byId('chart-caption').textContent=selected.elapsedSec.toFixed(2)+' s · '+selected.value+' BPM · n = '+points.length;
      }else byId('chart-caption').textContent=points.length+' observed estimates · Hatching marks gaps over 5 s';
    }
    timeline.replaceChildren(svg);
  }
  timeline.onpointermove=e=>{
    if(!points.length)return;
    const box=timeline.getBoundingClientRect(), t=(e.clientX-box.left-38)/Math.max(1,box.width-52)*visibleDuration;
    const closest=points.reduce((best,p,i)=>Math.abs(p.elapsedSec-t)<Math.abs(points[best].elapsedSec-t)?i:best,0);
    if(pointerIndex!==closest){pointerIndex=closest;timelineDraw();}
  };
  timeline.onpointerleave=timeline.onblur=()=>{pointerIndex=null;timelineDraw();};
  timeline.onkeydown=e=>{
    if(!points.length||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();pointerIndex=Math.min(points.length-1,Math.max(0,(pointerIndex??(e.key==='ArrowRight'?-1:points.length))+(e.key==='ArrowRight'?1:-1)));timelineDraw();
  };
  new ResizeObserver(timelineDraw).observe(timeline);
  function chart(samples,duration,trial){
    points=samples.filter(s=>Number.isFinite(s.elapsedSec)&&Number.isFinite(s.value));
    visibleDuration=duration;warmupSec=trial?.protocol?.warmupSec??window.SpoofProtocol.PROTOCOL.warmupSec;
    timelineDraw();
    sparkSeries(metrics[0].spark,samples,'value','BPM');
    sparkSeries(metrics[1].spark,trial?.breathingSamples,'value','breaths/min');
    sparkSeries(metrics[2].spark,samples,'confidence','%');
  }
  function update({run,cameraCheck,cameraRefresh,restartRequired,isElectron,ready,fps,elapsed}){
    const file=byId('condition').value==='injected_replay', consent=byId('consent').checked&&(byId('condition').value==='live'||byId('recording-consent').checked);
    const permissions=[consent, file?null:ready, !file||!!byId('file').files.length];
    const credential=Boolean(byId('key').value.trim());
    const status=[...permissions,isElectron,credential,!!run,!!cameraCheck,!!cameraRefresh,restartRequired].join('|');
    byId('status').classList.toggle('quiet-preview',!isElectron);
    if(!run&&!lastTrial){
      const minutes=Math.floor(Number(byId('duration').value)/60);
      const seconds=Number(byId('duration').value)%60;
      byId('clock').textContent='00:00 / '+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
    }
    if(lastStatus!==status){
      checkNodes.forEach(({label,cell},i)=>{
        const ok=permissions[i];cell.dataset.status=ok===true?'ready':'waiting';
        cell.replaceChildren(glyph(ok===true?paths.tick:paths.pending),document.createTextNode(label+' · '+(ok===null?'N/A':ok?'ready':'pending')));
      });
      detail.textContent=permissions.filter(v=>v!==false).length+' / 3 requirements';
      readiness.textContent=run?'Trial in progress.':cameraCheck?'Checking delivered camera frames…':cameraRefresh?'Looking for cameras…':restartRequired?'Restart the app to begin another trial.':!isElectron?'Live capture requires the Electron desktop app.':!permissions[0]?'Review consent to continue.':!permissions[2]?'Select your input file.':permissions[1]===false?'Run the camera frame-rate check.':!credential?'Enter your SDK key in the credential field.':'Capture requirements met.';
      lastStatus=status;
    }
    const currentFps=run?.trial.frameDiagnostics?.at(-1)?.sourceFps??fps;
    fpsText.textContent=Number.isFinite(currentFps)?currentFps.toFixed(1):'Unavailable';
    rateMeter.hidden=!Number.isFinite(currentFps);if(!rateMeter.hidden)rateMeter.value=currentFps;
    byId('start').setAttribute('aria-busy',String(!!run&&!run.ready));
    const seconds=run?.ready?elapsed:(!run&&lastTrial?lastTrial.durationSec:null);
    const limit=(run?.trial??lastTrial)?.protocol?.warmupSec??window.SpoofProtocol.PROTOCOL.warmupSec;
    const portion=seconds===null?0:Math.min(1,seconds/limit);
    arc.setAttribute('stroke-dasharray',portion*100+' 100');
    byId('warmup-progress').value=portion*limit;
    byId('warmup-time').textContent=seconds===null?'Awaiting input':portion>=1?'Window elapsed':Math.floor(seconds)+' / '+limit+' s';
    if(run||cameraCheck||cameraRefresh){lastTrial=null;byId('preview-heading').textContent='Opening source';byId('preview-detail').textContent='Watch this panel for capture and validation feedback.';}
    else if(!lastTrial){byId('preview-heading').textContent='Prepare your source';byId('preview-detail').textContent=file?'Select a recording and confirm permission before starting.':'Choose an input, confirm consent, then check the camera frame rate.';}
  }
  function verdict(outcome,pending){
    const lane=lanes[2];
    lane.firstElementChild.replaceWith(glyph(pending?paths.pending:outcome==='accepted'?paths.tick:outcome==='rejected'?paths.verdict:paths.info));
    lane.classList.toggle('abstaining',!pending&&outcome==='inconclusive');
  }
  function complete(trial){
    lastTrial=trial;
    byId('preview-heading').textContent=trial.endReason==='completed'?'Capture complete. Source released.':'Capture ended. Source released.';
    byId('preview-detail').textContent=trial.durationSec.toFixed(1)+' s recorded · '+trial.samples.length+' pulse estimates · '+trial.endReason.replaceAll('_',' ');
  }
  function clear(){lastTrial=null;}
  function blink(challenge){
    let dots=byId('blink-markers');
    if(!dots){dots=element('div','blink-markers');dots.id='blink-markers';byId('blink-count').after(dots);}
    if(dots.dataset.target===String(challenge.target)&&dots.dataset.count===String(challenge.blinks.length))return;
    dots.dataset.target=challenge.target;dots.dataset.count=challenge.blinks.length;
    dots.setAttribute('aria-label',challenge.blinks.length+' observed of '+challenge.target+' requested');
    dots.replaceChildren(...Array.from({length:challenge.target},(_,i)=>glyph(i<challenge.blinks.length?paths.tick:paths.pending)));
  }
  window.SpoofCaptureUI={chart,update,complete,clear,blink,verdict};
})();
