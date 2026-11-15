const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collect } = require('../scripts/audit-evidence.cjs');
const R = require('../src/reports.cjs');
const P = require('../src/protocol.cjs');

test('duplicate exports do not inflate counts; conflicting measurements stop the audit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spooflab-audit-'));
  try {
    const trial = { trialId:'fixture', condition:'live', protocol:P.validatePolicy({}), durationSec:0,
      endReason:'manual', samples:[], breathingSamples:[], traceSamples:[], validationEvents:[], errors:[] };
    fs.writeFileSync(path.join(dir,'spooflab-a.json'), JSON.stringify(R.report([trial])));
    fs.writeFileSync(path.join(dir,'spooflab-b.json'), JSON.stringify(R.report([trial])));
    const result = collect(dir);
    assert.equal(result.trials.length, 1); assert.equal(result.occurrences, 2);
    assert.equal(result.sources.fixture.length, 2);
    fs.writeFileSync(path.join(dir,'spooflab-b.json'), JSON.stringify(R.report([{...trial,durationSec:1}])));
    assert.throws(() => collect(dir), /Conflicting evidence/);
  } finally {
    for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name));
    fs.rmdirSync(dir);
  }
});
