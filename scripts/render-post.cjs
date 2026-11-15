// Render a local draft from reviewed aggregate data only. Never reads trial series.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const CONDITIONS = ['live', 'photo', 'screen_replay', 'injected_replay'];
const LABELS = { live:'Live camera', photo:'Printed photo', screen_replay:'Screen replay', injected_replay:'Injected replay' };
function validateSummary(summary) {
  if (summary?.schema !== 'spooflab-summary-v1' || !Number.isInteger(summary.total_trials) || summary.total_trials < 0 || !Number.isInteger(summary.inconclusive_count) || summary.inconclusive_count < 0 || !summary.by_condition || typeof summary.by_condition !== 'object') throw new Error('Invalid aggregate summary.');
  let total=0, inconclusive=0;
  for (const [condition,row] of Object.entries(summary.by_condition)) {
    if (!CONDITIONS.includes(condition)) throw new Error('Unsupported aggregate condition.');
    for (const field of ['trials','accepted','inconclusive','pulse_mean_trial_count']) if (!Number.isInteger(row[field]) || row[field] < 0) throw new Error('Invalid aggregate count: '+field);
    if(row.accepted>row.trials || row.inconclusive>row.trials || row.pulse_mean_trial_count>row.trials) throw new Error('Aggregate counts are inconsistent.');
    for(const field of ['pulse_mean_bpm','pulse_mean_trial_sd']) if(row[field] !== null && !Number.isFinite(row[field]))throw new Error('Invalid pulse aggregate.');
    if(row.trials && (!Number.isFinite(row.acceptance_rate) || Math.abs(row.acceptance_rate-row.accepted/row.trials)>1e-9)) throw new Error('Invalid acceptance rate.');
    if(row.wilson95 && (!Number.isFinite(row.wilson95.lower)||!Number.isFinite(row.wilson95.upper)||row.wilson95.lower<0||row.wilson95.upper>1||row.wilson95.lower>row.wilson95.upper))throw new Error('Invalid interval.');
    total+=row.trials; inconclusive+=row.inconclusive;
  }
  if(total!==summary.total_trials || inconclusive!==summary.inconclusive_count)throw new Error('Aggregate totals disagree.');
}
function table(summary) {
  const lines=['| Input | Attempts | QualityGate accepted | Inconclusive measurement | Acceptance rate / Wilson 95% interval |','| --- | ---: | ---: | ---: | --- |'];
  for(const condition of CONDITIONS){
    const row=summary.by_condition[condition];
    if(!row){lines.push(`| ${LABELS[condition]} | Not collected | — | — | — |`);continue;}
    const interval=row.wilson95?`${(100*row.wilson95.lower).toFixed(1)}–${(100*row.wilson95.upper).toFixed(1)}%`:'not available';
    lines.push(`| ${LABELS[condition]} | ${row.trials} | ${row.accepted} | ${row.inconclusive} | ${(100*row.acceptance_rate).toFixed(1)}% / ${interval} |`);
  }
  return lines.join('\n');
}
function pulseTable(summary){
  const lines=['| Input | Trial means available | Mean of trial means / BPM | SD of trial means / BPM |','| --- | ---: | ---: | ---: |'];
  for(const condition of CONDITIONS){const row=summary.by_condition[condition];if(!row)continue;const fmt=n=>Number.isFinite(n)?n.toFixed(2):'not available';lines.push(`| ${LABELS[condition]} | ${row.pulse_mean_trial_count} | ${fmt(row.pulse_mean_bpm)} | ${fmt(row.pulse_mean_trial_sd)} |`);}
  return lines.join('\n');
}
function render(template,summary){
  validateSummary(summary);
  const context={summary,aggregate_table:table(summary),pulse_table:pulseTable(summary)};
  const output=template.replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,token)=>{
    let value=context;for(const key of token.split('.')){if(!value||!Object.hasOwn(value,key))throw new Error('Unknown post token: '+token);value=value[key];}
    if(value!==null && !['string','number','boolean'].includes(typeof value))throw new Error('Post token must resolve to a scalar: '+token);
    return value===null?'not available':String(value);
  });
  if(/\{\{|\}\}/.test(output))throw new Error('Malformed or unresolved template token.');
  if(!/^published: false$/m.test(output))throw new Error('Generated post must remain an unpublished draft.');
  return output;
}
function main(){
  const summary=JSON.parse(fs.readFileSync(path.join(ROOT,'evidence','summary.json'),'utf8'));
  const template=fs.readFileSync(path.join(ROOT,'docs','DEV_POST.template.md'),'utf8');
  const result=render(template,summary);
  fs.writeFileSync(path.join(ROOT,'docs','DEV_POST.md'),result,'utf8');
  console.log('Generated docs/DEV_POST.md from evidence/summary.json; published:false. No raw trial files read.');
}
if(require.main===module){try{require('./build-post.cjs');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={render,validateSummary,table,pulseTable};
