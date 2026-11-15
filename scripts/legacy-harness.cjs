const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {summarize}=require('./legacy-summarize.cjs');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const conditions=['live','photo','screen_replay','injected_replay'];
function equivalent(a,b){if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equivalent(a[k],b[k]));}
function readJSON(root,name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8').replace(/^\uFEFF/,''));}
function git(root,args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});return r.status===0?r.stdout:null;}
function rawFile(name){return /^(?:data\/|recordings\/|datasets\/|ml-output\/|evidence\/(?!summary\.json$))/.test(name)||/(?:^|\/)\.env(?:$|\.(?!example$))/.test(name)||/\.(?:mp4|webm|mov|avi)$/i.test(name);}
function gate(id,name,failures,details=[]){return {id,name,passed:!failures.length,failures:[...new Set(failures)],details};}
function assess(root=process.cwd(),options={}){
 root=path.resolve(root);const gates=[],trials=[],schemaErrors=[],privacyErrors=[],privacyDetails=[];
 const dir=path.join(root,'evidence/real/trials');
 if(!fs.existsSync(dir))schemaErrors.push('No real trial directory exists.');
 const ids=new Set();
 for(const name of fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>n.endsWith('.json')):[]){
  try{const t=readJSON(root,'evidence/real/trials/'+name);
   if(t.schema!=='spooflab.trial.v2'||t.synthetic!==false||typeof t.trial_id!=='string'||!t.trial_id||ids.has(t.trial_id)||!conditions.includes(t.condition)||!finite(t.duration_s)||t.duration_s<0||!['signal_observed','no_signal','inconclusive'].includes(t.outcome)||!t.metrics||!t.gate)throw new Error('Invalid or duplicate trial');
   const text=JSON.stringify(t);if(/"(?:deviceId|groupId|filePath|apiKey|fileName|label|samples|breathingSamples|traceSamples|cardiacTraceSamples)"\s*:/i.test(text))privacyErrors.push('Forbidden private metadata or series in sanitized trial '+name);
   ids.add(t.trial_id);trials.push(t);
  }catch{schemaErrors.push('Invalid evidence file: '+name);}
 }
 if(!trials.length)schemaErrors.push('No valid real trial records.');
 const tracked=git(root,['ls-files','-z']);const history=git(root,['log','--all','--pretty=format:','--name-only']);
 if(tracked===null||history===null)privacyErrors.push('Git tracking/history could not be audited.');
 const trackedPaths=(tracked||'').split('\0').filter(Boolean);const trackedRaw=trackedPaths.filter(rawFile);const historicRaw=[...new Set((history||'').split(/\r?\n/).filter(rawFile))];
 if(trackedRaw.length)privacyErrors.push(`${trackedRaw.length} private evidence/media/environment files are tracked in the index.`);
 if(historicRaw.length)privacyErrors.push(`${historicRaw.length} private evidence/media/environment paths remain in existing Git history. Do not publish that history unchanged.`);
 privacyDetails.push(`Index private paths: ${trackedRaw.length}; history private paths: ${historicRaw.length}. Files are not deleted or history rewritten by this command.`);
 // Scan public source/docs/current tracked files against configured secret values; never print values.
 const secrets=[];const envFile=path.join(root,'.env');
 if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){const m=line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*)$/);if(m&&/(?:key|token|secret|password)/i.test(m[1])){let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);else v=v.split(/\s+#/)[0].trim();if(v.length>8)secrets.push(v);}}
 const publicPaths=new Set(trackedPaths.filter(n=>!rawFile(n)&&!n.startsWith('node_modules/')));
 function addTree(relative){const absolute=path.join(root,relative);if(!fs.existsSync(absolute))return;for(const ent of fs.readdirSync(absolute,{withFileTypes:true})){if(ent.isSymbolicLink())continue;const name=relative+'/'+ent.name;if(ent.isDirectory()){if(!['node_modules','__pycache__'].includes(ent.name))addTree(name);}else publicPaths.add(name);}}
 for(const d of ['src','scripts','docs','ml','test'])addTree(d);
 for(const ent of fs.readdirSync(root,{withFileTypes:true}))if(ent.isFile()&&/\.(?:md|json|ya?ml)$/.test(ent.name))publicPaths.add(ent.name);
 for(const name of publicPaths){const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||fs.statSync(file).size>5_000_000)continue;const text=fs.readFileSync(file,'utf8');if(secrets.some(s=>text.includes(s)))privacyErrors.push('Configured secret detected in public candidate: '+name);}
 gates.push(gate('G1','Evidence schema and repository privacy',[...schemaErrors,...privacyErrors],privacyDetails));
 const completed=t=>t.duration_s>=89.75&&t.outcome!=='inconclusive';
 const lowFps=t=>Object.entries(t.metrics?.validation_counts||{}).some(([key,n])=>/frameratetoolow|sustainedlowframerate/i.test(key)&&n>0);
 const live=trials.filter(t=>t.condition==='live').sort((a,b)=>String(a.started_at).localeCompare(String(b.started_at)));
 const baseline=live.filter(t=>t.blink_challenge?.enabled===false).slice(-3);
 const cameraErrors=[];let fps;
 try{fps=readJSON(root,'evidence/real/camera_fps.json');}catch{}
 if(!fps||fps.schema!=='spooflab-camera-fps-v1'||fps.synthetic!==false||!finite(fps.delivered_fps)||fps.delivered_fps<25||!finite(fps.duration_s)||fps.duration_s<6)cameraErrors.push('Missing valid real six-second camera diagnostic with delivered FPS >=25.');
 if(baseline.length!==3||baseline.some(t=>!completed(t)||lowFps(t)))cameraErrors.push('Three consecutive clean 90-second live baselines with blink off are not established.');
 gates.push(gate('G2','Camera delivery and baseline readiness',cameraErrors,[`Latest blink-off live baselines available: ${baseline.length}/3. Short last-window FPS in a trial does not replace the diagnostic.`]));
 const counts={},matrixErrors=[];for(const [condition,min]of Object.entries({live:3,photo:2,screen_replay:3,injected_replay:3})){const xs=trials.filter(t=>t.condition===condition);counts[condition]={attempts:xs.length,completed:xs.filter(completed).length,minimumAttempts:min};if(xs.length<min)matrixErrors.push(`${condition}: ${xs.length}/${min} required attempts.`);if(xs.length&& !xs.some(completed))matrixErrors.push(`${condition}: no completed nontechnical trial; all attempts are inconclusive.`);}
 gates.push(gate('G3','Controlled condition matrix',matrixErrors,Object.entries(counts).map(([c,v])=>`${c}: ${v.attempts} attempts, ${v.completed} completed; minimum ${v.minimumAttempts} attempts. Failed attempts remain in the denominator.`)));
 const blinkCounts={};for(const c of ['live','screen_replay']){const xs=trials.filter(t=>t.condition===c&&t.blink_challenge?.enabled===true);blinkCounts[c]={attempts:xs.length,usable:xs.filter(t=>completed(t)&&['passed','failed'].includes(t.blink_challenge?.state)).length};}
 const blinkErrors=[];if(blinkCounts.live.usable<5)blinkErrors.push(`Live blink-on usable trials: ${blinkCounts.live.usable}/5.`);if(blinkCounts.screen_replay.usable<4)blinkErrors.push(`Screen-replay blink-on usable trials: ${blinkCounts.screen_replay.usable}/4 (the existing case plus three more).`);
 gates.push(gate('G4','Blink observation coverage',blinkErrors,[JSON.stringify(blinkCounts),'Counts are exploratory observations; no replay resistance or population false-reject accuracy is established.']));
 const mlErrors=[];let ml;
 try{ml=readJSON(root,'evidence/analysis/exploratory-fit.json');}catch{}
 if(!ml)mlErrors.push('Exploratory model report missing.');
 else{
  if(ml.status!=='exploratory_fitted'||ml.evaluationMode!=='training_only')mlErrors.push('Exploratory output is not explicitly scoped as training only.');
  if(!Array.isArray(ml.splits)||ml.splits.some(s=>s.testTrialIds?.length||s.testGroups?.length))mlErrors.push('Exploratory report incorrectly declares a test set.');
  if(!Array.isArray(ml.models)||!ml.models.length||ml.models.some(m=>!Array.isArray(m.predictions)||m.predictions.some(p=>p.sampleRole!=='training')))mlErrors.push('Exploratory predictions lack explicit training provenance.');
  const control=ml.shuffledLabelControl;
  if(!control||control.runs!==50||!Array.isArray(control.shuffledLabelMatches)||control.shuffledLabelMatches.length!==50||control.shuffledLabelMatches.some(x=>!Number.isInteger(x)||x<0||x>control.trainingTrials))mlErrors.push('Missing or invalid 50-run shuffled-label control.');
  if(ml.models?.some(m=>m.metrics?.accuracy!==undefined))mlErrors.push('Exploratory report still exposes aggregate accuracy.');
 }
 gates.push(gate('G5','Exploratory ML guardrails',mlErrors,['Strict grouped insufficiency is an honest result; exploratory fitting cannot replace independent validation. This gate checks report guards, not model validity or every UI label.']));
 const publicationErrors=[];let summary;
 try{summary=readJSON(root,'evidence/summary.json');if(!schemaErrors.length&&!equivalent(summary,summarize(trials)))publicationErrors.push('summary.json differs from recomputation over current trial files.');}catch{publicationErrors.push('Missing or invalid aggregate summary.');}
 for(const name of ['docs/DEV_POST.md','docs/DEMO_VIDEO.md'])if(!fs.existsSync(path.join(root,name)))publicationErrors.push('Missing '+name);
 let publication;try{publication=readJSON(root,'docs/publication.json');}catch{}
 const publicURL=x=>typeof x==='string'&&/^https:\/\/[A-Za-z0-9][^\s]+$/.test(x)&&!/(?:pending|example\.com|localhost)/i.test(x);
 if(!publication||!publicURL(publication.videoUrl)||!publicURL(publication.publicRepoUrl)||publication.consentReviewed!==true)publicationErrors.push('docs/publication.json must contain actual videoUrl/publicRepoUrl and consentReviewed=true after operator review.');
 gates.push(gate('G6','Publication evidence and aggregate consistency',publicationErrors,['URL fields and consentReviewed are operator attestations, not network or legal verification. Draft file existence is not a recorded video. No publishing is performed.']));
 const failures=gates.flatMap(g=>g.failures.map(f=>`${g.id}: ${f}`));
 return {schema:'spooflab-readiness-v2',generatedAt:new Date().toISOString(),mode:options.final?'final':'diagnostic',ready:failures.length===0,basicChecksPassed:!schemaErrors.length&&trials.length>0,realTrialFiles:trials.length,counts,blinkCounts,gates,failures};
}
function markdown(report){return ['# SpoofLab harness status','',`Generated: ${report.generatedAt}. Mode: ${report.mode}. **Final readiness: ${report.ready?'PASS':'BLOCKED'}**.`, '',`Real trial files: ${report.realTrialFiles}. A diagnostic run reports all final gates; it does not declare submission readiness merely because schema checks pass.`, '',...report.gates.flatMap(g=>[`## ${g.id} — ${g.name}: ${g.passed?'PASS':'BLOCKED'}`,'',...g.failures.map(s=>'- '+s),...g.details.map(s=>'- '+s),'']), '## Limits of this audit','', 'This tool does not verify that cameras or recordings are genuine, prove public-use permissions, watch a demo video, verify every post claim, or establish security/ML validity. It checks local evidence and operator attestations. No secrets are printed, no files are deleted, no Git history is rewritten and no remote is changed.',''].join('\n');}
function run(root=process.cwd(),options={}){const report=assess(root,options);fs.writeFileSync(path.join(root,'HARNESS_STATUS.md'),markdown(report));return report;}
if(require.main===module){try{const final=process.argv.includes('--final');const report=run(process.cwd(),{final});console.log(JSON.stringify(report,null,2));process.exitCode=(final?!report.ready:!report.basicChecksPassed)?1:0;}catch{const message='# SpoofLab harness status\n\nAudit failed unexpectedly; final readiness is not established. Inspect the local evidence and tool implementation.\n';fs.writeFileSync('HARNESS_STATUS.md',message);console.error('Harness failed; see HARNESS_STATUS.md. No secret values are printed.');process.exitCode=1;}}
module.exports={assess,run,markdown,rawFile};

