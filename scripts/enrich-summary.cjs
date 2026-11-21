// Add derived research aggregates after the unchanged reference summarizer.
// No participant identifiers, recordings or time series enter this output.
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd();
function read(name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}
const summary=read('evidence/summary.json');
const ml=read('evidence/analysis/exploratory-fit.json'),control=ml.shuffledLabelControl;
if(!control||control.runs!==50||control.matchOrExceedReal!==control.shuffledLabelMatches.filter(n=>n>=control.realLabelMatches).length)throw new Error('Unverified shuffled-label control');
summary.research={shuffled_matches:control.matchOrExceedReal,shuffled_runs:control.runs,exploratory_trials:control.trainingTrials,
 limitations:'Training-data exploration only; not accuracy on new sessions. Counts describe dependent trials, not independent people.'};
const strictPath=path.join(root,'evidence/analysis/evaluation.json');
if(fs.existsSync(strictPath)){
 const strict=read('evidence/analysis/evaluation.json'),audit=strict.dataset?.independentEvidenceAudit;
 if(audit){summary.research.strict_status=strict.status;summary.research.mixed_groups=audit.mixedGroups;summary.research.total_groups=audit.totalGroups;summary.research.minimum_mixed_groups=audit.minimumMixedGroups;}
}
for(const [name,file]of [['paired','paired.json'],['challenge','challenge-tradeoff.json']]){
 const absolute=path.join(root,'evidence/analysis',file);
 if(fs.existsSync(absolute)){
  const analysis=JSON.parse(fs.readFileSync(absolute,'utf8'));if(Number.isFinite(analysis.n))summary.research[name+'_n']=analysis.n;
  if(name==='paired')summary.research.within_person_comparisons=analysis.n_within_person_comparisons;
  if(name==='challenge'){
   summary.research.live_challenge_usable=analysis.live_measured.n;
   summary.research.live_challenge_hits=analysis.live_measured.hits;
   summary.research.live_challenge_inconclusive=analysis.live_measured.inconclusive;
   summary.research.simulation_draws=analysis.simulation.draws_per_configuration;
   summary.research.challenge_table=['| Window / seconds | Required detections | Simulated passes | Draws |','| ---: | ---: | ---: | ---: |',...analysis.simulation.results.map(r=>`| ${r.window_sec} | ${r.required_count} | ${r.passes} | ${r.n_draws} |`)].join('\n');
  }
 }
}
const gateLabels=[['live','Live'],['photo','Photograph'],['screen_replay','Screen replay'],['injected_replay','Injected replay']];
if(summary.per_condition&&gateLabels.every(([k])=>summary.per_condition[k])){
 summary.research.gate_acceptance_table=['| Declared input | Retained attempts | Conclusive | Accepted by QualityGate-v1 | Wilson 95% |','| --- | ---: | ---: | ---: | ---: |',
  ...gateLabels.map(([k,label])=>{const c=summary.per_condition[k],w=c.gate_acceptance_wilson95;
   return `| ${label} | ${c.n} | ${c.conclusive} | ${c.gate_accepted} | ${(100*w[0]).toFixed(1)}%–${(100*w[1]).toFixed(1)}% |`;})].join('\n');
}
const limitsPath=path.join(root,'evidence/analysis/loocv-limits.json');
if(fs.existsSync(limitsPath)){
 const report=read('evidence/analysis/loocv-limits.json'),limits=report.logoLimits;
 if(report.status!=='limits_report'||report.evaluationMode!=='logo_limits'||!limits)throw new Error('Unverified limits report');
 if(limits.mixedGroupsScored!==limits.folds.filter(f=>f.auc!==null).length)throw new Error('Limits folds disagree');
 summary.research.limits_scored_groups=limits.mixedGroupsScored;
 summary.research.limits_total_groups=limits.folds.length;
 summary.research.limits_mean_auc=Number(limits.meanWithinGroupAuc.toFixed(3));
 if(Array.isArray(limits.descriptiveInterval)&&limits.descriptiveInterval.length===2){
  const [low,high]=limits.descriptiveInterval;
  summary.research.limits_interval_low=Number(low.toFixed(3));summary.research.limits_interval_high=Number(high.toFixed(3));
  summary.research.limits_interval_text=`${low.toFixed(3)}–${high.toFixed(3)}`;
  summary.research.limits_includes_chance=low<=.5&&high>=.5;
 }
 if(Number.isFinite(limits.pooledAuc))summary.research.limits_pooled_auc=Number(limits.pooledAuc.toFixed(3));
}
const tracesPath=path.join(root,'evidence/analysis/policy-traces.json'),datasetPath=path.join(root,'evidence/analysis/consolidated-dataset.json');
if(fs.existsSync(tracesPath)&&fs.existsSync(datasetPath)){
 const traces=read('evidence/analysis/policy-traces.json').traces,trials=read('evidence/analysis/consolidated-dataset.json').trials;
 const policies=[['pulse-only-v1','Pulse only'],['quality-gated-v1','Quality gated'],['pulse-plus-blink-v1','Pulse + blink']];
 const columns=[['live','Live'],['screen_replay','Screen replay'],['injected_replay','Injected replay'],['printed_photo','Printed photo']];
 if(!Array.isArray(traces)||!Array.isArray(trials)||traces.length!==trials.length*policies.length)throw new Error('Policy traces do not cover every retained attempt');
 const condition=Object.fromEntries(trials.map(t=>[t.trialId,t.condition]));
 const totals=Object.fromEntries(columns.map(([state])=>[state,trials.filter(t=>t.condition===state).length]));
 const count=(policy,state,decision)=>traces.filter(t=>t.policyId===policy&&condition[t.trial_id]===state&&t.decision===decision).length;
 summary.research.frozen_policy_table=['| Frozen rule (pass / fail / abstain) | '+columns.map(([state,label])=>`${label} (${totals[state]})`).join(' | ')+' |','| --- |'+columns.map(()=>' ---: |').join(''),
  ...policies.map(([id,label])=>`| ${label} | `+columns.map(([state])=>['pass','fail','abstain'].map(d=>count(id,state,d)).join(' / ')).join(' | ')+' |')].join('\n');
 summary.completed=trials.filter(t=>t.endReason==='completed' && t.durationSec>=t.protocol.durationSec-.25).length;
 summary.incomplete=trials.length-summary.completed;
 summary.incomplete_reasons={};
 for(const t of trials.filter(t=>!(t.endReason==='completed' && t.durationSec>=t.protocol.durationSec-.25))){
  const reason=t.endReason||'unknown';
  summary.incomplete_reasons[reason]=(summary.incomplete_reasons[reason]||0)+1;
 }
 summary.research.ml_consented=ml.dataset.totalTrials;
 summary.research.naive_file_pass=count('pulse-only-v1','injected_replay','pass');
 summary.research.gated_live_pass=count('quality-gated-v1','live','pass');
 summary.research.naive_live_pass=count('pulse-only-v1','live','pass');
 summary.research.blink_live_pass=count('pulse-plus-blink-v1','live','pass');
 summary.research.failure_text=Object.entries(summary.incomplete_reasons).map(([k,n])=>k.replaceAll('_',' ')+' ('+n+')').join(', ');
 summary.policy_matrix=Object.fromEntries(policies.map(([id])=>[id,Object.fromEntries(columns.map(([condition])=>[condition,{
  attempts:totals[condition],pass:count(id,condition,'pass'),fail:count(id,condition,'fail'),abstain:count(id,condition,'abstain')
 }]))]));
 summary.research.frozen_policy_n=traces.length;
 summary.research.naive_photo_pass=count('pulse-only-v1','printed_photo','pass');
 summary.research.naive_photo_n=totals.printed_photo;
 summary.research.gated_live_fail=count('quality-gated-v1','live','fail');
 summary.research.live_n=totals.live;
 summary.research.blink_screen_pass=count('pulse-plus-blink-v1','screen_replay','pass');
 summary.research.naive_screen_pass=count('pulse-only-v1','screen_replay','pass');
 summary.research.gated_screen_pass=count('quality-gated-v1','screen_replay','pass');
 summary.research.blink_screen_abstain=count('pulse-plus-blink-v1','screen_replay','abstain');
 summary.research.blink_screen_n=totals.screen_replay;
 summary.research.blink_live_abstain=count('pulse-plus-blink-v1','live','abstain');
}
fs.writeFileSync(path.join(root,'evidence/summary.json'),JSON.stringify(summary,null,2));
console.log('Derived research aggregates added; originals unchanged.');
