const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const R = require('../src/reports.cjs');
const P = require('../src/protocol.cjs');
const E = require('../src/evidence.cjs');
const { summarize } = require('./summarize.cjs');

function comparable(trial) {
  const { summary, imported, ...evidence } = trial;
  return evidence;
}

function collect(dir) {
  const trials = new Map(), sources = new Map(), manifest = [];
  let occurrences = 0;
  for (const name of fs.readdirSync(dir).filter(n => /^spooflab-.*\.json$/.test(n)).sort()) {
    const bytes = fs.readFileSync(path.join(dir, name));
    const parsed = R.parseReport(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    manifest.push({ file: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), trials: parsed.length });
    for (const trial of parsed) {
      occurrences++;
      if (trials.has(trial.trialId) && !isDeepStrictEqual(comparable(trials.get(trial.trialId)), comparable(trial))) {
        throw new Error(`Conflicting evidence for ${trial.trialId} in ${name}; resolve explicitly before reporting.`);
      }
      trials.set(trial.trialId, trial);
      if (!sources.has(trial.trialId)) sources.set(trial.trialId, []);
      sources.get(trial.trialId).push(name);
    }
  }
  if (!trials.size) throw new Error('No exported trials found.');
  return { trials: [...trials.values()].sort((a,b) => String(a.startedAt).localeCompare(String(b.startedAt))),
    manifest, occurrences, sources: Object.fromEntries(sources) };
}

function audit(dir = path.resolve('evidence')) {
  // Validate every source and detect conflicts before writing any derived files.
  const data = collect(dir), out = path.join(dir, 'real', 'audit'), trialDir = path.join(dir, 'real', 'trials');
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(trialDir, { recursive: true });
  const converted = data.trials.map(t => {
    const v = E.convert(t);
    // consent-v2 combines attestations; it does not separately establish recording ownership.
    if(t.consent?.textVersion!=='consent-v3')v.consent.recording_owner_consented = null;
    return v;
  });
  for (const t of converted) fs.writeFileSync(path.join(trialDir, t.trial_id + '.json'), JSON.stringify(t, null, 2));
  const groups = R.aggregates(data.trials);
  const ledger = data.trials.map((t, i) => ({ trialId: t.trialId, startedAt: t.startedAt,
    condition: t.condition, blinkEnabled: t.protocol.challengeEnabled, durationSec: t.durationSec,
    endReason: t.endReason, ...P.summarize(t), qualityGate: converted[i].gate,
    validationWarningFraction: converted[i].metrics.validation_warning_frame_fraction,
    datasetConsent: t.ml?.datasetConsent === true,
    groupMetadataComplete: ['participantId','sessionId','recordingGroupId'].every(k => typeof t.ml?.[k] === 'string' && t.ml[k].trim()) }));
  const result = { schema: 'spooflab-evidence-audit-v1', generatedAt: new Date().toISOString(),
    exportFiles: data.manifest.length, trialOccurrences: data.occurrences, uniqueTrials: data.trials.length,
    duplicateOccurrences: data.occurrences-data.trials.length,
    completedTrials: ledger.filter(t => t.verifier.complete).length,
    aggregates: groups, trials: ledger, sourceManifest: data.manifest, trialSources: data.sources,
    limitations: ['Operator-supplied exports are not authenticated; hashes identify local files only.',
      'Application policy and QualityGate-v1 are separate decisions. No population accuracy or security claim.',
      'Participant identities, recording ownership and independent groups cannot be inferred from dates.',
      'Final frame diagnostics are short trial windows, not a standalone six-second camera readiness record.'] };
  fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(out, 'combined.json'), JSON.stringify(R.report(data.trials), null, 2));
  fs.writeFileSync(path.join(out, 'trials.csv'), R.csv(data.trials));
  fs.writeFileSync(path.join(out, 'report.html'), R.html(data.trials));
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summarize(converted), null, 2));
  const lines = ['# Local evidence audit', '',
    `${result.exportFiles} exports contain ${result.trialOccurrences} trial occurrences: **${result.uniqueTrials} unique trials**, ${result.duplicateOccurrences} duplicate occurrences, ${result.completedTrials} completed trials and ${result.uniqueTrials-result.completedTrials} interrupted trials. Original files were not changed.`, '',
    '## Application policy (trust-assumptions-v2)', '',
    '| Condition | Blink | SDK | Accepted | Rejected | Inconclusive | Total |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
    ...groups.map(g => `| ${g.condition} | ${g.protocol.challengeEnabled?'on':'off'} | ${g.sdkVersion} | ${g.accepted} | ${g.rejected} | ${g.inconclusive} | ${g.count} |`), '',
    'Groups retain the full frozen policy in audit.json. Counts include interrupted attempts.', '',
    '## Trial ledger', '', '| Trial | Condition | Blink | Seconds | Application result | QualityGate | Warning frames |', '| --- | --- | --- | ---: | --- | --- | ---: |',
    ...ledger.map(t => `| ${t.trialId.slice(0,8)} | ${t.condition} | ${t.blinkEnabled?'on':'off'} | ${t.durationSec.toFixed(1)} | ${t.verifier.outcome} | ${t.qualityGate.accepted===null?'inconclusive':t.qualityGate.accepted?'pass':'fail'} | ${t.validationWarningFraction===null?'unknown':(100*t.validationWarningFraction).toFixed(1)+'%'} |`), '',
    '## Interpretation', '',
    'Two completed screen replay trials satisfy the application policy with blink off. One completed screen replay fails the enabled blink challenge. These observations illustrate a limitation of treating physiological output as live presence; they do not establish reliable replay detection or an SDK vulnerability. Different recordings and settings are not a paired causal comparison.', '',
    'QualityGate-v1 independently requires >=10 pulse estimates, >=50% stable estimates and <=20% warning frames over the whole trial. A policy acceptance does not imply a QualityGate pass. summary.json summarizes this quality gate, not blink-policy acceptance.', '',
    `ML metadata: ${ledger.filter(t=>t.datasetConsent).length} trials have explicit dataset consent; ${ledger.filter(t=>t.groupMetadataComplete).length} have all group identifiers. Training requires 12 eligible trials and four independent connected groups, with both classes in each fixed grouped fold. No identities or consent have been invented and no model was trained.`, '',
    '## Remaining evidence', '',
    '- Confirm real participant/session/recording groups and separate dataset consent before preparing an ML dataset.',
    '- Existing matrix has no printed-photo or digital-replay trials. Collect these if retaining the full matrix claim.',
    '- A standalone camera FPS export is absent; trial diagnostics do not substitute for that measurement.',
    '- Confirm recording-owner consent separately. Derived records leave that field unknown.',
    '- Review participant-level sharing permission before publishing any raw evidence; current raw exports are already tracked in Git.', '',
    ...result.limitations.map(s=>'- '+s), ''];
  fs.writeFileSync(path.join(out, 'AUDIT.md'), lines.join('\n'));
  return result;
}
if (require.main === module) {
  const r = audit();
  console.log(JSON.stringify({exports:r.exportFiles, uniqueTrials:r.uniqueTrials, duplicates:r.duplicateOccurrences, completed:r.completedTrials, report:'evidence/real/audit/AUDIT.md'}, null, 2));
}
module.exports = { collect, audit };
