const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/protocol.cjs');
const { trial, pulse } = require('./support/fixture.cjs');
test('source labels cannot change the measurement or verifier outcome', () => {
  assert.deepEqual(P.summarize(trial({condition:'live'})), P.summarize(trial({condition:'injected_replay'})));
  assert.equal(P.summarize(trial()).verifier.outcome,'accepted');
});
test('warm-up-only, missing output and missing confidence are inconclusive', () => {
  for(const samples of [[],pulse(0,6),pulse().map(s=>({...s,confidence:null}))]) assert.equal(P.summarize(trial({samples})).verifier.outcome,'inconclusive');
});
test('technical errors, early stop and startup duration cannot count as acceptance', () => {
  for(const overrides of [{errors:[{message:'camera failure'}]},{durationSec:20},{endReason:'startup_error'},{endReason:'manual'}]) assert.equal(P.summarize(trial(overrides)).verifier.outcome,'inconclusive');
});
test('sample gaps and transient invalid validation break sustained evidence', () => {
  assert.equal(P.summarize(trial({samples:[...pulse(12,3),...pulse(18,3)]})).verifier.outcome,'inconclusive');
  assert.equal(P.summarize(trial({validationEvents:[{code:0,elapsedSec:0},{code:12,elapsedSec:14.1},{code:0,elapsedSec:14.5}]})).verifier.outcome,'inconclusive');
});
test('quality-qualified out-of-range pulse is policy rejection; low confidence is inconclusive', () => {
  assert.equal(P.summarize(trial({samples:pulse().map(s=>({...s,value:130}))})).verifier.outcome,'rejected');
  assert.equal(P.summarize(trial({samples:pulse().map(s=>({...s,confidence:39}))})).verifier.outcome,'inconclusive');
});
test('a single plausible sample is signal availability, not a sustained verifier acceptance', () => {
  const s=P.summarize(trial({samples:pulse(15,1)}));
  assert.equal(s.outcome,'signal_observed'); assert.equal(s.verifier.outcome,'inconclusive');
});
test('policy validation rejects nonfinite and unsupported settings', () => {
  for(const bad of [{minConfidence:NaN},{minBpm:120,maxBpm:80},{durationSec:5},{warmupSec:0},{maxGapSec:10}]) assert.throws(()=>P.validatePolicy(bad));
});
test('blink edges count once per transition and ignore stale or unstable detections', () => {
  const c=P.createChallenge(2,25,10);
  const feed=(t,detected,stable=true)=>P.updateChallenge(c,{elapsedSec:t,detected,stable});
  feed(24,false);feed(25,true);feed(25.1,false);feed(26,true);feed(26.1,true);feed(26.5,false);feed(27,true,false);feed(28,true);feed(36,false);
  P.closeChallenge(c); assert.equal(c.blinks.length,2);assert.equal(c.state,'passed');
});
test('no facial evidence is inconclusive and a mismatched observed challenge rejects', () => {
  const protocol={...P.PROTOCOL,challengeEnabled:true};
  assert.equal(P.summarize(trial({protocol})).verifier.outcome,'inconclusive');
  const c=P.createChallenge(2,25,10);for(const t of [26,27,28])P.updateChallenge(c,{elapsedSec:t,detected:false,stable:true});P.closeChallenge(c);
  assert.equal(c.state,'failed');assert.equal(P.summarize(trial({protocol,challenge:c})).verifier.outcome,'rejected');
});
