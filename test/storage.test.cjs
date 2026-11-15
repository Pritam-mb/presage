const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {createStore}=require('../src/storage.cjs');const {trial}=require('./support/fixture.cjs');const R=require('../src/reports.cjs');
test('local store restores metrics and ML consent, redacts key and deletes saved trials',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'spooflab-store-'));const store=createStore(dir);
 try{await store.save(R.report([trial({notes:'private-key',ml:{datasetConsent:true,participantId:'p1',sessionId:'s1',recordingGroupId:'r1'}})]),'private-key');
 const saved=await store.load();assert.equal(saved.trials.length,1);assert.equal(saved.trials[0].ml.datasetConsent,true);assert.equal(saved.trials[0].notes,'[redacted]');
 await store.clear();assert.equal((await store.load()).trials.length,0);
 }finally{await store.clear();await fs.rmdir(dir);}
});

test('legacy direct trials and report autosaves restore without changing original files',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'spooflab-store-'));const store=createStore(dir);
 try{
  const legacy=trial({trialId:'z-legacy',imported:false,ml:{datasetConsent:true,participantId:'p1',sessionId:'s1',recordingGroupId:'r1'}});
  const modern=trial({trialId:'a-report',imported:true,ml:{datasetConsent:false,participantId:'p2',sessionId:'s2',recordingGroupId:'r2'}});
  const contents={'legacy.json':'\uFEFF'+JSON.stringify(legacy),'report.json':JSON.stringify(R.report([modern])),'broken.json':'{invalid'};
  for(const [name,bytes]of Object.entries(contents))await fs.writeFile(path.join(dir,name),bytes,'utf8');
  const restored=await store.load();assert.deepEqual(restored.trials.map(t=>t.trialId),['a-report','z-legacy']);
  assert.equal(restored.trials[0].imported,true);assert.equal(restored.trials[0].ml.datasetConsent,false);
  assert.equal(restored.trials[1].imported,false);assert.equal(restored.trials[1].ml.datasetConsent,true);
  assert.deepEqual(restored.issues,['broken.json']);
  for(const [name,bytes]of Object.entries(contents))assert.equal(await fs.readFile(path.join(dir,name),'utf8'),bytes,'Loading must not migrate or alter original evidence');
 }finally{await store.clear();await fs.rmdir(dir);}
});

test('identical duplicate captures do not inflate the ledger and conflicting copies are reported',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'spooflab-store-'));const store=createStore(dir);
 try{
  const same=trial({trialId:'duplicate'}),unique=trial({trialId:'unique'});
  await fs.writeFile(path.join(dir,'a.json'),JSON.stringify(same));
  await fs.writeFile(path.join(dir,'b.json'),JSON.stringify(R.report([same,unique])));
  let restored=await store.load();assert.deepEqual(restored.trials.map(t=>t.trialId),['duplicate','unique']);assert.deepEqual(restored.issues,[]);
  await fs.writeFile(path.join(dir,'c.json'),JSON.stringify(trial({trialId:'duplicate',notes:'Conflicting synthetic trial'})));
  restored=await store.load();assert.deepEqual(restored.trials.map(t=>t.trialId),['unique']);assert.deepEqual(restored.issues,['a.json','b.json','c.json']);
  assert.equal((await fs.readdir(dir)).length,3,'Conflicting originals must remain available for review');
 }finally{await store.clear();await fs.rmdir(dir);}
});
