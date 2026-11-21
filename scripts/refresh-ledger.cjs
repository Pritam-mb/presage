/* Rebuild derived evidence from the same validated ledger used by the desktop app. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createStore} = require('../src/storage.cjs');
const {convert} = require('../src/evidence.cjs');
const {report} = require('../src/reports.cjs');
const {datasetForTraining} = require('../src/ml-ui.js');
const {evaluateTrials} = require('./evaluate-policies.cjs');
const {analyze} = require('./analyze.cjs');

async function refresh() {
  const root = path.resolve(__dirname, '..');
  const {trials, issues} = await createStore(path.join(root,'data/trials')).load();
  if (!trials.length || issues.length) throw Error('Resolve empty or conflicting ledger before reporting.');
  const artifacts = path.join(root,'artifacts');
  fs.mkdirSync(artifacts,{recursive:true});
  const stage = fs.mkdtempSync(path.join(artifacts,'ledger-refresh-'));
  const trialDir = 'evidence/real/trials', analysis = 'evidence/analysis/';
  for (const dir of [trialDir,analysis]) fs.mkdirSync(path.join(stage,dir),{recursive:true});
  function write(name,value){fs.writeFileSync(path.join(stage,name),JSON.stringify(value));}
  for (const t of trials) write(trialDir+'/'+t.trialId+'.json',convert(t));
  write(analysis+'consolidated-dataset.json',report(trials));
  write(analysis+'policy-traces.json',evaluateTrials(trials));
  write(analysis+'consented-ml-dataset.json',datasetForTraining(trials));
  const python = process.env.SPOOFLAB_PYTHON || path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
  for (const [mode,file] of [['exploratory','exploratory-fit'],['grouped','evaluation'],['loocv','loocv-limits']]) {
    execFileSync(python,[path.join(root,'ml/train.py'),analysis+'consented-ml-dataset.json','--mode',mode,'--output',analysis+file+'.json'],{cwd:stage});
  }
  analyze(stage);
  for (const script of ['reference/summarize.cjs','enrich-summary.cjs']) execFileSync(process.execPath,[path.join(__dirname,script)],{cwd:stage});
  // Preserve previous derived exports, including retired IDs, outside the active report.
  const old = path.join(stage,'previous-trial-exports');
  const dest = path.join(root,trialDir);
  if(fs.existsSync(dest)) fs.renameSync(dest,old);
  try {fs.renameSync(path.join(stage,trialDir),dest);}
  catch(error){if(fs.existsSync(old)) fs.renameSync(old,dest);throw error;}
  for(const file of fs.readdirSync(path.join(stage,analysis))) fs.copyFileSync(path.join(stage,analysis,file),path.join(root,analysis,file));
  fs.copyFileSync(path.join(stage,'evidence/summary.json'),path.join(root,'evidence/summary.json'));
  console.log('Published local aggregates for '+trials.length+' retained trials.');
}
if(require.main===module) refresh().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={refresh};
