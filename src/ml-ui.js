(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpoofML=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CONDITIONS=['live','printed_photo','screen_replay','injected_replay'];
  let mounted=null;
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function metadata(input){
    const result={datasetConsent:input?.datasetConsent===true};
    for(const field of ['participantId','sessionId','recordingGroupId']){
      const value=String(input?.[field]??'').trim();
      if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value))throw new Error('Use 1–80 letters, digits, dots, dashes or underscores for each group alias.');
      result[field]=value;
    }
    return result;
  }
  function eligibleMetadata(trial){try{return metadata(trial.ml).datasetConsent;}catch{return false;}}
  function datasetForTraining(trials){
    const sample=s=>({elapsedSec:s.elapsedSec,value:s.value,confidence:s.confidence??null,stable:s.stable??null});
    return {schema:'spooflab-evidence-v2',purpose:'local_ml_feature_input',trials:trials.filter(eligibleMetadata).map(t=>({
      trialId:t.trialId,condition:t.condition,durationSec:t.durationSec,endReason:t.endReason,protocol:t.protocol,ml:metadata(t.ml),
      source:t.source?.sha256?{sha256:t.source.sha256}:{},samples:(t.samples||[]).map(sample),breathingSamples:(t.breathingSamples||[]).map(sample),
      validationEvents:(t.validationEvents||[]).map(e=>({elapsedSec:e.elapsedSec,code:e.code})),errors:(t.errors||[]).map(e=>({code:e.code??null,phase:e.phase||'sdk'}))
    }))};
  }
  function parseEvaluation(text){
    if(typeof text!=='string'||text.length>25_000_000)throw new Error('Evaluation report exceeds the 25 MB limit.');
    const r=JSON.parse(text);
    if(r?.schema!=='spooflab-ml-evaluation-v1'||!['evaluated','insufficient_data','exploratory_fitted'].includes(r.status)||!Array.isArray(r.models)||r.models.length>10||!Array.isArray(r.featureNames)||r.featureNames.length>200)throw new Error('Unsupported evaluation report.');
    const exploratory=r.status==='exploratory_fitted';
    if(exploratory && r.evaluationMode!=='training_only')throw new Error('Exploratory reports must declare training-only scope.');
    if(r.featureNames.some(f=>typeof f!=='string'||f.length>100)||new Set(r.featureNames).size!==r.featureNames.length)throw new Error('Invalid feature names.');
    if(!r.dataset||!Number.isInteger(r.dataset.totalTrials)||!Number.isInteger(r.dataset.eligibleTrials)||r.dataset.totalTrials<0||r.dataset.eligibleTrials<0||r.dataset.eligibleTrials>r.dataset.totalTrials||!Number.isInteger(r.dataset.independentGroups)||r.dataset.independentGroups<0)throw new Error('Invalid dataset counts.');
    for(const field of ['recommendations','limitations'])if(!Array.isArray(r[field])||r[field].length>100||r[field].some(v=>typeof v!=='string'||v.length>10000))throw new Error(`Invalid ${field}.`);
    if(typeof r.narrative!=='string'||r.narrative.length>100000)throw new Error('Invalid research narrative.');
    if(!Array.isArray(r.splits)||r.splits.length>100)throw new Error('Invalid split provenance.');
    for(const split of r.splits){
      for(const k of ['trainTrialIds','testTrialIds','trainGroups','testGroups'])if(!Array.isArray(split[k])||split[k].length>30000||split[k].some(v=>typeof v!=='string'))throw new Error('Invalid split members.');
      if(split.trainGroups.some(g=>split.testGroups.includes(g))||split.trainTrialIds.some(id=>split.testTrialIds.includes(id)))throw new Error('Report contains overlapping train/test groups or trials.');
    }
    if((r.status==='evaluated'||exploratory)&&!r.models.length)throw new Error('An evaluated report needs model predictions.');
    for(const model of r.models){
      if(typeof model.name!=='string'||model.name.length>100||!Array.isArray(model.predictions)||model.predictions.length>30000||!model.metrics)throw new Error('Invalid model result.');
      const seen=new Set();let correct=0,falseLive=0,missedLive=0,brier=0;
      for(const p of model.predictions){
        if(typeof p.trialId!=='string'||seen.has(p.trialId)||!CONDITIONS.includes(p.condition)||![0,1].includes(p.label)||p.label!==(p.condition==='live'?1:0)||!finite(p.probability)||p.probability<0||p.probability>1||p.predictedLabel!==(p.probability>=.5?1:0)||p.correct!==(p.predictedLabel===p.label)||!finite(p.baseValue)||!Array.isArray(p.contributions)||p.contributions.length!==r.featureNames.length)throw new Error('Invalid or inconsistent model prediction.');
        seen.add(p.trialId);let margin=p.baseValue;const features=new Set();
        for(const c of p.contributions){if(!r.featureNames.includes(c.feature)||features.has(c.feature)||!(c.value===null||finite(c.value))||!finite(c.contribution))throw new Error('Invalid feature contribution.');features.add(c.feature);margin+=c.contribution;}
        if(Math.abs(1/(1+Math.exp(-margin))-p.probability)>.002)throw new Error('Feature contributions do not reconstruct the prediction.');
        const split=r.splits.find(s=>s.fold===p.fold);if(!split || (exploratory ? (p.sampleRole!=='training'||!split.trainTrialIds.includes(p.trialId)||split.testTrialIds.length!==0||split.testGroups.length!==0) : p.sampleRole==='training'||!split.testTrialIds.includes(p.trialId)))throw new Error('Prediction lacks the declared training/test provenance.');
        correct+=Number(p.correct);falseLive+=Number(p.label===0&&p.predictedLabel===1);missedLive+=Number(p.label===1&&p.predictedLabel===0);brier+=(p.probability-p.label)**2;
      }
      const n=model.predictions.length,m=model.metrics;
      if(!n||m.evaluatedTrials!==n||m.correct!==correct||m.falseLive!==falseLive||m.missedLive!==missedLive||(!exploratory&&(!finite(m.accuracy)||Math.abs(m.accuracy-correct/n)>1e-5||!finite(m.brier)||Math.abs(m.brier-brier/n)>1e-5)))throw new Error('Evaluation metrics do not match prediction records.');
    }
    if(r.shuffledLabelControl){
      const c=r.shuffledLabelControl,lr=r.models.find(m=>m.name==='Logistic regression');
      if(!exploratory||!lr||c.model!=='Logistic regression'||c.runs!==50||c.trainingTrials!==lr.predictions.length||c.realLabelMatches!==lr.metrics.correct||!Array.isArray(c.shuffledLabelMatches)||c.shuffledLabelMatches.length!==50||c.shuffledLabelMatches.some(n=>!Number.isInteger(n)||n<0||n>c.trainingTrials)||c.matchOrExceedReal!==c.shuffledLabelMatches.filter(n=>n>=c.realLabelMatches).length)throw new Error('Invalid shuffled-label control.');
    }
    return r;
  }
  function mount({getTrials,download,isBusy}){
    const doc=document,byId=id=>doc.getElementById(id);let evaluation=null;
    function el(tag,text,cls){const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
    function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
    function option(value,text){const n=el('option',text);n.value=value;return n;}
    function field(label,id,type='text'){const wrap=el('div'),l=el('label',label),input=el(type==='select'?'select':'input');input.id=id;l.htmlFor=id;if(type!=='select')input.type=type;wrap.append(l,input);return {wrap,input};}
    const nav=el('button',null,'nav-button');nav.dataset.view='ml';nav.append(el('span','04'),doc.createTextNode('Model Lab'));doc.querySelector('nav').append(nav);
    const view=el('section',null,'view');view.id='view-ml';view.hidden=true;doc.querySelector('main').insertBefore(view,doc.querySelector('main > footer'));
    const intro=el('div',null,'page-intro'),head=el('div');head.append(el('p','LOCAL LEARNING / HELD-OUT EXPERIMENTS','eyebrow'),el('h1','Learn where models fail.'),el('p','Build a consented dataset, compare models across independent groups, and inspect the measurements behind each prediction.','lede'));intro.append(head);view.append(intro);
    view.append(el('div','Experimental condition classifier. Model scores are uncalibrated and cannot establish identity, live presence or attack resistance. Training and reports remain local; no LLM or cloud service is used.','notice'));
    const status=el('p','No dataset exported or evaluation loaded.','status');status.id='ml-status';status.setAttribute('role','status');view.append(status);
    const panel=el('section',null,'panel');panel.append(el('h2','1 / Prepare consented groups'),el('p','Assign anonymous aliases to each trial. Reuse the same recording-group alias for a live source and all replays derived from it. Reuse participant and session aliases honestly; do not invent independent groups to satisfy training requirements.'));
    const selectField=field('TRIAL','ml-trial','select'),grid=el('div',null,'ml-fields');panel.append(selectField.wrap);const fields={};
    for(const [key,label] of [['participantId','PARTICIPANT ALIAS'],['sessionId','SESSION ALIAS'],['recordingGroupId','RECORDING GROUP']]){const f=field(label,`ml-${key}`);f.input.maxLength=80;fields[key]=f.input;grid.append(f.wrap);}panel.append(grid);
    const consent=el('label',null,'check-row'),check=el('input');check.type='checkbox';check.id='ml-dataset-consent';consent.append(check,el('span','I have explicit consent to include this trial’s physiological measurements and group aliases in a locally exported ML dataset.'));panel.append(consent);
    const save=button('Save trial metadata',()=>{if(isBusy())return notify('Stop capture before editing the dataset.');const trial=current();if(!trial)return;try{trial.ml=metadata({...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value])),datasetConsent:check.checked});window.dispatchEvent(new Event('spooflab:metadata-changed'));notify('Grouping and consent updated. Desktop changes are saved locally; check Evidence Report for save status.');refresh();}catch(error){notify(error.message);}});
    const revoke=button('Remove dataset consent',()=>{if(isBusy())return notify('Stop capture first.');const t=current();if(t){t.ml={...(t.ml||{}),datasetConsent:false};window.dispatchEvent(new Event('spooflab:metadata-changed'));check.checked=false;refresh();notify('This trial will be excluded from ML dataset export.');}});
    const exportButton=button('Export consented dataset ↓',()=>{if(isBusy())return notify('Stop capture before exporting.');const selected=getTrials().filter(eligibleMetadata);if(!selected.length)return notify('No trials have complete grouping and explicit dataset consent.');download(JSON.stringify(datasetForTraining(selected),null,2),'application/json','json');notify(`Exported ${selected.length} consented trials. Technical/quality exclusions and group sufficiency are checked by the Python trainer.`);});
    const actions=el('div',null,'action-row');actions.append(save,revoke,exportButton);panel.append(actions);const count=el('p',null,'field-help');count.id='ml-dataset-count';panel.append(count);view.append(panel);
    const modeField=field('TRAINING MODE','ml-training-mode','select');
    modeField.input.append(option('exploratory','Exploratory fit ? training data only'),option('grouped','Strict grouped holdout ? independent evaluation'));
    let trainingActive=false;
    const trainButton=button('Train locally (uses consented trials)',async()=>{
      if(trainingActive||isBusy())return notify('Stop capture or wait for the active training job.');
      if(!window.SpoofMLBridge?.train)return notify('In-app training requires the desktop app. Use dataset export and the local command below.');
      const selected=getTrials().filter(eligibleMetadata);if(!selected.length)return notify('Add complete group aliases and explicit dataset consent first.');
      trainingActive=true;trainButton.disabled=true;notify('Training local models with consented trials. No cloud service is contacted.');
      try{const result=await window.SpoofMLBridge.train(datasetForTraining(selected),modeField.input.value);evaluation=parseEvaluation(JSON.stringify(result));renderEvaluation();notify(evaluation.status==='exploratory_fitted'?'Exploratory models fitted. Predictions below use training records, not unseen data.':evaluation.status==='evaluated'?'Grouped evaluation finished. Inspect held-out predictions below.':'Insufficient eligible data for the selected mode. See the report below.');}
      catch(error){notify(`Local training failed: ${error.message}`);}finally{trainingActive=false;trainButton.disabled=!window.SpoofMLBridge?.train;}
    });
    trainButton.id='ml-train';trainButton.disabled=!window.SpoofMLBridge?.train;
    const training=el('section',null,'panel');training.append(el('h2','2 / Train locally'),modeField.wrap,trainButton,el('p','The desktop button starts a local Python process using only consented trials. It sends no data to a cloud service. Export a dataset to retain it or use this command from the project folder:'),el('pre','python ml/train.py "path/to/dataset.json" --output "path/to/evaluation.json"'),el('p','The trainer compares logistic regression and XGBoost using independent group holdouts. Small or incomplete datasets produce an insufficient-data report instead of performance claims. The operational minimum is not evidence of scientific validity. Keep failed capture records in the original evidence ledger.'));view.append(training);
    const results=el('section',null,'panel');results.append(el('h2','3 / Inspect model behavior'));const input=el('input');input.id='ml-evaluation-file';input.type='file';input.accept='.json,application/json';const label=el('label','IMPORT LOCAL EVALUATION JSON');label.htmlFor=input.id;results.append(label,input);
    const clear=button('Clear imported evaluation',()=>{evaluation=null;renderEvaluation();notify('Evaluation cleared from memory. Files on disk are unchanged.');});results.append(clear);const output=el('div');output.id='ml-results';results.append(output);view.append(results);
    input.addEventListener('change',async()=>{try{if(isBusy())throw new Error('Stop capture before importing evaluations.');const file=input.files[0];if(!file||file.size>25_000_000)throw new Error('Choose an evaluation JSON file no larger than 25 MB.');evaluation=parseEvaluation(await file.text());renderEvaluation();notify('Evaluation imported and consistency checked. Imported evidence and split labels remain unauthenticated.');}catch(error){notify(`Import failed: ${error.message}`);}finally{input.value='';}});
    function notify(text){status.textContent=text;}
    function current(){return getTrials().find(t=>t.trialId===selectField.input.value);}
    function loadFields(){const t=current();for(const [k,input]of Object.entries(fields))input.value=t?.ml?.[k]||'';check.checked=t?.ml?.datasetConsent===true;}
    selectField.input.addEventListener('change',loadFields);
    function refresh(){const previous=selectField.input.value;selectField.input.replaceChildren();const trials=getTrials();for(const t of trials)selectField.input.append(option(t.trialId,`${t.trialId.slice(0,12)} / ${t.condition}${t.ml?.datasetConsent?' / consented':''}`));if(trials.some(t=>t.trialId===previous))selectField.input.value=previous;const eligible=trials.filter(eligibleMetadata).length;count.textContent=`${eligible} of ${trials.length} trials have complete metadata and dataset consent. Training eligibility is checked separately.`;save.disabled=revoke.disabled=!trials.length;exportButton.disabled=!eligible;loadFields();}
    function renderEvaluation(){output.replaceChildren();if(!evaluation){output.append(el('p','No model evaluation loaded. No synthetic scores or findings are displayed.','empty-state'));return;}
      const r=evaluation;const trainingOnly=r.status==='exploratory_fitted';const scope=trainingOnly?'Training':'Held-out';
      if(trainingOnly)output.append(el('div','Training-data exploration. It says nothing about new sessions. These trials were used to fit the models.','notice'));
      output.append(el('p',`${r.status.replaceAll('_',' ')} · ${r.dataset.eligibleTrials} eligible of ${r.dataset.totalTrials} trials · ${r.dataset.independentGroups} independent groups`),el('p',r.narrative));
      output.append(button('Export full evaluation JSON',()=>download(JSON.stringify(r,null,2),'application/json','json')));
      const limitations=el('ul',null,'explain-list');for(const text of r.limitations)limitations.append(el('li',text));output.append(limitations);
      const tips=el('section',null,'notice');tips.append(el('strong','Suggested next experiments'));const list=el('ul');for(const text of r.recommendations)list.append(el('li',text));tips.append(list);output.append(tips);
      const exportSummary=button('Export research summary ↓',()=>download(`# SpoofLab local model evaluation\n\n${r.narrative}\n\n## Next experiments\n${r.recommendations.map(x=>'- '+x).join('\n')}\n\n## Limitations\n${r.limitations.map(x=>'- '+x).join('\n')}\n\nReport scope: ${r.evaluationMode||'grouped_holdout'}. Imported evaluation is unauthenticated. Scores are uncalibrated.\n`,'text/markdown','md'));output.append(exportSummary);
      if(!r.models.length)return;
      if(trainingOnly){
        const c=r.shuffledLabelControl;
        if(c){
          const box=el('section',null,'notice');box.id='ml-shuffle-control';box.append(el('h3','Shuffled-label training control'),el('p',`${c.matchOrExceedReal} of ${c.runs} shuffled-label logistic models matched or exceeded the real-label training fit.`),el('p','The controls fit random labels on the same records. A strong fit to these records is not evidence of useful predictions on new sessions. Class counts are fixed; this is not a group-aware significance test.'));
          const histogram=el('div',null,'confidence-histogram');histogram.id='ml-shuffle-histogram';histogram.setAttribute('aria-label','Counts of training-label matches across 50 shuffled-label fits');
          const tally=new Map();for(const n of c.shuffledLabelMatches)tally.set(n,(tally.get(n)||0)+1);const peak=Math.max(...tally.values());
          for(const [matches,runs] of [...tally].sort((a,b)=>a[0]-b[0])){const bin=el('div',null,'hist-bin'),wrap=el('div'),bar=el('i');bar.style.height=(runs/peak*75)+'px';wrap.append(bar);bin.append(wrap,el('span',matches+' matched labels'),el('span',runs+' shuffled fits'));histogram.append(bin);}box.append(histogram);
          const list=el('pre',JSON.stringify({realLabelMatches:c.realLabelMatches,trainingTrials:c.trainingTrials,shuffledLabelMatches:c.shuffledLabelMatches,unchangedPermutations:c.unchangedPermutations},null,2));box.append(list);output.append(box);
        }else output.append(el('p','Re-run exploratory fitting to generate the 50 shuffled-label controls.'));
        output.append(el('p','Logistic regression is shown by default. XGBoost is optional as a small-data fitting/overfitting demonstration, not an accuracy comparison.'));
      }else{
        const t=el('table'),h=el('tr');for(const x of ['Model','Held-out trials','False live','Missed live','Brier'])h.append(el('th',x));t.append(h);
        for(const m of r.models){const row=el('tr');for(const x of [m.name,m.metrics.evaluatedTrials,m.metrics.falseLive,m.metrics.missedLive,m.metrics.brier.toFixed(4)])row.append(el('td',x));t.append(row);}
        const wrap=el('div',null,'table-wrap');wrap.append(t);output.append(wrap);
      }
      const modelField=field('MODEL','ml-model','select'),filterField=field('SHOW','ml-prediction-filter','select');r.models.forEach((m,i)=>modelField.input.append(option(String(i),m.name+(trainingOnly&&m.name==='XGBoost'?' / overfitting demonstration':''))));for(const [v,t]of [['all','All '+scope.toLowerCase()+' predictions'],['errors','Incorrect predictions'],['borderline','Scores 0.4–0.6 (heuristic only)']])filterField.input.append(option(v,t));const filters=el('div',null,'ml-fields');filters.append(modelField.wrap,filterField.wrap);if(trainingOnly){modelField.wrap.hidden=true;const showTree=el('input');showTree.type='checkbox';showTree.id='ml-show-xgboost';const treeLabel=el('label',null,'check-row');treeLabel.append(showTree,el('span','Show optional XGBoost fitting/overfitting demonstration'));filters.append(treeLabel);showTree.addEventListener('change',()=>{modelField.wrap.hidden=!showTree.checked;if(!showTree.checked){modelField.input.value=String(r.models.findIndex(m=>m.name==='Logistic regression'));renderPredictions();}});};output.append(filters);const predictions=el('div'),inspector=el('section',null,'ml-inspector');inspector.id='ml-inspector';output.append(predictions,inspector);
      function inspect(p){inspector.replaceChildren(el('h3',`${p.trialId}: ${p.correct?'correct':'incorrect'} experimental classification`),el('p',`Actual: ${p.condition} · estimated live-like probability ${(p.probability*100).toFixed(1)}% (uncalibrated). ${scope} record; fold ${p.fold}.`),el('p','Contributions explain this model’s log-odds calculation, not a causal explanation of physiology or proof of live presence. Positive contributions push toward the live label.'),el('p',`Base log-odds: ${p.baseValue.toFixed(4)}. Base plus contributions reconstructs this prediction.`));const t=el('table'),h=el('tr');for(const x of ['Feature','Value','Log-odds contribution'])h.append(el('th',x));t.append(h);for(const c of [...p.contributions].sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution))){const row=el('tr');row.append(el('td',c.feature),el('td',c.value===null?'Missing / train-fitted imputation':c.value.toFixed(4)),el('td',`${c.contribution>=0?'+':''}${c.contribution.toFixed(4)}`,c.contribution>=0?'ml-positive':'ml-negative'));t.append(row);}const wrap=el('div',null,'table-wrap');wrap.append(t);inspector.append(wrap);}
      function renderPredictions(){predictions.replaceChildren();inspector.replaceChildren();const model=r.models[Number(modelField.input.value)],chosen=model.predictions.filter(p=>filterField.input.value==='errors'?!p.correct:filterField.input.value==='borderline'?p.probability>=.4&&p.probability<=.6:true);if(!chosen.length){predictions.append(el('p','No predictions match this filter.'));return;}const t=el('table'),h=el('tr');for(const x of ['Trial','Actual','Live-like score','Prediction','Inspect'])h.append(el('th',x));t.append(h);for(const p of chosen){const row=el('tr');row.append(el('td',p.trialId.slice(0,16)),el('td',p.condition),el('td',`${(p.probability*100).toFixed(1)}%`),el('td',`${p.predictedLabel?'live':'non-live'} · ${p.correct?'correct':'incorrect'}`));const cell=el('td');cell.append(button('Explain',()=>inspect(p)));row.append(cell);t.append(row);}const wrap=el('div',null,'table-wrap');wrap.append(t);predictions.append(wrap);inspect(chosen[0]);}
      modelField.input.addEventListener('change',renderPredictions);filterField.input.addEventListener('change',renderPredictions);renderPredictions();
      const audit=el('details');audit.append(el('summary','Inspect group split provenance and exclusions'),el('pre',JSON.stringify({splits:r.splits,excluded:r.dataset.excluded},null,2)));output.append(audit);
    }
    refresh();renderEvaluation();mounted={refresh,clearEvaluation(){evaluation=null;renderEvaluation();}};return mounted;
  }
  return {mount,metadata,eligibleMetadata,datasetForTraining,parseEvaluation,refresh(){mounted?.refresh();},clearEvaluation(){mounted?.clearEvaluation();}};
});
