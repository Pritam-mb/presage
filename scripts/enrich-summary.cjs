// Add derived research aggregates after the unchanged reference summarizer.
// No participant identifiers, recordings or time series enter this output.
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd();
function read(name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}
const summary=read('evidence/summary.json');
const ml=read('evidence/analysis/exploratory-fit.json'),control=ml.shuffledLabelControl;
if(!control||control.runs!==50||control.matchOrExceedReal!==control.shuffledLabelMatches.filter(n=>n>=control.realLabelMatches).length)throw new Error('Unverified shuffled-label control');
summary.research={shuffled_matches:control.matchOrExceedReal,shuffled_runs:control.runs,exploratory_trials:control.trainingTrials,
 limitations:'Training-data exploration only; not accuracy on new sessions. Counts describe dependent trials, not independent people.'};
for(const [name,file]of [['paired','paired.json'],['challenge','challenge-tradeoff.json']]){
 const absolute=path.join(root,'evidence/analysis',file);
 if(fs.existsSync(absolute)){
  const analysis=JSON.parse(fs.readFileSync(absolute,'utf8'));if(Number.isFinite(analysis.n))summary.research[name+'_n']=analysis.n;
  if(name==='paired')summary.research.within_person_comparisons=analysis.n_within_person_comparisons;
  if(name==='challenge'){
   summary.research.live_challenge_usable=analysis.live_measured.n;
   summary.research.live_challenge_hits=analysis.live_measured.hits;
   summary.research.live_challenge_inconclusive=analysis.live_measured.inconclusive;
   summary.research.simulation_draws=analysis.simulation.draws_per_configuration;
   summary.research.challenge_table=['| Window / seconds | Required detections | Simulated passes | Draws |','| ---: | ---: | ---: | ---: |',...analysis.simulation.results.map(r=>`| ${r.window_sec} | ${r.required_count} | ${r.passes} | ${r.n_draws} |`)].join('\n');
  }
 }
}
fs.writeFileSync(path.join(root,'evidence/summary.json'),JSON.stringify(summary,null,2));
console.log('Derived research aggregates added; originals unchanged.');
