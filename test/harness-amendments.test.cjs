const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {scan}=require('../scripts/claim-audit.cjs');
test('claim scan accepts diagnostics and explicit limitations but rejects product promises',()=>{
 assert.deepEqual(scan('Capture diagnostics and diagnostic counters.','README.md'),[]);
 assert.deepEqual(scan('This does not provide secure authentication.','src/index.html'),[]);
 assert.ok(scan('This detects deepfakes.','docs/POST.md').length);
 assert.ok(scan('This provides a diagnosis.','src/index.html').length);
 assert.ok(scan('This provides secure authentication.','README.md').length);
 assert.deepEqual(scan('Examples: proves liveness','docs/harness.md'),[]);
 assert.deepEqual(scan('Examples: diagnosis','test/claims.test.cjs'),[]);
});
test('retained low/unknown FPS trials cannot replace a quality-qualified live baseline',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spooflab-amended-'));
 function write(name,data){const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof data==='string'?data:JSON.stringify(data));}
 function run(){const r=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/harness-runtime.cjs'),'--skip-run'],{cwd:root,encoding:'utf8',windowsHide:true});assert.ok([0,1].includes(r.status));return JSON.parse(fs.readFileSync(path.join(root,'harness-report.json'),'utf8')).results;}
 try{
  write('.gitignore','.env\nartifacts/\n');write('LICENSE','Synthetic test fixture only');
  const trial={schema:'spooflab.trial.v2',synthetic:false,trial_id:'synthetic-attempt',sdk:{version:'test-fixture'},started_at:'2026-11-15T00:00:00Z',ended_at:'2026-11-15T00:01:30Z',duration_s:90,condition:'live',source:{},consent:{subject_consented:true},camera:{delivered_fps:21},protocol:{},outcome:'signal_observed',metrics:{}};
  const name='evidence/real/trials/fixture.json';write(name,trial);
  let r=run();assert.equal(r.find(g=>g.id==='G2.2').ok,true);assert.equal(r.find(g=>g.id==='G3.2').ok,false);assert.ok(r.find(g=>g.id==='G2.3').detail.includes('synthetic-attempt'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,name),'utf8')).camera.delivered_fps,21,'Audit never rewrites the source');
  trial.camera.delivered_fps=null;write(name,trial);r=run();assert.equal(r.find(g=>g.id==='G3.2').ok,false);
  trial.camera.delivered_fps=28;write(name,trial);r=run();assert.equal(r.find(g=>g.id==='G3.2').ok,true);
 }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(root).startsWith('spooflab-amended-'));fs.rmSync(root,{recursive:true,force:true});}
});
