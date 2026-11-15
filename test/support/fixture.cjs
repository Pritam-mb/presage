const { PROTOCOL } = require('../../src/protocol.cjs');
function pulse(start=12,count=7) { return Array.from({length:count},(_,i)=>({elapsedSec:start+i,value:72,confidence:80,stable:true,timestamp:String((start+i)*1e6)})); }
function trial(overrides={}) {
  return {trialId:'synthetic-test-only',condition:'live',protocol:{...PROTOCOL},durationSec:60,endReason:'completed',startedAt:'2026-11-12T00:00:00Z',
    sdkVersion:'synthetic-test-only',source:{kind:'unit-test-fixture'},notes:'SYNTHETIC TEST ONLY — NOT EXPERIMENTAL FINDINGS',
    samples:pulse(),breathingSamples:[],traceSamples:[],faceSamples:[],validationEvents:[{code:0,name:'kOk',elapsedSec:0}],errors:[],challenge:null,...overrides};
}
module.exports={trial,pulse};
