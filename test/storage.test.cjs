const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {createStore}=require('../src/storage.cjs');const {trial}=require('./support/fixture.cjs');const R=require('../src/reports.cjs');
test('local store restores metrics and ML consent, redacts key and deletes saved trials',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'spooflab-store-'));const store=createStore(dir);
 try{await store.save(R.report([trial({notes:'private-key',ml:{datasetConsent:true,participantId:'p1',sessionId:'s1',recordingGroupId:'r1'}})]),'private-key');
 const saved=await store.load();assert.equal(saved.trials.length,1);assert.equal(saved.trials[0].ml.datasetConsent,true);assert.equal(saved.trials[0].notes,'[redacted]');
 await store.clear();assert.equal((await store.load()).trials.length,0);
 }finally{await store.clear();await fs.rmdir(dir);}
});
