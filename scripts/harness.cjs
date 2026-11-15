// Master-contract runner. The supplied reference harness is preserved verbatim.
// This wrapper appends the requested G7/G8/G9/G10 checks; it never changes evidence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {audit}=require('./g10-public-repo.cjs');
const P=require('../src/policies.cjs');
const reference=path.join(__dirname,'reference','harness.cjs');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function readJSON(root,name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));}
function additions(root,options={}){
 const results=[];
 const add=(id,name,hard,ok,detail='')=>results.push({id,name,hard,ok:!!ok,detail});
 // The optional G7 snippet is also preserved exactly as supplied.
 const exists=p=>fs.existsSync(path.join(root,p));
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'reference','ml-gate.cjs'),'utf8'),{exists,read,add,JSON});
 const testFile=path.join(root,'test','policies.test.cjs');
 const source=path.join(root,'src','policies.cjs');
 let signatureOK=false,testOK=false;
 if(fs.existsSync(source)){
  const text=fs.readFileSync(source,'utf8');
  const signatures=[...text.matchAll(/function\s+(evaluate|fromTrialMeasurements)\s*\(([^)]*)\)/g)];
  signatureOK=signatures.length===2&&signatures.every(m=>!/(?:condition|source|recording_?id)/i.test(m[2]));
 }
 if(fs.existsSync(testFile)){
  const r=spawnSync(process.execPath,['--test',testFile],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  testOK=r.status===0;
 }
 add('G8.1','Source-blind policy signatures and behavioral tests',true,signatureOK&&testOK,'Policy adapter/evaluator signatures exclude condition, source and recording IDs; policy tests must pass.');
 let traces=[];try{const d=readJSON(root,'evidence/analysis/policy-traces.json');traces=Array.isArray(d.traces)?d.traces:[];}catch{}
 const validTrace=t=>{
  if(!t||t.schema!=='spooflab-policy-trace-v1'||typeof t.trial_id!=='string'||!t.trial_id||typeof t.sourceTrialReference!=='string'||!t.sourceTrialReference)return false;
  if(!P.POLICIES.some(p=>p.id===t.policyId&&p.version===t.version)||!['pass','fail','abstain'].includes(t.decision))return false;
  if(!t.thresholds||typeof t.thresholds!=='object'||!Object.keys(t.thresholds).length||!t.metricsRead||typeof t.metricsRead!=='object'||!Object.keys(t.metricsRead).length)return false;
  if(!Array.isArray(t.missingFields)||!Array.isArray(t.reasons)||!t.reasons.length||!Array.isArray(t.limitations)||!t.limitations.includes(P.LIMITATION))return false;
  const expected=P.evaluate(t.policyId,t.metricsRead);
  return expected.decision===t.decision&&Object.entries(expected.thresholds).every(([k,v])=>t.thresholds[k]===v);
 };
 const covered=P.POLICIES.every(p=>traces.some(t=>t.policyId===p.id&&validTrace(t)));
 add('G8.2','At least one saved decision trace per frozen policy',true,covered,'evidence/analysis/policy-traces.json; thresholds, exact metrics, missing fields, reasons, limitations and source reference are required.');
 let analysisOK=true;
 for(const name of ['paired.json','challenge-tradeoff.json']){
  try{const d=readJSON(root,'evidence/analysis/'+name);if(!finite(d.n)||d.n<0)analysisOK=false;}catch{analysisOK=false;}
 }
 const cut=exists('docs/ANALYSIS_CUT.md')&&read('docs/ANALYSIS_CUT.md').trim().length>100;
 add('G9.1','Derived paired/challenge analyses state n, or explain the cut',true,analysisOK||cut,'Derived reports must state n; a substantive ANALYSIS_CUT.md may explain unavailable analyses.');
 const target=options.publicRoot?path.resolve(root,options.publicRoot):root;
 const g10=audit(target);
 add('G10','Source-only public repository cleanliness',true,g10.passed,g10.passed?'Source-only Git index/history check passed.':g10.failures.join(' | '));
 return results;
}
function markdown(report){
 const rows=report.results.map(r=>`| ${r.id} | ${r.name.replace(/\|/g,'/')} | ${r.hard?'hard':'soft'} | ${r.ok?'PASS':'FAIL'} | ${String(r.detail||'').replace(/\s+/g,' ').replace(/\|/g,'/').slice(0,220)} |`);
 return ['# HARNESS STATUS','',`Run: ${report.at} | mode: ${report.final?'FINAL':'working'} | protected reference plus v3 additions`,'','| Gate | Check | Type | Result | Detail |','|---|---|---|---|---|',...rows,'',report.ready?'ALL HARD GATES PASS.':`NOT DONE: ${report.results.filter(r=>r.hard&&!r.ok).length} hard gate(s) failing.`,'','The supplied reference thresholds and claim lists are unchanged. This audit cannot establish trial honesty, participant permission or the contents of a video. Manual M1–M5 reviews remain separate. No real evidence, Git history, remote or publication is modified.',''].join('\n');
}
function run(root=process.cwd(),options={}){
 root=path.resolve(root);
 const args=[reference,...(options.final?['--final']:[]),...(options.skipRun?['--skip-run']:[])];
 const started=Date.now();
 const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
 let base;
 try{base=readJSON(root,'harness-report.json');if(!Array.isArray(base.results)||Date.parse(base.at)<started)throw new Error('Invalid or stale report');}
 catch{base={at:new Date().toISOString(),final:!!options.final,results:[{id:'REFERENCE',name:'Supplied reference harness completed',hard:true,ok:false,detail:'Reference runner did not produce a valid report; inspect local implementation.'}]};}
 if(result.error||result.signal)base.results.push({id:'REFERENCE_RUNTIME',name:'Reference execution completed',hard:true,ok:false,detail:'Reference runner was interrupted or could not execute.'});
 const report={...base,at:new Date().toISOString(),final:!!options.final,contract:'protected-reference-plus-v3',results:[...base.results,...additions(root,options)]};
 report.ready=!report.results.some(r=>r.hard&&!r.ok);
 fs.writeFileSync(path.join(root,'harness-report.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(root,'HARNESS_STATUS.md'),markdown(report));
 return report;
}
if(require.main===module){
 try{const index=process.argv.indexOf('--public-root');const options={final:process.argv.includes('--final'),skipRun:process.argv.includes('--skip-run'),publicRoot:index>=0?process.argv[index+1]:undefined};if(index>=0&&!options.publicRoot)throw new Error('Missing public repository path');const report=run(process.cwd(),options);console.log(markdown(report));process.exitCode=report.ready?0:1;}
 catch{console.error('Harness failed before completion; readiness is not established. No secret values are printed.');process.exitCode=1;}
}
module.exports={additions,run,markdown};
