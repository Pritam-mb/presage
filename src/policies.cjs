/* Frozen source-blind experimental policies. No authentication claim. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpoofPolicies=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LIMITATION='Input provenance not established. Not proof of live human presence.';
  const THRESHOLDS=Object.freeze({pulseWarmupSec:12,minimumPostWarmupPulseEstimates:10,minimumStableFraction:0.5,maximumValidationErrorFrameFraction:0.2});
  const POLICIES=Object.freeze([
    Object.freeze({id:'pulse-only-v1',version:'v1',name:'Pulse only'}),
    Object.freeze({id:'quality-gated-v1',version:'v1',name:'Quality gated'}),
    Object.freeze({id:'pulse-plus-blink-v1',version:'v1',name:'Pulse plus blink'})
  ]);
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const count=n=>Number.isInteger(n)&&n>=0;
  const fraction=n=>finite(n)&&n>=0&&n<=1;
  function evaluate(policyId,measurements){
    const policy=POLICIES.find(p=>p.id===policyId);if(!policy)throw new Error('Unknown frozen policy');
    const m=measurements||{},metricsRead={},missingFields=[],reasons=[];
    const thresholds={pulseWarmupSec:THRESHOLDS.pulseWarmupSec,minimumPostWarmupPulseEstimates:THRESHOLDS.minimumPostWarmupPulseEstimates};
    const read=(name,valid)=>{const value=m[name];metricsRead[name]=valid(value)?value:null;if(!valid(value))missingFields.push(name);return valid(value)?value:null;};
    function result(decision){return {policyId:policy.id,version:policy.version,decision,reasons:[...reasons],missingFields:[...missingFields],metricsRead,thresholds,limitations:[LIMITATION,'Experimental policy decisions apply only to the supplied measurements. Passing does not establish identity, consent or input authenticity.']};}
    const completed=read('completed',n=>typeof n==='boolean');
    const errors=read('technicalErrorCount',count);
    if(missingFields.length){reasons.push('Completion or technical-error evidence is missing.');return result('abstain');}
    if(!completed||errors>0){reasons.push(!completed?'Trial did not complete its prescribed duration.':'Technical errors prevent a reliable policy assessment.');return result('abstain');}
    if(policyId==='pulse-plus-blink-v1'){
      thresholds.requiresFreshChallengeIssuedDuringTrial=true;
      metricsRead.challenge={issuedDuringTrial:m.challenge?.issuedDuringTrial===true,state:typeof m.challenge?.state==='string'?m.challenge.state:null};
      if(m.challenge?.issuedDuringTrial!==true){missingFields.push('challenge.issuedDuringTrial');reasons.push('No fresh randomized blink challenge is recorded as issued during this trial.');return result('abstain');}
    }
    const pulses=read('pulseEstimateCount',count);
    if(pulses===null){reasons.push('Post-warm-up pulse estimate count is missing.');return result('abstain');}
    if(pulses<THRESHOLDS.minimumPostWarmupPulseEstimates){reasons.push('Fewer than ten post-warm-up pulse estimates.');return result('fail');}
    if(policyId==='pulse-only-v1'){reasons.push('At least ten post-warm-up pulse estimates are present.');return result('pass');}
    thresholds.minimumStableFraction=THRESHOLDS.minimumStableFraction;thresholds.maximumValidationErrorFrameFraction=THRESHOLDS.maximumValidationErrorFrameFraction;
    const stable=read('stablePulseFraction',fraction),warnings=read('validationErrorFrameFraction',fraction);
    if(missingFields.length){reasons.push('Stability or per-frame validation evidence is missing; it is not inferred from event counts.');return result('abstain');}
    if(stable<THRESHOLDS.minimumStableFraction||warnings>THRESHOLDS.maximumValidationErrorFrameFraction){
      if(stable<THRESHOLDS.minimumStableFraction)reasons.push('Stable pulse fraction is below 0.5.');
      if(warnings>THRESHOLDS.maximumValidationErrorFrameFraction)reasons.push('Validation-error frame fraction exceeds 0.2.');
      return result('fail');
    }
    if(policyId==='quality-gated-v1'){reasons.push('Pulse count, stable fraction and validation-frame requirements are satisfied.');return result('pass');}
    thresholds.requiresFreshChallengeIssuedDuringTrial=true;
    const c=m.challenge;
    metricsRead.challenge={issuedDuringTrial:c?.issuedDuringTrial===true,state:typeof c?.state==='string'?c.state:null};
    if(c?.issuedDuringTrial!==true){missingFields.push('challenge.issuedDuringTrial');reasons.push('No fresh randomized blink challenge is recorded as issued during this trial.');return result('abstain');}
    if(!['passed','failed'].includes(c.state)){missingFields.push('challenge.completedOutcome');reasons.push('The issued blink challenge has no evaluable completed outcome.');return result('abstain');}
    reasons.push(c.state==='passed'?'The recorded fresh blink challenge was matched.':'The recorded fresh blink challenge was not matched.');
    return result(c.state==='passed'?'pass':'fail');
  }
  function fromTrialMeasurements(trial){
    const t=trial||{},duration=finite(t.durationSec)?t.durationSec:null,prescribed=finite(t.protocol?.durationSec)?t.protocol.durationSec:null;
    const completed=duration!==null&&prescribed!==null&&typeof t.endReason==='string'?t.endReason==='completed'&&duration>=prescribed-0.25:null;
    let pulseEstimateCount=null,stablePulseFraction=null;
    if(Array.isArray(t.samples)&&duration!==null){
      const seen=new Set(),samples=[];
      for(const s of t.samples){if(!s||!finite(s.elapsedSec)||s.elapsedSec<12||s.elapsedSec>duration||!finite(s.value)||s.value<=0)continue;
        const key=s.timestamp!=null?String(s.timestamp):String(s.elapsedSec);if(seen.has(key))continue;seen.add(key);samples.push(s);
      }
      pulseEstimateCount=samples.length;
      if(samples.length&&samples.every(s=>typeof s.stable==='boolean'))stablePulseFraction=samples.filter(s=>s.stable===true).length/samples.length;
    }
    const frames=t.validationFrames;
    const validationErrorFrameFraction=count(frames?.known)&&frames.known>0&&count(frames.warning)&&frames.warning<=frames.known?frames.warning/frames.known:null;
    const c=t.challenge;let challenge={issuedDuringTrial:false,state:null};
    if(c&&duration!==null){
      const issued=finite(c.issuedAtSec)&&finite(c.deadlineSec)&&c.issuedAtSec>=0&&c.deadlineSec>c.issuedAtSec&&c.deadlineSec<=duration;
      const logged=Array.isArray(t.challengeEvents)&&t.challengeEvents.some(e=>e?.event==='issued'&&finite(e.elapsedSec)&&Math.abs(e.elapsedSec-c.issuedAtSec)<0.001&&e.target===c.target);
      const validCount=[1,2,3].includes(c.target)&&Array.isArray(c.blinks)&&c.blinks.every(b=>finite(b)&&b>=c.issuedAtSec&&b<=c.deadlineSec);
      const consistent=validCount&&((c.state==='passed'&&c.blinks.length===c.target)||(c.state==='failed'&&c.blinks.length!==c.target));
      challenge={issuedDuringTrial:issued&&logged,state:consistent?c.state:null};
    }
    return {completed,technicalErrorCount:Array.isArray(t.errors)?t.errors.length:null,pulseEstimateCount,stablePulseFraction,validationErrorFrameFraction,challenge};
  }
  function decisionTrace(policyId,measurements,reference={}){
    const evaluation=evaluate(policyId,measurements);
    // Reference is attached only after the source-blind decision. No source labels are copied.
    return {schema:'spooflab-policy-trace-v1',trial_id:typeof reference.trialId==='string'?reference.trialId:null,
      sourceTrialReference:typeof reference.sourceTrialReference==='string'?reference.sourceTrialReference:null,...evaluation};
  }
  return {POLICIES,THRESHOLDS,LIMITATION,evaluate,fromTrialMeasurements,decisionTrace};
});
