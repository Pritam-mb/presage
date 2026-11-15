// Startup smoke test only: never starts measurements or requests camera access.
const fs=require('node:fs');const path=require('node:path');const net=require('node:net');const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
const {connect}=require('./cdp.cjs');
const root=path.resolve(__dirname,'..');let child,socket;let seq=0;const pending=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Desktop CDP timeout: '+method));},15000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Desktop renderer exception during startup verification.');return r.result.value;}
(async()=>{
  const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});const fd=fs.openSync(path.join(root,'artifacts','desktop-runtime.log'),'a');
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(require('electron'),[`--remote-debugging-port=${port}`,'.'],{cwd:root,env,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
  let target;
  for(let i=0;i<200;i++){try{const list=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=list.find(t=>t.type==='page'&&t.url.startsWith('file:'));if(target)break;}catch{}await delay(100);}
  if(!target)throw new Error('Electron did not expose the app page. Inspect artifacts/desktop-runtime.log locally.');
  socket=await connect(target.webSocketDebuggerUrl,m=>{if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}}});
  for(let i=0;i<100;i++){if(await evaluate('document.readyState === "complete" && document.querySelector("#runtime-label")?.textContent === "Electron capture environment"'))break;await delay(100);}
  for(let i=0;i<200;i++){if(await evaluate('document.querySelector("#check-camera")?.disabled === false'))break;await delay(100);}
  assert.equal(await evaluate('document.querySelector("#check-camera").disabled'),false,'Camera diagnostic must be enabled after saved-trial restoration');
  assert.equal(await evaluate('document.querySelector("#start").disabled'),true,'Camera trials require a fresh FPS check');
  assert.equal(await evaluate('typeof window.__smartspectraBridge === "object"'),true,'Official SDK preload bridge must be present');
  await evaluate('new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="../dist/sdk.js";s.onload=()=>resolve(true);s.onerror=()=>reject(new Error("Adapter failed to load"));document.head.append(s);})');
  assert.equal(await evaluate('typeof window.SpoofSDK?.SmartSpectraSDK'), 'function');
  assert.equal(await evaluate('typeof window.SpoofMLBridge?.train'),'function');
  const training=await evaluate('window.SpoofMLBridge.train({schema:"spooflab-evidence-v2",trials:[]})');
  assert.equal(training.status,'insufficient_data','Empty datasets must not fabricate performance results');
  const realDataset=path.join(root,'evidence','analysis','consolidated-dataset.json');
  if(fs.existsSync(realDataset)){
    const dataset=JSON.parse(fs.readFileSync(realDataset,'utf8'));dataset.trials=dataset.trials.filter(t=>t.ml?.datasetConsent===true);
    const exploratory=await evaluate(`window.SpoofMLBridge.train(${JSON.stringify(dataset)},'exploratory')`);
    assert.equal(exploratory.status,'exploratory_fitted');assert.equal(exploratory.evaluationMode,'training_only');
    assert.equal(exploratory.models.length,2);assert.equal(exploratory.splits[0].testTrialIds.length,0);
    console.log('Desktop exploratory training IPC passed with consented real records; no held-out scores claimed.');
  }
  // Compare only presence, never print or return the key itself.
  const {parseEnv}=require('node:util');const envPath=path.join(root,'.env');const configured=process.env.PRESAGE_API_KEY|| (fs.existsSync(envPath)?parseEnv(fs.readFileSync(envPath,'utf8')).PRESAGE_API_KEY:'');
  if(configured?.trim())assert.equal(await evaluate('document.querySelector("#key").value.length > 0'),true,'Configured key should populate the password field');
  console.log('Desktop startup passed: Electron page, native SDK bridge, real SDK adapter, and configured key presence. Camera was not opened; measurements not tested.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{socket?.close();child?.kill();});
