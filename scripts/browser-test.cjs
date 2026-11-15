const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const {startServer}=require('./preview.cjs');const R=require('../src/reports.cjs');const {trial}=require('../test/support/fixture.cjs');
const {connect}=require('./cdp.cjs');
const root=path.resolve(__dirname,'..'),artifact=path.join(root,'artifacts');fs.mkdirSync(artifact,{recursive:true});
const candidates=[process.env.SPOOFLAB_BROWSER,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean);
const browserPath=candidates.find(p=>fs.existsSync(p));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,server,socket;const pending=new Map();let nextId=0;const errors=[];
function send(method,params={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
(async()=>{
  if(!browserPath)throw new Error('No local Chromium browser found. Set SPOOFLAB_BROWSER.');
  server=await startServer(0);const port=server.address().port;
  const profile=path.join(root,'.browser-profile',String(Date.now()));fs.mkdirSync(profile,{recursive:true});
  browser=spawn(browserPath,['--headless=new','--disable-gpu','--disable-extensions','--no-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  browser.on('error',error=>errors.push(error.message));
  const activePort=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(activePort);i++)await delay(100);
  if(!fs.existsSync(activePort))throw new Error('Browser did not expose its debugging port. '+errors.join(';'));
  const debugPort=fs.readFileSync(activePort,'utf8').split('\n')[0];
  const targets=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket=await connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl,m=>{if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));});
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1150,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  for(let i=0;i<100;i++){if(await evaluate('document.readyState === "complete" && !!window.SpoofReports'))break;await delay(50);}
  if(errors.length)throw new Error('Page exceptions: '+errors.join('\n'));
  if(!await evaluate('window.SpoofReports && document.querySelector("#start").disabled'))console.log(await evaluate('JSON.stringify({url:location.href,ua:navigator.userAgent,protocol:typeof SpoofProtocol,reports:typeof SpoofReports,label:document.querySelector("#runtime-label").textContent,scripts:[...document.scripts].map(s=>s.src)})'));
  assert.equal(await evaluate('document.querySelector("#start").disabled'),true,'Browser preview must not pretend to support SDK capture');
  assert.equal(await evaluate('document.querySelector("#preview-banner").hidden'),false);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Desktop must not overflow');
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(artifact,'capture-workspace.png'),Buffer.from(screenshot.data,'base64'));
  await evaluate('document.querySelector("[data-view=evidence]").click()');
  assert.equal(await evaluate('document.querySelector("#view-evidence").hidden'),false);
  const fixture=path.join(artifact,'synthetic-test-only.json');fs.writeFileSync(fixture,JSON.stringify(R.report([trial(),trial({trialId:'synthetic-inconclusive',condition:'injected_replay',samples:[]})])));
  await send('DOM.enable');const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#import-file'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#total-trials").textContent === "2"'))break;await delay(50);}
  assert.equal(await evaluate('document.querySelector("#total-trials").textContent'),'2');
  assert.equal(await evaluate('document.querySelector("#total-accepted").textContent'),'1');
  assert.equal(await evaluate('document.querySelector("#total-inconclusive").textContent'),'1');
  assert.equal(await evaluate('document.querySelector("#export-json").disabled'),false);
  await evaluate('document.querySelector("#filter").value="live";document.querySelector("#filter").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelectorAll("#trials tr").length'),1);
  await evaluate('document.querySelector("#trials button").click()');assert.equal(await evaluate('document.querySelector("#detail-panel").hidden'),false);
  await evaluate('document.querySelector("#privacy").click()');assert.equal(await evaluate('document.querySelector("#privacy-dialog").open'),true);await evaluate('document.querySelector("#close-privacy").click()');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Mobile must not overflow');
  await evaluate('document.querySelector("#clear").click();document.querySelector("#confirm-clear").click()');
  assert.equal(await evaluate('document.querySelector("#total-trials").textContent'),'0');assert.equal(await evaluate('document.querySelector("#detail-panel").hidden'),true);
  // Exercise renderer lifecycle with an explicitly synthetic SDK, never the real camera.
  await send('Emulation.setUserAgentOverride',{userAgent:'SpoofLab-test Electron/40.0'});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__testNow=0;performance.now=()=>window.__testNow;
    let syntheticFrameTime=0;
    HTMLVideoElement.prototype.requestVideoFrameCallback=function(callback){return setTimeout(()=>{syntheticFrameTime+=1000/30;callback(syntheticFrameTime,{mediaTime:syntheticFrameTime/1000});},20);};
    HTMLVideoElement.prototype.cancelVideoFrameCallback=function(id){clearTimeout(id);};
    class TestSDK {
      static version='SYNTHETIC-TEST-ONLY';
      constructor(options){this.options=options;this.handlers={};window.__sdk=this;}
      on(name,handler){this.handlers[name]=handler;}
      async start(){if(window.__defer)await new Promise(resolve=>window.__release=resolve);this.handlers.validationStatus(0,0,'SYNTHETIC TEST');}
      useMediaStream(stream){this.stream=stream;}
      async stop(){this.stopped=true;}
      destroy(){this.destroyed=true;}
    }
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').fillRect(0,0,640,480);return canvas.captureStream(30);}}});
    window.SpoofSDK={SmartSpectraSDK:TestSDK,ValidationCode:{kOk:0},ProcessingStatus:{},breathingMetrics:[],cardioMetrics:[],faceMetrics:[],decodeMetrics:value=>value};
  `});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/src/index.html`});
  for(let i=0;i<100;i++){if(await evaluate('document.readyState === "complete" && document.querySelector("#runtime-label")?.textContent === "Electron capture environment"'))break;await delay(50);}
  await evaluate('document.querySelector("#duration").value="60";document.querySelector("#key").value="SYNTHETIC-KEY";document.querySelector("#consent").checked=true;document.querySelector("#check-camera").click()');
  for(let i=0;i<400;i++){if(await evaluate('document.querySelector("#frame-status").textContent.includes("Camera-only result:")'))break;await delay(20);}
  assert.equal(await evaluate('document.querySelector("#start").disabled'),false,'Synthetic qualifying FPS check enables camera trial');
  await evaluate('document.querySelector("#start").click()');
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#status").textContent.includes("Collecting real SDK")'))break;await delay(20);}
  assert.equal(await evaluate('window.__sdk.options.enableTelemetry'),false);
  await evaluate(`window.__testNow=20000;window.__sdk.handlers.metrics({cardio:{pulseRate:${JSON.stringify(trial().samples.map(s=>({...s,timestamp:Number(s.timestamp)})))}}});window.__testNow=61000;`);
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#total-trials").textContent === "1"'))break;await delay(20);}
  assert.equal(await evaluate('document.querySelector("#total-accepted").textContent'),'1','Complete synthetic SDK trial should satisfy the policy');
  assert.equal(await evaluate('window.__sdk.destroyed && window.__sdk.stopped'),true);
  assert.equal(await evaluate('document.querySelector("#start").disabled'),false);
  await evaluate('window.__defer=true;document.querySelector("#start").click()');await delay(30);
  await evaluate('document.querySelector("#stop").click();window.__release()');
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#total-trials").textContent === "2"'))break;await delay(20);}
  assert.equal(await evaluate('document.querySelector("#total-inconclusive").textContent'),'1','Cancellation during startup must remain inconclusive');
  await evaluate('window.__defer=false;document.querySelector("#start").click()');
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#status").textContent.includes("Collecting real SDK")'))break;await delay(20);}
  await evaluate('window.__sdk.handlers.error(14,"Synthetic low-frame-rate stop",true)');
  for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#total-trials").textContent === "3"'))break;await delay(20);}
  assert.equal(await evaluate('document.querySelector("#total-inconclusive").textContent'),'2','Retryable low FPS must immediately finalize an inconclusive trial');
  assert.equal(await evaluate('document.querySelector("#error").textContent.includes("not a failed blink")'),true);
  await evaluate('document.querySelector("#check-camera").click()');
  for(let i=0;i<400;i++){if(await evaluate('document.querySelector("#frame-status").textContent.includes("Camera-only result:")'))break;await delay(20);}
  assert.equal(await evaluate('document.querySelector("#frame-status").textContent.includes("Camera-only result:")'),true);
  assert.equal(await evaluate('document.querySelector("#total-trials").textContent'),'3','Camera-only diagnostics must not create SDK trials');
  // Model Lab tab smoke test: mount, metadata form, consent, train button state, evaluation render.
  await evaluate('document.querySelector("[data-view=ml]").click()');
  for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("view-ml").hidden'))break;await delay(20);}
  assert.equal(await evaluate('!document.getElementById("view-ml").hidden'),true,'Model Lab view must be visible after nav click');
  assert.equal(await evaluate('document.getElementById("ml-train").disabled'),true,'Train button must be disabled without SpoofMLBridge');
  assert.equal(await evaluate('!!document.getElementById("ml-trial")'),true,'Trial selector must exist');
  assert.equal(await evaluate('!!document.getElementById("ml-dataset-consent")'),true,'Consent checkbox must exist');
  assert.equal(await evaluate('document.getElementById("ml-results").children.length > 0'),true,'Evaluation placeholder must be rendered');
  assert.equal(await evaluate('document.getElementById("ml-dataset-count").textContent.includes("0 of 3")'),true,'Dataset count must reflect current trials');
  const exploratoryFile=path.join(root,'evidence','analysis','exploratory-fit.json');
  if(fs.existsSync(exploratoryFile)){
    const mlDoc=await send('DOM.getDocument');const mlInput=await send('DOM.querySelector',{nodeId:mlDoc.root.nodeId,selector:'#ml-evaluation-file'});
    await send('DOM.setFileInputFiles',{nodeId:mlInput.nodeId,files:[exploratoryFile]});
    for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#ml-results").textContent.includes("Training-data exploration")'))break;await delay(50);}
    assert.equal(await evaluate('document.querySelector("#ml-results").textContent.includes("Training-data exploration")'),true);
    assert.equal(await evaluate('document.querySelector("#ml-results").textContent.includes("Shuffled-label training control")'),true);
    assert.equal(await evaluate('!!document.querySelector("#ml-inspector table")'),true);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  assert.deepEqual(errors,[],'Browser runtime exceptions');
  console.log('Browser checks passed: preview mode, desktop/mobile layout, import/recompute, counts, filter, inspect, privacy, clear, synthetic SDK completion and startup cancellation, Model Lab tab mount. No real SDK measurements tested.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{socket?.close();browser?.kill();if(server)await new Promise(resolve=>server.close(resolve));});
