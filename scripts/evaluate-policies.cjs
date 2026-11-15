// Derived policy evidence only. Never modifies capture originals or source labels.
const fs=require('node:fs'),path=require('node:path');
const P=require('../src/policies.cjs');
function evaluateTrials(trials){
  const ids=new Set();
  return {schema:'spooflab-policy-trace-set-v1',generatedAt:new Date().toISOString(),
    limitations:[P.LIMITATION,'Retrospective evaluations of saved measurements; related trials are not independent observations.'],
    traces:trials.flatMap(t=>{
      if(typeof t.trialId!=='string'||ids.has(t.trialId))throw new Error('Missing or duplicate trial ID');
      ids.add(t.trialId);
      const measurements=P.fromTrialMeasurements(t);
      return P.POLICIES.map(p=>P.decisionTrace(p.id,measurements,{trialId:t.trialId,sourceTrialReference:'saved-trial:'+t.trialId}));
    })};
}
if(require.main===module){
  const root=process.cwd(),input=JSON.parse(fs.readFileSync(path.join(root,'evidence/analysis/consolidated-dataset.json'),'utf8'));
  if(!Array.isArray(input.trials))throw new Error('Expected saved trial report');
  const result=evaluateTrials(input.trials),out=path.join(root,'evidence/analysis/policy-traces.json');
  fs.writeFileSync(out,JSON.stringify(result,null,2));
  console.log(result.traces.length+' derived policy traces saved locally; original trials unchanged.');
}
module.exports={evaluateTrials};
