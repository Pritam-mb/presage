(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./protocol.cjs'));
  else root.SpoofReports = factory(root.SpoofProtocol);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(P) {
  'use strict';
  const SCHEMA = 'spooflab-evidence-v2';
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csvCell = value => '"' + (/^[=+@\-\t\r]/.test(String(value ?? '')) ? "'" : '') + String(value ?? '').replace(/"/g, '""') + '"';
  function fingerprint(t) { return JSON.stringify({ protocol: P.validatePolicy(t.protocol), sdkVersion: t.sdkVersion || 'unknown' }); }
  function aggregates(trials) {
    const groups = new Map();
    for (const t of trials) {
      const key = fingerprint(t) + t.condition;
      if (!groups.has(key)) groups.set(key, { condition: t.condition, protocol: t.protocol, sdkVersion: t.sdkVersion || 'unknown', accepted: 0, rejected: 0, inconclusive: 0, count: 0 });
      const group = groups.get(key); group.count++; group[P.summarize(t).verifier.outcome]++;
    }
    return [...groups.values()];
  }
  function report(trials) { return { schema: SCHEMA, appVersion: '0.2.0', exportedAt: new Date().toISOString(),
    limitations: 'Small exploratory experiment. Pulse in recorded video is documented behavior. Confidence is not liveness. Screen flicker confounds presentation tests. No population accuracy or attack resistance established. Imported reports carry no source guarantee.',
    trials: trials.map(t => ({ ...t, summary: P.summarize(t) })), aggregates: aggregates(trials) }; }
  function parseReport(text) {
    if (text.length > 25_000_000) throw new Error('Report exceeds the 25 MB import limit.');
    const data = JSON.parse(text);
    if (data.schema !== SCHEMA || !Array.isArray(data.trials) || data.trials.length > 300) throw new Error('Unsupported report schema or too many trials.');
    const ids = new Set();
    for (const t of data.trials) {
      if (!t || typeof t.trialId !== 'string' || ids.has(t.trialId) || t.trialId.length > 100 || !Object.hasOwn(P.CONDITIONS, t.condition) ||
        !Number.isFinite(t.durationSec) || t.durationSec < 0 || t.durationSec > 300 || typeof t.endReason !== 'string') throw new Error('Invalid or duplicate trial record.');
      ids.add(t.trialId); t.protocol = P.validatePolicy(t.protocol);
      for (const key of ['samples', 'breathingSamples', 'traceSamples', 'validationEvents', 'errors']) {
        if (!Array.isArray(t[key]) || t[key].length > 40000) throw new Error(`Invalid ${key} array.`);
      }
      if (t.cardiacTraceSamples !== undefined && (!Array.isArray(t.cardiacTraceSamples) || t.cardiacTraceSamples.length > 40000)) throw new Error('Invalid cardiac trace array.');
      for (const s of [...t.samples, ...t.breathingSamples, ...t.traceSamples, ...(t.cardiacTraceSamples || [])]) {
        if (!Number.isFinite(s.value) || !Number.isFinite(s.elapsedSec) || s.elapsedSec < 0 || s.elapsedSec > 300 ||
          (s.confidence != null && (!Number.isFinite(s.confidence) || s.confidence < 0 || s.confidence > 100)) ||
          (s.stable != null && typeof s.stable !== 'boolean')) throw new Error('Invalid metric sample.');
      }
      for (const e of t.validationEvents) if (!Number.isInteger(e.code) || !Number.isFinite(e.elapsedSec)) throw new Error('Invalid validation event.');
      if (t.challenge && (!['pending','active','passed','failed','unavailable'].includes(t.challenge.state) || ![1,2,3].includes(t.challenge.target) || !Array.isArray(t.challenge.blinks))) throw new Error('Invalid challenge record.');
      t.imported = true; t.summary = P.summarize(t);
    }
    return data.trials;
  }
  function csv(trials) {
    return [['trial_id','condition','duration_sec','signal_availability','experimental_verdict','reason','mean_pulse','mean_confidence','sustained_sec','sdk_version','notes'],
      ...trials.map(t => { const s = P.summarize(t); return [t.trialId,t.condition,t.durationSec,s.outcome,s.verifier.outcome,s.verifier.reason,s.meanPulse,s.meanConfidence,s.verifier.sustainedSec,t.sdkVersion,t.notes]; })]
      .map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  function html(trials) {
    const r = report(trials);
    const rows = trials.map(t => { const s=P.summarize(t); return `<tr><td>${escape(P.CONDITIONS[t.condition])}</td><td>${escape(t.trialId)}</td><td>${t.durationSec.toFixed(1)}</td><td>${escape(s.outcome)}</td><td>${escape(s.verifier.outcome)}</td><td>${escape(s.verifier.reason)}</td><td>${escape(t.notes)}</td></tr>`; }).join('');
    const groups=r.aggregates.map(g=>`<li>${escape(P.CONDITIONS[g.condition])}: ${g.accepted} accepted, ${g.rejected} rejected, ${g.inconclusive} inconclusive of ${g.count} trials. SDK ${escape(g.sdkVersion)}. Policy: <code>${escape(JSON.stringify(g.protocol))}</code></li>`).join('');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>SpoofLab Evidence Report</title><style>body{font:15px/1.7 system-ui;max-width:1200px;margin:40px auto;padding:24px;color:#17251d}h1{font-size:38px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:12px;border:1px solid #ccd5ce;text-align:left}code{overflow-wrap:anywhere}li{margin:15px 0}@media print{body{margin:0;font-size:11px}}</style><h1>SpoofLab · Evidence Report</h1><p>${escape(r.exportedAt)} · ${trials.length} trials · ${SCHEMA}</p><h2>Interpretation and limitations</h2><p>${escape(r.limitations)}</p><p>Accepted/rejected refer exclusively to an experimental application policy. Signal availability is a separate observation. Inconclusive trials stay in the denominator. Repeat trials from one person are not independent population evidence. Policy or SDK versions are not pooled.</p><h2>Counts by condition and policy</h2><ul>${groups}</ul><h2>Trial ledger</h2><table><thead><tr><th>Condition</th><th>Trial</th><th>Seconds</th><th>Signal</th><th>Policy result</th><th>Reason</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table><h2>Consent and handling</h2><p>No app video recording. SDK telemetry disabled. Exported metrics remain on the exporting device until deleted. Consent attestations and source fingerprints are operator-provided evidence, not signed provenance.</p><h2>Protocol and audit data</h2><p>Keep the accompanying JSON export for per-sample confidence, SDK timestamps, validation events, errors, challenge transitions and camera metadata.</p></html>`;
  }
  return { SCHEMA, escape, report, parseReport, aggregates, csv, html, fingerprint };
});
