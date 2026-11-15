const {test}=require('node:test');const assert=require('node:assert/strict');
const R=require('../src/reports.cjs');const {trial}=require('./support/fixture.cjs');
test('JSON round trip recomputes forged summary and marks imported evidence',()=>{
  const data=R.report([trial()]);data.trials[0].summary.verifier.outcome='rejected';
  const [t]=R.parseReport(JSON.stringify(data));assert.equal(t.summary.verifier.outcome,'accepted');assert.equal(t.imported,true);
});
test('malformed reports, duplicate IDs and invalid measurements are rejected',()=>{
  assert.throws(()=>R.parseReport('{}'));
  assert.throws(()=>R.parseReport(JSON.stringify(R.report([trial(),trial()]))));
  const data=R.report([trial()]);data.trials[0].samples[0].confidence=999;assert.throws(()=>R.parseReport(JSON.stringify(data)));
});
test('comparison keeps inconclusives and separates different policies and SDK versions',()=>{
  const g=R.aggregates([trial(),trial({trialId:'2',samples:[]}),trial({trialId:'3',sdkVersion:'other'})]);
  assert.equal(g.length,2);assert.equal(g[0].count,2);assert.equal(g[0].inconclusive,1);
});
test('HTML escapes participant notes and CSV neutralizes formula injection',()=>{
  const t=trial({notes:'=HYPERLINK("bad") <script>alert(1)</script>'});
  const html=R.html([t]);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(R.csv([t]).includes('"\'=HYPERLINK'));
});
