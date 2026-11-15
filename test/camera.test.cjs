const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/camera.cjs');
test('selected camera uses exact ID and never silently falls back',async()=>{
  const request=C.constraints(640,'phone-device',true);
  assert.deepEqual(request.video.deviceId,{exact:'phone-device'});
  assert.equal(request.video.frameRate.min,25);
  assert.equal(request.video.facingMode,undefined);
  let calls=0;
  await assert.rejects(C.acquire({getUserMedia:async requested=>{calls++;assert.equal(requested,request);throw new Error('Selected device disconnected');}},request),/disconnected/);
  assert.equal(calls,1);
});
test('diagnostic permits slower camera rates without altering SDK requirements',()=>{
  assert.equal(C.constraints(640,'',false).video.frameRate.min,undefined);
  assert.equal(C.constraints(1280,'',true).video.frameRate.min,25);
});
test('cancelled camera permission request releases its eventual stream',async()=>{
  let resolveRequest,stopped=0,cancelled=false;
  const pending=C.acquire({getUserMedia:()=>new Promise(resolve=>{resolveRequest=resolve;})},{video:true},{isCancelled:()=>cancelled});
  await Promise.resolve();cancelled=true;
  resolveRequest({getTracks:()=>[{stop:()=>stopped++}]});
  await assert.rejects(pending,/cancelled/);assert.equal(stopped,1);
});
test('timed out permission request releases late stream rather than leaking camera',async()=>{
  let resolveRequest,stopped=0;
  const pending=C.acquire({getUserMedia:()=>new Promise(resolve=>{resolveRequest=resolve;})},{video:true},{timeoutMs:5});
  await assert.rejects(pending,/timed out/);
  resolveRequest({getTracks:()=>[{stop:()=>stopped++}]});await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(stopped,1);
});
test('report metadata excludes device and group identifiers',()=>{
  const data=C.metadata({label:'Phone camera',getSettings:()=>({deviceId:'secret-device',groupId:'secret-group',width:640,height:480,frameRate:30})});
  assert.deepEqual(data,{label:'Phone camera',width:640,height:480,frameRate:30});
  assert.ok(!JSON.stringify(data).includes('secret'));
});
