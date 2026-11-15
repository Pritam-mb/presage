const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateTrials}=require('../scripts/evaluate-policies.cjs');
test('retrospective traces identify each policy while decisions stay blind to source metadata',()=>{
 const t={trialId:'synthetic-trace',synthetic:true,durationSec:90,endReason:'completed',protocol:{durationSec:90},samples:[],errors:[]};
 Object.defineProperty(t,'condition',{get(){throw new Error('Source label leaked');}});
 Object.defineProperty(t,'source',{get(){throw new Error('Source metadata leaked');}});
 const result=evaluateTrials([t]);assert.equal(result.traces.length,3);
 for(const trace of result.traces){assert.equal(trace.trial_id,t.trialId);assert.ok(trace.limitations.some(l=>l.includes('Input provenance not established')));}
 assert.throws(()=>evaluateTrials([t,t]),/duplicate/);
});
