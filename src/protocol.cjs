(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpoofProtocol = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PROTOCOL = Object.freeze({ version: 'trust-assumptions-v2', durationSec: 60, warmupSec: 12,
    minConfidence: 40, minBpm: 40, maxBpm: 110, sustainedSec: 5, maxGapSec: 1.5,
    challengeEnabled: false, challengeAtSec: 25, challengeWindowSec: 10 });
  const CONDITIONS = Object.freeze({ live: 'Live baseline', printed_photo: 'Printed photograph',
    screen_replay: 'Screen replay', injected_replay: 'Digital replay' });
  function validatePolicy(input) {
    const p = { ...PROTOCOL, ...input };
    for (const k of ['durationSec', 'warmupSec', 'minConfidence', 'minBpm', 'maxBpm', 'sustainedSec', 'maxGapSec', 'challengeAtSec', 'challengeWindowSec']) {
      if (!Number.isFinite(p[k])) throw new Error(`Invalid protocol field: ${k}`);
    }
    if (p.version !== PROTOCOL.version || p.durationSec < 45 || p.durationSec > 180 || p.warmupSec !== 12 ||
      p.minConfidence < 0 || p.minConfidence > 100 || p.minBpm < 1 || p.maxBpm <= p.minBpm || p.maxBpm > 250 ||
      p.sustainedSec < 1 || p.sustainedSec > 30 || p.maxGapSec < 0.1 || p.maxGapSec > 3 ||
      p.challengeAtSec < p.warmupSec || p.challengeWindowSec < 5 || p.challengeWindowSec > 20 ||
      p.challengeAtSec + p.challengeWindowSec > p.durationSec || typeof p.challengeEnabled !== 'boolean') throw new Error('Protocol settings are outside the supported range.');
    return Object.freeze(p);
  }
  function numberTs(value) {
    if (value == null) return null;
    const result = typeof value.toNumber === 'function' ? value.toNumber() : Number(value);
    return Number.isFinite(result) ? result : null;
  }
  function validationAt(events, sec) {
    let lo=0,hi=events.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].elapsedSec<=sec)lo=mid+1;else hi=mid;}
    return lo ? events[lo-1].code : null;
  }
  function segmentDuration(samples, predicate, maxGap, events = []) {
    let start = null, last = null, longest = 0;
    let eventIndex = 0;
    for (const s of samples) {
      let interrupted = false;
      while(eventIndex<events.length && events[eventIndex].elapsedSec<=s.elapsedSec){
        const e=events[eventIndex++];
        if(last!==null && e.elapsedSec>last && e.code!==0)interrupted=true;
      }
      if (!predicate(s) || interrupted || (last !== null && s.elapsedSec - last > maxGap)) start = null;
      if (predicate(s)) { if (start === null) start = s.elapsedSec; longest = Math.max(longest, s.elapsedSec - start); last = s.elapsedSec; }
      else last = null;
    }
    return longest;
  }
  // Receives measurement evidence only. Input-source labels cannot reach the decision rule.
  function verifyEvidence({ samples = [], validationEvents = [], errors = [], durationSec = 0, endReason, challenge }, policy) {
    const p = validatePolicy(policy);
    const ordered = [...samples].filter(s => Number.isFinite(s.elapsedSec) && s.elapsedSec >= p.warmupSec && s.elapsedSec <= durationSec)
      .sort((a, b) => a.elapsedSec - b.elapsedSec);
    const events = [...validationEvents].sort((a, b) => a.elapsedSec - b.elapsedSec);
    const quality = s => Number.isFinite(s.value) && s.stable === true && Number.isFinite(s.confidence) && s.confidence >= p.minConfidence && validationAt(events, s.elapsedSec) === 0;
    const plausible = s => quality(s) && s.value >= p.minBpm && s.value <= p.maxBpm;
    const qualitySec = segmentDuration(ordered, quality, p.maxGapSec, events);
    const sustainedSec = segmentDuration(ordered, plausible, p.maxGapSec, events);
    const complete = durationSec >= p.durationSec - 0.25 && endReason === 'completed';
    let outcome = 'inconclusive', reason = 'Insufficient uninterrupted, quality-qualified evidence.';
    if (!complete) reason = 'Trial did not complete the prescribed duration.';
    else if (errors.length) reason = 'Technical errors occurred; inspect the error log.';
    else if (sustainedSec >= p.sustainedSec) { outcome = 'accepted'; reason = 'The experimental pulse policy was satisfied.'; }
    else if (qualitySec >= p.sustainedSec) { outcome = 'rejected'; reason = 'Quality-qualified pulse estimates did not satisfy the configured pulse interval.'; }
    if (p.challengeEnabled && outcome === 'accepted') {
      if (!challenge || ['unavailable','pending','active'].includes(challenge.state)) {
        outcome = 'inconclusive'; reason = 'Freshness check lacks sufficient facial detection evidence.';
      } else if (challenge.state !== 'passed') { outcome = 'rejected'; reason = 'The experimental blink challenge was not matched.'; }
      else reason = 'Pulse policy and experimental blink challenge were satisfied.';
    }
    return { outcome, reason, qualitySec, sustainedSec, complete };
  }
  function summarize(trial) {
    const p = validatePolicy(trial.protocol);
    const samples = trial.samples.filter(s => s.elapsedSec >= p.warmupSec && Number.isFinite(s.value) && s.value > 0 && s.elapsedSec <= trial.durationSec);
    const confidences = samples.map(s => s.confidence).filter(Number.isFinite);
    return { outcome: trial.errors.length || trial.endReason !== 'completed' || trial.durationSec < p.durationSec - 0.25 ? 'inconclusive' : samples.length ? 'signal_observed' : 'inconclusive',
      pulseSamplesAfterWarmup: samples.length,
      meanPulse: samples.length ? samples.reduce((a, s) => a + s.value, 0) / samples.length : null,
      meanConfidence: confidences.length ? confidences.reduce((a, x) => a + x, 0) / confidences.length : null,
      confidenceBins: [0, 20, 40, 60, 80].map(low => ({ low, count: confidences.filter(c => c >= low && (low === 80 ? c <= 100 : c < low + 20)).length })),
      stableFraction: samples.length ? samples.filter(s => s.stable === true).length / samples.length : null,
      verifier: verifyEvidence(trial, p),
      interpretation: 'Application policy experiment, not a SmartSpectra security verdict or validated liveness test.' };
  }
  function createChallenge(target, issuedAtSec, windowSec) {
    if (![1, 2, 3].includes(target)) throw new Error('Blink target must be 1, 2 or 3.');
    return { target, issuedAtSec, deadlineSec: issuedAtSec + windowSec, state: 'active', blinks: [], observedSamples: 0, previousDetected: null, neutralSeen: false, lastEdgeSec: -1 };
  }
  function updateChallenge(challenge, detection) {
    if (!challenge || challenge.state !== 'active') return;
    const t = detection.elapsedSec;
    if (!Number.isFinite(t) || t < challenge.issuedAtSec || t > challenge.deadlineSec || detection.stable !== true) return;
    challenge.observedSamples++;
    if (detection.detected === false) challenge.neutralSeen = true;
    if (challenge.neutralSeen && detection.detected === true && challenge.previousDetected === false && t - challenge.lastEdgeSec >= 0.25) {
      challenge.blinks.push(t); challenge.lastEdgeSec = t;
    }
    challenge.previousDetected = detection.detected;
  }
  function closeChallenge(challenge) {
    if (challenge?.state === 'active') challenge.state = !challenge.neutralSeen || challenge.observedSamples < 3 ? 'unavailable' : challenge.blinks.length === challenge.target ? 'passed' : 'failed';
    return challenge;
  }
  return { PROTOCOL, CONDITIONS, validatePolicy, numberTs, verifyEvidence, summarize, createChallenge, updateChallenge, closeChallenge };
});
