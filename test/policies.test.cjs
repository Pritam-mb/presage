const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const E=require('../src/policies.cjs');
const good=()=>({completed:true,technicalErrorCount:0,pulseEstimateCount:10,stablePulseFraction:.5,validationErrorFrameFraction:.2,challenge:{issuedDuringTrial:true,state:'passed'}});
test('frozen threshold values and policy identifiers match the committed specification',()=>{
 const spec=JSON.parse(fs.readFileSync(path.join(__dirname,'../protocols/frozen-v1.json')));
 assert.deepEqual(E.POLICIES.map(p=>p.id),spec.policies.map(p=>p.id));assert.equal(E.THRESHOLDS.pulseWarmupSec,spec.protocol.pulseWarmupSec);
 assert.equal(E.THRESHOLDS.minimumPostWarmupPulseEstimates,spec.policies[0].minimumPostWarmupPulseEstimates);
 assert.equal(E.THRESHOLDS.minimumStableFraction,spec.policies[1].minimumStableFraction);assert.equal(E.THRESHOLDS.maximumValidationErrorFrameFraction,spec.policies[1].maximumValidationErrorFrameFraction);
});
test('boundaries are inclusive and missing fields abstain instead of inferred failure',()=>{
 for(const p of E.POLICIES)assert.equal(E.evaluate(p.id,good()).decision,'pass');
 assert.equal(E.evaluate('pulse-only-v1',{...good(),pulseEstimateCount:9}).decision,'fail');
 assert.equal(E.evaluate('quality-gated-v1',{...good(),stablePulseFraction:.499}).decision,'fail');
 assert.equal(E.evaluate('quality-gated-v1',{...good(),validationErrorFrameFraction:.201}).decision,'fail');
 assert.equal(E.evaluate('quality-gated-v1',{...good(),validationErrorFrameFraction:null}).decision,'abstain');
 assert.equal(E.evaluate('pulse-only-v1',{...good(),completed:false}).decision,'abstain');
 assert.equal(E.evaluate('pulse-only-v1',{...good(),technicalErrorCount:1}).decision,'abstain');
});
test('blink policy abstains without an issued challenge or a completed outcome',()=>{
 assert.equal(E.evaluate('pulse-plus-blink-v1',{...good(),challenge:null}).decision,'abstain');
 assert.equal(E.evaluate('pulse-plus-blink-v1',{...good(),pulseEstimateCount:0,challenge:null}).decision,'abstain');
 assert.equal(E.evaluate('pulse-plus-blink-v1',{...good(),challenge:{issuedDuringTrial:true,state:'active'}}).decision,'abstain');
 assert.equal(E.evaluate('pulse-plus-blink-v1',{...good(),challenge:{issuedDuringTrial:true,state:'failed'}}).decision,'fail');
});
test('policy decision and measurement adapter never access source labels or identifiers',()=>{
 const poison=new Proxy(good(),{get(target,key){if(['condition','source','recording_id','recordingId','trialId'].includes(key))throw new Error('Forbidden input read');return target[key];}});
 for(const p of E.POLICIES)assert.equal(E.evaluate(p.id,poison).decision,'pass');
 const raw={durationSec:90,protocol:{durationSec:90},endReason:'completed',errors:[],samples:Array.from({length:10},(_,i)=>({value:70,elapsedSec:12+i,stable:true})),validationFrames:{known:100,warning:20},challenge:null};
 for(const key of ['condition','source','recording_id','recordingId','trialId'])Object.defineProperty(raw,key,{get(){throw new Error('Adapter read forbidden label');}});
 const m=E.fromTrialMeasurements(raw);assert.equal(m.pulseEstimateCount,10);assert.equal(m.stablePulseFraction,1);
 assert.deepEqual(Object.keys(m),['completed','technicalErrorCount','pulseEstimateCount','stablePulseFraction','validationErrorFrameFraction','challenge']);
});
test('adapter excludes warm-up, invalid and duplicate measurements and does not use validation event frequency',()=>{
 const m=E.fromTrialMeasurements({durationSec:90,protocol:{durationSec:90},endReason:'completed',errors:[],samples:[{elapsedSec:5,value:70,stable:true},{elapsedSec:12,value:70,stable:true},{elapsedSec:12,value:70,stable:true},{elapsedSec:91,value:70,stable:true}],validationEvents:[{code:0,elapsedSec:0}]});
 assert.equal(m.pulseEstimateCount,1);assert.equal(m.validationErrorFrameFraction,null);
});
test('challenge freshness requires timing, issue event and consistent exact count',()=>{
 const raw={durationSec:90,protocol:{durationSec:90},endReason:'completed',errors:[],samples:[],challenge:{issuedAtSec:25,deadlineSec:35,target:1,blinks:[27],state:'passed'},challengeEvents:[{event:'issued',elapsedSec:25,target:1}]};
 assert.deepEqual(E.fromTrialMeasurements(raw).challenge,{issuedDuringTrial:true,state:'passed'});
 assert.equal(E.fromTrialMeasurements({...raw,challengeEvents:[]}).challenge.issuedDuringTrial,false);
 assert.equal(E.fromTrialMeasurements({...raw,challenge:{...raw.challenge,blinks:[27,28]}}).challenge.state,null);
});
test('trace attaches reference after evaluation and always discloses provenance limit',()=>{
 const trace=E.decisionTrace('quality-gated-v1',good(),{trialId:'test-reference',sourceTrialReference:'saved-test'});
 assert.equal(trace.trial_id,'test-reference');assert.equal(trace.sourceTrialReference,'saved-test');assert.equal(trace.decision,'pass');assert.ok(trace.limitations.includes(E.LIMITATION));
 assert.equal(trace.thresholds.minimumStableFraction,.5);assert.equal(trace.metricsRead.validationErrorFrameFraction,.2);
});
