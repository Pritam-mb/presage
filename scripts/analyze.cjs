// Derived descriptive analyses only. Never writes source trials or participant metadata.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const P=require('../src/protocol.cjs');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const completed=t=>t.endReason==='completed'&&finite(t.durationSec)&&t.durationSec>=89.75&&Array.isArray(t.errors)&&t.errors.length===0&&t.consent?.attested===true;
function pulse(t){
 const seen=new Set();
 return (t.samples||[]).filter(s=>{
  if(!finite(s.elapsedSec)||s.elapsedSec<12||s.elapsedSec>t.durationSec||!finite(s.value)||s.value<=0)return false;
  const key=s.timestamp==null?'elapsed:'+s.elapsedSec:String(s.timestamp);
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
function trialPulse(t){
 const samples=pulse(t),windows=[];
 for(let start=12;start+12<=t.durationSec;start+=12){const values=samples.filter(s=>s.elapsedSec>=start&&s.elapsedSec<start+12).map(s=>s.value);windows.push({start_sec:start,end_sec:start+12,n:values.length,mean_bpm:mean(values)});}
 return {trial_id:t.trialId,condition:t.condition,n:samples.length,mean_bpm:mean(samples.map(s=>s.value)),windows_12_sec:windows};
}
function paired(trials,explicitPairs=[]){
 const usable=trials.filter(completed),groups=new Map(),comparisons=[];
 for(const t of usable){if(!t.ml?.participantId||t.ml.datasetConsent!==true)continue;const key=t.ml.participantId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
 let person=0;
 for(const [,ts]of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  person++;const live=ts.filter(t=>t.condition==='live'),replay=ts.filter(t=>['screen_replay','injected_replay'].includes(t.condition));
  if(!live.length||!replay.length)continue;
  const l=live.flatMap(pulse).map(s=>s.value),r=replay.flatMap(pulse).map(s=>s.value);
  comparisons.push({participant_alias:'person-'+person,n:1,comparison_type:'same_person_pooled_conditions_not_recording_paired',live:{n:live.length,n_sdk_estimates:l.length,mean_bpm:mean(l),trials:live.map(trialPulse)},replay:{n:replay.length,n_sdk_estimates:r.length,mean_bpm:mean(r),trials:replay.map(trialPulse)},difference_replay_minus_live_bpm:l.length&&r.length?mean(r)-mean(l):null});
 }
 const pairs=[],seen=new Set();
 for(const p of explicitPairs){
  if(p.source_relationship_attested!==true)throw new Error('Pair requires explicit source-recording relationship attestation.');
  const live=usable.find(t=>t.trialId===p.live_trial_id&&t.condition==='live'),replay=usable.find(t=>t.trialId===p.replay_trial_id&&['screen_replay','injected_replay'].includes(t.condition));
  if(!live||!replay||!live.ml?.participantId||live.ml.participantId!==replay.ml?.participantId)throw new Error('Pair requires completed consenting trials of the same known person.');
  if(seen.has(live.trialId)||seen.has(replay.trialId))throw new Error('Repeated trials are not independent pairs.');
  seen.add(live.trialId);seen.add(replay.trialId);const l=trialPulse(live),r=trialPulse(replay);
  if(l.mean_bpm===null||r.mean_bpm===null)throw new Error('Pair lacks eligible SDK pulse estimates.');
  pairs.push({live:l,replay:r,pair_mean_bpm:(l.mean_bpm+r.mean_bpm)/2,difference_replay_minus_live_bpm:r.mean_bpm-l.mean_bpm});
 }
 const differences=pairs.map(p=>p.difference_replay_minus_live_bpm),bias=mean(differences),sd=pairs.length>1?Math.sqrt(differences.reduce((a,x)=>a+(x-bias)**2,0)/(pairs.length-1)):null;
 return {schema:'spooflab-paired-analysis-v1',analysis:'agreement between two SDK outputs',n:pairs.length,n_within_person_comparisons:comparisons.length,n_completed_trials:usable.length,status:pairs.length>=5?'descriptive_agreement':'insufficient_recording_pairs',pairs,within_person_comparisons:comparisons,bland_altman:pairs.length>=5?{n:pairs.length,mean_difference_bpm:bias,lower_limit_bpm:bias-1.96*sd,upper_limit_bpm:bias+1.96*sd}:null,limitations:['Same-person live and replay trials do not establish that the live trial captured the recording used for replay. No pairing is inferred from aliases or adjacent dates.',pairs.length<5?'Fewer than five attested source-recording pairs: agreement cannot be estimated.':'Descriptive limits require review of participant independence and paired-difference assumptions; they do not establish population agreement.','Pooled SDK estimates and 12-second averaged output windows are correlated; their counts are not independent participants.','No ground truth or measurement-accuracy claim. Validation warnings remain in original evidence.','Reports are local derived artifacts, not cleared for publication.']};
}
function faceSamples(t){
 const seen=new Set();return (t.faceSamples||[]).filter(s=>{
  if(!finite(s.elapsedSec)||s.elapsedSec<0||s.elapsedSec>t.durationSec||typeof s.detected!=='boolean')return false;
  const key=s.timestamp==null?'elapsed:'+s.elapsedSec:String(s.timestamp);if(seen.has(key))return false;seen.add(key);return true;
 }).sort((a,b)=>a.elapsedSec-b.elapsedSec);
}
function stableSegments(samples,maxGapSec=.25){
 const segments=[];let current=[];
 for(const s of samples){
  if(s.stable!==true){if(current.length)segments.push(current);current=[];continue;}
  if(current.length&&s.elapsedSec-current.at(-1).elapsedSec>maxGapSec){segments.push(current);current=[];}
  current.push(s);
 }
 if(current.length)segments.push(current);return segments;
}
function counter(samples,start,windowSec,target){
 const challenge=P.createChallenge(target,start,windowSec);
 for(const s of samples)P.updateChallenge(challenge,s);
 P.closeChallenge(challenge);return challenge;
}
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function challengeTradeoff(trials,{draws=1000,seed=20261115,maxGapSec=.25}={}){
 if(!Number.isInteger(draws)||draws<1)throw new Error('Simulation draws must be a positive integer.');
 const replay=trials.filter(t=>['screen_replay','injected_replay'].includes(t.condition)),eligible=replay.filter(completed),timelines=eligible.map(t=>({t,samples:faceSamples(t)})).filter(t=>t.samples.length>0),simulation=[];
 const random=rng(seed);
 for(const windowSec of [5,10,15]){
  const sources=timelines.map(x=>({...x,segments:stableSegments(x.samples,maxGapSec).filter(seg=>seg.at(-1).elapsedSec-seg[0].elapsedSec>windowSec)})).filter(x=>x.segments.length);
  for(const requiredCount of [1,2,3]){
   let passes=0;const perTrial=new Map(sources.map(x=>[x.t.trialId,{trial_id:x.t.trialId,n_draws:0,passes:0}]));
   if(sources.length)for(let i=0;i<draws;i++){
    // Equal trial weighting; choose an eligible start proportional to segment duration within a trial.
    const source=sources[Math.floor(random()*sources.length)],lengths=source.segments.map(seg=>seg.at(-1).elapsedSec-seg[0].elapsedSec-windowSec),total=lengths.reduce((a,b)=>a+b,0);let offset=random()*total,index=0;
    while(index<lengths.length-1&&offset>=lengths[index]){offset-=lengths[index];index++;}
    const segment=source.segments[index],start=segment[0].elapsedSec+offset,result=counter(segment,start,windowSec,requiredCount),row=perTrial.get(source.t.trialId);row.n_draws++;
    if(result.state==='passed'){passes++;row.passes++;}
   }
   simulation.push({window_sec:windowSec,required_count:requiredCount,n:sources.length,n_draws:sources.length?draws:0,passes,chance_pass_fraction:sources.length?passes/draws:null,per_trial:[...perTrial.values()]});
  }
 }
 const live=trials.filter(t=>t.condition==='live'&&t.protocol?.challengeEnabled===true),liveRows=live.map(t=>{
  const c=t.challenge,issued=finite(c?.issuedAtSec)&&finite(c?.deadlineSec),usable=completed(t)&&issued&&['passed','failed'].includes(c.state),blinks=Array.isArray(c?.blinks)?c.blinks.filter(finite):[];
  return {trial_id:t.trialId,completed:completed(t),issued,usable,challenge_state:c?.state||'not_issued',requested_count:c?.target??null,observed_count:blinks.length,first_response_latency_sec:issued&&blinks.length?blinks[0]-c.issuedAtSec:null,target_reached_latency_sec:issued&&Number.isInteger(c.target)&&blinks.length>=c.target?blinks[c.target-1]-c.issuedAtSec:null};
 });
 const usableLive=liveRows.filter(x=>x.usable),mismatchChecks=[];
 for(const t of trials.filter(t=>t.challenge&&finite(t.challenge.issuedAtSec))){const c=t.challenge,samples=faceSamples(t),recomputed=counter(samples,c.issuedAtSec,c.deadlineSec-c.issuedAtSec,c.target),stored=c.blinks||[],matches=stored.length===recomputed.blinks.length&&stored.every((time,i)=>Math.abs(time-recomputed.blinks[i])<1e-6);
  mismatchChecks.push({trial_id:t.trialId,condition:t.condition,requested_count:c.target,stored_count:stored.length,recomputed_count:recomputed.blinks.length,recomputed_matches_saved:matches,minimum_counted_interval_sec:recomputed.blinks.length>1?Math.min(...recomputed.blinks.slice(1).map((time,i)=>time-recomputed.blinks[i])):null});}
 return {schema:'spooflab-challenge-tradeoff-v1',n:timelines.length,status:timelines.length?'simulated_from_observed_timelines':'insufficient_timelines',simulation:{kind:'simulation over recorded SDK blink detections, not measured security performance',seed,draws_per_configuration:draws,max_observed_gap_sec:maxGapSec,windows_sec:[5,10,15],required_counts:[1,2,3],count_rule:'Existing stable false-to-true rising-edge counter; 250 ms debounce; exact count required; neutral state must be observed in each window.',sampling_rule:'Choose an eligible replay trial uniformly, then choose a start uniformly over its continuously observed stable segments. No gap filling or missing-event interpolation.',n_replay_attempts:replay.length,n_completed_replays:eligible.length,n_saved_replay_timelines:timelines.length,results:simulation},live_measured:{n_attempts:live.length,n:usableLive.length,hits:usableLive.filter(x=>x.challenge_state==='passed').length,observed_challenge_failures:usableLive.filter(x=>x.challenge_state==='failed').length,inconclusive:live.length-usableLive.length,trials:liveRows},counter_audit:{n:mismatchChecks.length,all_recomputed_counts_match:mismatchChecks.every(x=>x.recomputed_matches_saved),trials:mismatchChecks,interpretation:'The code counts stable false-to-true edges, not both eyelid transitions. Agreement with saved counts checks software consistency only. Without annotated video, double detections and actual blink ground truth cannot be ruled out.'},limitations:['Simulation is conditioned on available stable detections, excluding unsaved, unstable and gapped intervals. It is not an estimate for arbitrary replay recordings.','Monte Carlo draws overlap the same few timelines and are not independent trials or participants. No population interval or security claim.','Prompt locations/counts are simulated, not new observed challenges. Recorded SDK detections may include display/capture artifacts rather than genuine blinks.','Live challenge failures are measured count-rule outcomes, not validated false-reject rates; technical/incomplete trials remain separately inconclusive.','Response latency uses saved event timestamps, not independently verified human reaction time. Reports are local and not cleared for publication.']};
}
function analyze(root=path.resolve(__dirname,'..')){
 const source=path.join(root,'evidence/analysis/consolidated-dataset.json'),bytes=fs.readFileSync(source),data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 if(!Array.isArray(data.trials))throw new Error('Consolidated source lacks trials.');
 if(new Set(data.trials.map(t=>t.trialId)).size!==data.trials.length)throw new Error('Duplicate trial IDs in source.');
 const provenance={source:'evidence/analysis/consolidated-dataset.json',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),n_source_trials:data.trials.length};
 const p={...paired(data.trials),provenance},c={...challengeTradeoff(data.trials),provenance};
 for(const [name,report]of [['paired.json',p],['challenge-tradeoff.json',c]])fs.writeFileSync(path.join(root,'evidence/analysis',name),JSON.stringify(report,null,2)+'\n');
 return {paired_n:p.n,within_person_comparisons:p.n_within_person_comparisons,replay_timelines:c.n,live_usable:c.live_measured.n,counter_counts_match:c.counter_audit.all_recomputed_counts_match};
}
if(require.main===module){try{console.log(JSON.stringify(analyze(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={pulse,trialPulse,paired,faceSamples,stableSegments,counter,challengeTradeoff,analyze};
