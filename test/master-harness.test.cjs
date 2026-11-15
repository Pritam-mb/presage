const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {additions}=require('../scripts/harness.cjs');const P=require('../src/policies.cjs');
const root=path.resolve(__dirname,'..');
function codeAfter(file,heading){return fs.readFileSync(path.join(root,file),'utf8').split(heading)[1].match(/```js\r?\n([\s\S]*?)\r?\n```/)[1].replaceAll('\r\n','\n')+'\n';}
test('supplied reference harness and optional ML gate remain verbatim',()=>{
 assert.equal(fs.readFileSync(path.join(root,'scripts/reference/harness.cjs'),'utf8').replaceAll('\r\n','\n'),codeAfter('docs/harness.md','## `scripts/harness.cjs`'));
 assert.equal(fs.readFileSync(path.join(root,'scripts/reference/ml-gate.cjs'),'utf8').replaceAll('\r\n','\n'),codeAfter('docs/addon_spec.md','## Harness addition'));
});
test('master additions require actual saved traces, n and source-only Git history',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'spooflab-master-gates-'));
 function write(name,data){const target=path.join(temp,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data));}
 try{
  let r=additions(temp);assert.equal(r.find(x=>x.id==='G8.2').ok,false);assert.equal(r.find(x=>x.id==='G9.1').ok,false);assert.equal(r.find(x=>x.id==='G10').ok,false);
  const measurements={completed:true,technicalErrorCount:0,pulseEstimateCount:10,stablePulseFraction:.5,validationErrorFrameFraction:.2,challenge:{issuedDuringTrial:true,state:'passed'}};
  const traces=P.POLICIES.map(p=>P.decisionTrace(p.id,measurements,{trialId:'synthetic-fixture',sourceTrialReference:'synthetic-fixture'}));
  write('evidence/analysis/policy-traces.json',{synthetic:true,traces});write('evidence/analysis/paired.json',{synthetic:true,n:1});write('evidence/analysis/challenge-tradeoff.json',{synthetic:true,n:0});
  r=additions(temp);assert.equal(r.find(x=>x.id==='G8.2').ok,true);assert.equal(r.find(x=>x.id==='G9.1').ok,true);
  traces[0].decision='fail';write('evidence/analysis/policy-traces.json',{synthetic:true,traces});assert.equal(additions(temp).find(x=>x.id==='G8.2').ok,false,'A trace that disagrees with its metrics cannot establish coverage');
  let final=additions(temp,{final:true});assert.equal(final.find(g=>g.id==='G5.5').ok,false);assert.equal(final.find(g=>g.id==='G5.5').hard,true);assert.equal(final.find(g=>g.id==='G5.6').ok,false);
  fs.mkdirSync(path.join(temp,'docs'),{recursive:true});
  fs.writeFileSync(path.join(temp,'docs/SUBMISSION.md'),['M1','M2','M3','M4','M5'].map(id=>'- [x] '+id+': synthetic reviewer fixture').join('\n'));
  fs.writeFileSync(path.join(temp,'docs/ORIGINALITY.md'),'Review completed at: '+new Date().toISOString()+'\nProof of Breath compared with source https://example.invalid/synthetic-review');
  final=additions(temp,{final:true});assert.equal(final.find(g=>g.id==='G5.5').ok,true);assert.equal(final.find(g=>g.id==='G5.6').ok,true);
  fs.writeFileSync(path.join(temp,'docs/ORIGINALITY.md'),'Review completed at: 2020-01-01T00:00:00Z\nProof of Breath https://example.invalid/synthetic-review');
  assert.equal(additions(temp,{final:true}).find(g=>g.id==='G5.6').ok,false,'A stale review cannot satisfy final readiness');
 }finally{const base=path.resolve(os.tmpdir())+path.sep;assert.ok(path.resolve(temp).startsWith(base)&&path.basename(temp).startsWith('spooflab-master-gates-'));fs.rmSync(temp,{recursive:true,force:true});}
});
