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
    if(r?.schema!=='spooflab-ml-evaluation-v1'||!['evaluated','insufficient_data','exploratory_fitted','limits_report'].includes(r.status)||!Array.isArray(r.models)||r.models.length>10||!Array.isArray(r.featureNames)||r.featureNames.length>200)throw new Error('Unsupported evaluation report.');
    if(r.status==='limits_report'){
      const limits=r.logoLimits;
      const auc=n=>finite(n)&&n>=0&&n<=1;
      const nullableAuc=n=>n===null||auc(n);
      const count=n=>Number.isInteger(n)&&n>=0;
      const control=limits?.trainingControl;
      if(r.evaluationMode!=='logo_limits'||r.models.length||r.splits?.length||
        !Array.isArray(limits?.folds)||limits.folds.length>300||limits.folds.length!==r.dataset?.independentGroups||
        limits.folds.some((f,i)=>f?.group!==i+1||!count(f.live)||!count(f.nonLive)||!nullableAuc(f.auc)||
          !['measured','held_out_one_class','training_one_class'].includes(f.status)||(f.status==='measured')!==(f.auc!==null))||
        limits.folds.reduce((n,f)=>n+f.live+f.nonLive,0)!==r.dataset?.eligibleTrials||
        limits.mixedGroupsScored!==limits.folds.filter(f=>f.auc!==null).length||
        !nullableAuc(limits.meanWithinGroupAuc)||!nullableAuc(limits.pooledAuc)||
        (limits.descriptiveInterval!==null&&(!Array.isArray(limits.descriptiveInterval)||limits.descriptiveInterval.length!==2||
          !limits.descriptiveInterval.every(auc)||limits.descriptiveInterval[0]>limits.descriptiveInterval[1]))||
        control?.runs!==50||!count(control.matchOrExceedReal)||control.matchOrExceedReal>50)
        throw new Error('Invalid leave-one-group-out report.');
    }else if(r.evaluationMode==='logo_limits'&&r.status!=='insufficient_data'){
      throw new Error('Invalid leave-one-group-out status.');
    }
    const exploratory=r.status==='exploratory_fitted';
    if(exploratory && r.evaluationMode!=='training_only')throw new Error('Exploratory reports must declare training-only scope.');
    if(r.featureNames.some(f=>typeof f!=='string'||f.length>100)||new Set(r.featureNames).size!==r.featureNames.length)throw new Error('Invalid feature names.');
    if(!r.dataset||!Number.isInteger(r.dataset.totalTrials)||!Number.isInteger(r.dataset.eligibleTrials)||r.dataset.totalTrials<0||r.dataset.eligibleTrials<0||r.dataset.eligibleTrials>r.dataset.totalTrials||!Number.isInteger(r.dataset.independentGroups)||r.dataset.independentGroups<0)throw new Error('Invalid dataset counts.');
    if(r.dataset.featureFingerprint!==undefined&&(!/^[a-f0-9]{64}$/.test(r.dataset.featureFingerprint)||r.dataset.ordering!=='trial_id_ascending_v2'))throw new Error('Invalid reproducibility fingerprint.');
    const audit=r.dataset.independentEvidenceAudit;
    if(audit){
      if(audit.version!=='matched-groups-v2'||!['ready','insufficient'].includes(audit.status)||audit.minimumMixedGroups!==4||![audit.mixedGroups,audit.singleClassGroups,audit.totalGroups].every(n=>Number.isInteger(n)&&n>=0)||audit.totalGroups!==r.dataset.independentGroups||audit.mixedGroups+audit.singleClassGroups!==audit.totalGroups||audit.status!==(audit.mixedGroups>=audit.minimumMixedGroups?'ready':'insufficient'))throw new Error('Invalid independent-evidence audit.');
    }
    if(r.status==='evaluated'&&(!audit||audit.status!=='ready'))throw new Error('Grouped report lacks the current matched-group evidence check. Re-run strict evaluation locally; exploratory reports remain supported.');
    if(r.status==='insufficient_data'&&(r.models.length||r.splits?.length))throw new Error('Insufficient-data reports must not contain fitted performance claims.');
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
    const doc=document,byId=id=>doc.getElementById(id);let evaluation=null;const evaluations=new Map();
    function el(tag,text,cls){const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
    function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
    function option(value,text){const n=el('option',text);n.value=value;return n;}
    function field(label,id,type='text'){const wrap=el('div'),l=el('label',label),input=el(type==='select'?'select':'input');input.id=id;l.htmlFor=id;if(type!=='select')input.type=type;wrap.append(l,input);return {wrap,input};}
    const view=el('section',null,'view');view.id='view-ml';view.hidden=true;doc.querySelector('main').insertBefore(view,doc.querySelector('main > footer'));
    const C=window.SpoofCharts;
    const intro=el('div',null,'page-intro'),head=el('div');
    head.append(el('h1','Model Lab'),el('p','Inspect how local models respond to recorded measurements.','lede'));
    intro.append(head);view.append(intro);
    const banner=el('div',null,'ml-scope');banner.append(C.icon('info'),el('span','Exploratory. Nothing here measures accuracy on new people.'));
    const layout=el('div',null,'ml-layout'),main=el('div',null,'ml-main'),tools=el('aside',null,'ml-tools');
    tools.setAttribute('aria-label','Local training controls');layout.append(main,tools);view.append(banner,layout);
    const status=el('p','Ready to load a local evaluation.','ml-log');status.id='ml-status';status.setAttribute('role','status');
    const headline=el('div',null,'ml-headline');headline.id='ml-headline';main.append(headline);
    const panel=el('section',null,'panel');panel.append(el('p','Use the same recording group for a source and its replays. Use real session boundaries when assigning aliases.'));
    const selectField=field('TRIAL','ml-trial','select'),grid=el('div',null,'ml-fields');panel.append(selectField.wrap);const fields={};
    for(const [key,label] of [['participantId','PARTICIPANT ALIAS'],['sessionId','SESSION ALIAS'],['recordingGroupId','RECORDING GROUP']]){const f=field(label,`ml-${key}`);f.input.maxLength=80;fields[key]=f.input;grid.append(f.wrap);}panel.append(grid);
    const consent=el('label',null,'check-row'),check=el('input');check.type='checkbox';check.id='ml-dataset-consent';consent.append(check,el('span','I have explicit consent to include this trial’s physiological measurements and group aliases in a locally exported ML dataset.'));panel.append(consent);
    const save=button('Save trial metadata',()=>{if(isBusy())return notify('Stop capture before editing the dataset.');const trial=current();if(!trial)return;try{trial.ml=metadata({...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value])),datasetConsent:check.checked});window.dispatchEvent(new CustomEvent('spooflab:metadata-changed',{detail:trial.trialId}));notify('Grouping and consent updated. Desktop changes are saved locally; check Evidence Report for save status.');refresh();}catch(error){notify(error.message);}});
    const revoke=button('Remove dataset consent',()=>{if(isBusy())return notify('Stop capture first.');const t=current();if(t){t.ml={...(t.ml||{}),datasetConsent:false};window.dispatchEvent(new CustomEvent('spooflab:metadata-changed',{detail:t.trialId}));check.checked=false;refresh();notify('This trial will be excluded from ML dataset export.');}});
    const exportButton=button('Export consented dataset ↓',()=>{if(isBusy())return notify('Stop capture before exporting.');const selected=getTrials().filter(eligibleMetadata);if(!selected.length)return notify('No trials have complete grouping and explicit dataset consent.');download(JSON.stringify(datasetForTraining(selected),null,2),'application/json','json');notify(`Exported ${selected.length} consented trials. Technical/quality exclusions and group sufficiency are checked by the Python trainer.`);});
    const actions=el('div',null,'action-row');actions.append(save,revoke,exportButton);panel.append(actions);const count=el('p',null,'field-help');count.id='ml-dataset-count';panel.append(count);
    const modeField=field('TRAINING MODE','ml-training-mode','select');
    modeField.input.append(option('exploratory','Exploratory fit - training data only'),option('loocv','Limits analysis - leave one group out'),option('grouped','Strict grouped check - held-out evidence'));
    let trainingActive=false;
    const trainButton=button('Train locally (uses consented trials)',async()=>{
      if(trainingActive||isBusy())return notify('Stop capture or wait for the active training job.');
      if(!window.SpoofMLBridge?.train)return notify('In-app training requires the desktop app. Use dataset export and the local command below.');
      const selected=getTrials().filter(eligibleMetadata);if(!selected.length)return notify('Add complete group aliases and explicit dataset consent first.');
      trainingActive=true;trainButton.disabled=true;modeField.input.disabled=true;syncControls();notify('Training local models with consented trials. No cloud service is contacted.');
      try{const result=await window.SpoofMLBridge.train(datasetForTraining(selected),modeField.input.value);setEvaluation(parseEvaluation(JSON.stringify(result)));notify(evaluation.status==='limits_report'?'Limits analysis finished. Inspect results by held-out group below.':evaluation.status==='exploratory_fitted'?'Exploratory models fitted. Predictions below use training records, not unseen data.':evaluation.status==='evaluated'?'Grouped evaluation finished. Inspect held-out predictions below.':'Insufficient eligible data for the selected mode. See the report below.');}
      catch(error){notify(`Local training failed: ${error.message}`);}finally{trainingActive=false;modeField.input.disabled=false;syncControls();}
    });
    trainButton.id='ml-train';trainButton.disabled=!window.SpoofMLBridge?.train;
    const command=el('pre');command.id='ml-cli-command';function updateCommand(){command.textContent=String.raw`.venv\Scripts\python.exe ml/train.py "path/to/dataset.json" --mode ${modeField.input.value} --output "path/to/evaluation.json"`;}modeField.input.addEventListener('change',()=>{updateCommand();evaluation=evaluations.get(modeField.input.value)||null;renderEvaluation();notify(evaluation?'Restored this mode’s report from memory.':'No report loaded for this mode. Train locally or import its report.');});updateCommand();
    const training=el('section',null,'panel ml-training'),segments=el('div',null,'ml-segments');
    segments.setAttribute('role','group');segments.setAttribute('aria-label','Training mode');
    modeField.wrap.hidden=true;
    const modes=[['exploratory','Exploratory'],['loocv','Group limits'],['grouped','Strict']];
    for(const [value,label] of modes){
      const item=button(label,()=>{modeField.input.value=value;modeField.input.dispatchEvent(new Event('change'));});
      item.dataset.mode=value;segments.append(item);
    }
    const reason=el('p',null,'field-help');
    trainButton.className='primary';trainButton.setAttribute('aria-describedby','ml-train-reason');reason.id='ml-train-reason';
    const cli=el('details');cli.append(el('summary','Local command'),command);
    function syncControls(){
      const eligible=getTrials().some(eligibleMetadata);
      trainButton.disabled=trainingActive||isBusy()||!window.SpoofMLBridge?.train||!eligible;
      trainButton.textContent=trainingActive?'Training locally…':'Train locally';
      trainButton.setAttribute('aria-busy',String(trainingActive));
      for(const control of segments.children){
        control.disabled=trainingActive;
        control.setAttribute('aria-pressed',String(control.dataset.mode===modeField.input.value));
      }
      reason.textContent=trainingActive?'Local Python process running.':isBusy()?'Finish capture before training.':!window.SpoofMLBridge?.train?'Open the desktop app for training. Saved evaluation files can be inspected here.':!eligible?'Assign grouping aliases and dataset consent to enable training.':'Training uses consented measurements on this device.';
    }
    training.append(el('h2','Local training'),segments,modeField.wrap,trainButton,reason,cli);
    const imports=el('section',null,'panel ml-imports'),input=el('input');input.id='ml-evaluation-file';input.type='file';input.accept='.json,application/json';
    const label=el('label','Evaluation file');label.htmlFor=input.id;
    const clear=button('Clear current report',()=>{evaluations.delete(modeField.input.value);evaluation=null;renderEvaluation();notify('Report cleared from memory.');});
    imports.append(el('h2','Report library'),label,input,clear);
    const preparation=el('details',null,'panel ml-preparation');preparation.append(el('summary','Groups and dataset consent'),panel);
    const logPanel=el('div',null,'ml-run-log');logPanel.append(el('h3','Run log'),status);training.append(logPanel);tools.append(training,imports,preparation);
    const output=el('div');output.id='ml-results';main.append(output);
    input.addEventListener('change',async()=>{try{notify('Reading local evaluation…');if(isBusy())throw new Error('Stop capture before importing evaluations.');const file=input.files[0];if(!file||file.size>25_000_000)throw new Error('Choose an evaluation JSON file no larger than 25 MB.');setEvaluation(parseEvaluation(await file.text()));notify('Evaluation imported and consistency checked. Group labels come from the supplied file.');}catch(error){notify(`Import failed: ${error.message}`);}finally{input.value='';}});
    function setEvaluation(report){const mode=report.evaluationMode==='logo_limits'?'loocv':report.evaluationMode==='training_only'?'exploratory':'grouped';evaluations.set(mode,report);evaluation=report;modeField.input.value=mode;updateCommand();renderEvaluation();}
    function notify(text){status.textContent=text;status.dataset.state=/failed|error/i.test(text)?'error':trainingActive?'working':'ready';}
    function current(){return getTrials().find(t=>t.trialId===selectField.input.value);}
    function loadFields(){const t=current();for(const [k,input]of Object.entries(fields))input.value=t?.ml?.[k]||'';check.checked=t?.ml?.datasetConsent===true;}
    selectField.input.addEventListener('change',loadFields);
    function refresh(){const previous=selectField.input.value;selectField.input.replaceChildren();const trials=getTrials();for(const t of trials)selectField.input.append(option(t.trialId,`${t.trialId.slice(0,12)} / ${t.condition}${t.ml?.datasetConsent?' / consented':''}`));if(trials.some(t=>t.trialId===previous))selectField.input.value=previous;const eligible=trials.filter(eligibleMetadata).length;count.textContent=`${eligible} of ${trials.length} trials have complete metadata and dataset consent. Training eligibility is checked separately.`;save.disabled=revoke.disabled=!trials.length;exportButton.disabled=!eligible;loadFields();syncControls();}
    // SVG coordinates scale with panel width; keep the printed tick text at 12 physical pixels.
    const plotSize=new ResizeObserver(entries=>{
      for(const {target,contentRect} of entries){
        if(contentRect.width>0)target.style.fontSize=(12*target.viewBox.baseVal.width/contentRect.width)+'px';
      }
    });
    const plotted=new Set();
    function figureFrame(spec){
      const figure=C.frame(spec);
      for(const previous of plotted)if(!previous.isConnected){plotSize.unobserve(previous);plotted.delete(previous);}
      plotSize.observe(figure);plotted.add(figure);return figure;
    }
    function card(title, index) {
      const box=el('section',null,'ml-card'), heading=el('h2');
      heading.append(el('span',index+' /','ml-index'),document.createTextNode(title));
      box.append(heading);
      return box;
    }
    function help(parent,message) { parent.append(C.state(message,'unavailable')); }
    function sameDatasetReport(mode) {
      const candidate=evaluations.get(mode);
      if(candidate===evaluation)return candidate;
      const fingerprint=evaluation?.dataset.featureFingerprint;
      return fingerprint&&candidate?.dataset.featureFingerprint===fingerprint?candidate:null;
    }
    function renderAudit() {
      const cardEl=card('Independent groups','01');cardEl.id='ml-independent-evidence';
      const a=evaluation?.dataset.independentEvidenceAudit;
      if(!a){help(cardEl,'Import a report with its grouped evaluation audit.');return cardEl;}
      const total=el('p',null,'ml-metric');total.append(el('strong',String(a.mixedGroups)),el('span',' / '+a.minimumMixedGroups+' required'));
      const bar=el('progress');bar.max=a.minimumMixedGroups;bar.value=Math.min(a.mixedGroups,a.minimumMixedGroups);bar.setAttribute('aria-label','Groups containing both classes');
      const state=el('p',null,'ml-audit-status');state.append(C.icon(a.status==='ready'?'pass':'abstain'),el('span',a.status==='ready'?'Minimum met':'Insufficient data'));
      cardEl.append(state,total,bar,el('p',a.mixedGroups+' of '+a.totalGroups+' connected groups contain both live and non-live trials.','field-help'));return cardEl;
    }
    function renderAuc() {
      const box=card('Held-out group AUC','02'), l=sameDatasetReport('loocv')?.logoLimits;
      if(!l){help(box,'Load a Group limits report for this dataset to compare held-out groups.');return box;}
      const element=figureFrame({title:'AUC by held-out group',summary:l.folds.map(f=>'Group '+f.group+': '+(f.auc===null?'unavailable':f.auc)+', n='+ (f.live+f.nonLive)).join('. '),width:460,height:45+l.folds.length*33});
      const left=85,right=350,base=36;
      for(const tick of [0,0.5,1]){
        const x=left+(right-left)*tick;
        element.append(C.svg('line',{x1:x,x2:x,y1:23,y2:base+l.folds.length*33-20,class:tick===.5?'ml-reference':'ml-grid'}),C.svg('text',{x:x,y:16,'text-anchor':'middle'},String(tick)));
      }
      const hatch=C.hatch(element);
      for(const [i,f] of l.folds.entries()){
        const y=base+i*33;
        element.append(C.svg('text',{x:0,y:y+4},'Group '+f.group));
        const desc='Group '+f.group+' · '+f.live+' live, '+f.nonLive+' non-live · '+(f.auc===null?'unavailable ('+f.status.replaceAll('_',' ')+')':'AUC '+f.auc);
        if(f.auc===null) C.mark(element,'rect',{x:left,y:y-5,width:right-left,height:10,fill:hatch},desc);
        else C.mark(element,'circle',{cx:left+(right-left)*f.auc,cy:y,r:5,class:'ml-dot'},desc);
        element.append(C.svg('text',{x:458,y:y+4,'text-anchor':'end'},f.auc===null?'Unavailable':f.auc.toFixed(3)));
      }
      box.append(element,el('p','Scorable groups '+l.mixedGroupsScored+' / '+l.folds.length+'. Descriptive interval '+(l.descriptiveInterval?l.descriptiveInterval.map(n=>n.toFixed(3)).join(' to '):'unavailable')+'.','field-help'));
      return box;
    }
    function renderShuffle() {
      const box=card('Shuffled-label training control','03');box.id='ml-shuffle-control';
      const c=sameDatasetReport('exploratory')?.shuffledLabelControl;
      if(!c){help(box,'Load an exploratory report to inspect the individual shuffled fits.');return box;}
      const summary=c.matchOrExceedReal+' of '+c.runs+' shuffled fits matched or exceeded the real fit.';
      const line=el('p',null,'ml-shuffle-summary');line.append(el('strong',c.matchOrExceedReal+' / '+c.runs),document.createTextNode(' matched or exceeded the real fit'));
      const graph=figureFrame({title:'Training-label matches per shuffled fit',summary,width:600,height:154});
      const counts=new Map(),n=c.trainingTrials;
      for(const value of c.shuffledLabelMatches)counts.set(value,(counts.get(value)||0)+1);
      const maxCount=Math.max(...counts.values());
      const x=v=>18+(564*v/Math.max(1,n)),scale=86/maxCount;
      graph.append(C.svg('line',{x1:18,y1:110,x2:582,y2:110,class:'ml-grid'}));
      const target=x(c.realLabelMatches);
      graph.append(C.svg('line',{x1:target,x2:target,y1:15,y2:116,class:'ml-reference'}),C.svg('text',{x:target,y:12,'text-anchor':target>495?'end':'start'},'Real fit '+c.realLabelMatches+'/'+n));
      const stacked=new Map();
      c.shuffledLabelMatches.forEach((v,i)=>{
        const k=stacked.get(v)||0;stacked.set(v,k+1);
        C.mark(graph,'circle',{cx:x(v),cy:104-k*scale,r:Math.min(4,scale*.42),class:v>=c.realLabelMatches?'ml-dot':'ml-muted-dot'},'Shuffle '+(i+1)+': '+v+' matched labels, n='+n);
      });
      graph.append(C.svg('text',{x:18,y:136},'0'),C.svg('text',{x:582,y:136,'text-anchor':'end'},n+' labels'));
      box.append(line,graph,el('p','Training fit, not a significance test. Each dot is one shuffled fit.','field-help'));return box;
    }
    function renderPrediction(panel,model,scope,optional=false){
      const suffix=optional?'-tree':'';
      const inspect=el('section');inspect.id='ml-inspector'+suffix;
      const filter=field('Trial filter','ml-prediction-filter'+suffix,'select'),choice=field('Prediction','ml-prediction-pick'+suffix,'select');
      for(const [value,label] of [['all','All trials'],['errors','Incorrect labels'],['borderline','Scores 0.4–0.6']]) filter.input.append(option(value,label));
      const fields=el('div',null,'ml-fields');fields.append(filter.wrap,choice.wrap);panel.append(fields,inspect);
      const all=el('details',null,'ml-all-scores');
      all.append(el('summary','Inspect prediction table'));panel.append(all);
      function fill(){
        const records=model.predictions.filter(p=>filter.input.value==='errors'?!p.correct:filter.input.value==='borderline'?p.probability>=.4&&p.probability<=.6:true);
        choice.input.replaceChildren(...records.map(p=>option(p.trialId,p.trialId.slice(0,12)+' / '+p.condition)));
        choice.input.disabled=!records.length;
        all.querySelector('.ml-score-wrap')?.remove();
        const wrap=el('div',null,'ml-score-wrap'),table=el('table'),header=el('tr');
        for(const label of ['Trial','Condition','Score','Label','Inspect'])header.append(el('th',label));
        table.append(header);
        for(const row of records){
          const tr=el('tr'),action=el('td');action.append(button('Explain',()=>{choice.input.value=row.trialId;draw();inspect.scrollIntoView({block:'nearest'});}));
          tr.append(el('td',row.trialId.slice(0,12)),el('td',row.condition),el('td',row.probability.toFixed(4)),el('td',row.predictedLabel?'Live':'Non-live'),action);table.append(tr);
        }
        wrap.append(table);all.append(wrap);draw();
      }
      function draw(){
        inspect.replaceChildren();
        const p=model.predictions.find(p=>p.trialId===choice.input.value);
        if(!p){help(inspect,'Choose another filter to inspect a prediction.');return;}
        const items=[...p.contributions].sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution));
        const center=330, half=116, max=Math.max(0,...items.map(a=>Math.abs(a.contribution)));
        const figure=figureFrame({title:model.name+' contributions',summary:items.map(i=>i.feature+': '+i.contribution.toFixed(4)).join('. '),width:555,height:46+items.length*28});
        figure.append(C.svg('line',{x1:center,x2:center,y1:22,y2:items.length*28+29,class:'ml-reference'}),C.svg('text',{x:center,y:13,'text-anchor':'middle'},'0'));
        const t=el('table'),header=el('tr');for(const label of ['Feature','Measurement','Contribution'])header.append(el('th',label));t.append(header);
        for(const [i,it] of items.entries()){
          const y=35+i*28,width=max?half*Math.abs(it.contribution)/max:0;
          figure.append(C.svg('text',{x:3,y:y+4},it.feature.replaceAll('_',' ')),C.svg('text',{x:545,y:y+4,'text-anchor':'end'},(it.contribution>0?'+':'')+it.contribution.toFixed(3)));
          C.mark(figure,'rect',{x:it.contribution<0?center-width:center,y:y-5,width,height:10,class:it.contribution<0?'ml-muted-dot':'ml-dot'},it.feature+': '+it.contribution+' log-odds; n=1 trial');
          const row=el('tr');row.append(el('td',it.feature),el('td',it.value===null?'Missing / imputed':String(it.value)),el('td',String(it.contribution)));t.append(row);
        }
        const details=el('details');details.append(el('summary','Exact contributions'),t);
        inspect.append(el('p',scope+' record · '+p.condition+' · model label '+(p.predictedLabel?'live':'non-live')+' · uncalibrated score '+p.probability.toFixed(3)),figure,el('p','Positive contributions increase the fitted live-label score. Values are changes in log-odds for this one record.','field-help'),details);
        const trial=getTrials().find(t=>t.trialId===p.trialId);
        if(trial&&window.SpoofPolicies){
          const d=el('details');d.id='ml-policy-comparison'+suffix;d.append(el('summary','Compare frozen policies'));
          for(const rule of window.SpoofPolicies.POLICIES){
            const outcome=window.SpoofPolicies.evaluate(rule.id,window.SpoofPolicies.fromTrialMeasurements(trial));const verb={pass:'Rule passed',fail:'Rule failed',abstain:'Rule could not score'};
            d.append(el('p',rule.name+' · '+verb[outcome.decision]+'. '+outcome.reasons.join(' ')));
          }
          inspect.append(d);
        }
      }
      choice.input.addEventListener('change',draw);filter.input.addEventListener('change',fill);fill();
    }
    function renderEvaluation(){
      syncControls();headline.replaceChildren(renderAudit(),renderAuc(),renderShuffle());output.replaceChildren();clear.disabled=!evaluation;
      if(!evaluation){output.append(C.state('Import a local evaluation or train a model to inspect feature contributions.','empty'));return;}
      const r=evaluation,trainingOnly=r.status==='exploratory_fitted';
      output.append(el('p',(trainingOnly?'Training-data exploration · ':'')+r.status.replaceAll('_',' ')+' · '+r.dataset.eligibleTrials+' eligible of '+r.dataset.totalTrials+' trials.','ml-report-meta'));
      const logistic=r.models.find(m=>m.name==='Logistic regression')||r.models.find(m=>m.name!=='XGBoost');
      if(logistic){const p=card(logistic.name+' contributions','04');output.append(p);renderPrediction(p,logistic,trainingOnly?'Training':'Held-out');}
      const tree=r.models.find(m=>m.name==='XGBoost');
      if(tree){
        const d=el('details',null,'ml-tree'), title=el('summary','XGBoost · optional inspection');d.append(title);
        const constant=tree.predictions.every(row=>row.probability===tree.predictions[0].probability);
        if(constant){title.append(el('span','Constant score','ml-tree-state'));d.append(el('p','Every fitted score equals '+tree.predictions[0].probability+'. This model gives all these records the same ranking.'));}
        d.append(el('p',tree.metrics.evaluatedTrials+' scored records. '+tree.metrics.falseLive+' false-live labels; '+tree.metrics.missedLive+' missed live labels.'));
        const exact=el('details');exact.append(el('summary','Exact model metrics'),el('pre',JSON.stringify(tree.metrics,null,2)));d.append(exact);output.append(d);
        d.addEventListener('toggle',()=>{if(d.open&&!d.querySelector('#ml-inspector-tree'))renderPrediction(d,tree,trainingOnly?'Training':'Held-out',true);});
      }
      const raw=el('details',null,'ml-raw');raw.append(el('summary','Inspect evaluation JSON'));raw.addEventListener('toggle',()=>{if(raw.open&&!raw.querySelector('pre'))raw.append(el('pre',JSON.stringify(r,null,2)));});output.append(raw);
      const notes=el('details',null,'ml-notes');notes.append(el('summary','Research notes and limitations'),el('p',r.narrative));
      const list=el('ul');for(const text of [...r.limitations,...r.recommendations])list.append(el('li',text));notes.append(list);output.append(notes);
      if(r.dataset.featureFingerprint)notes.append(el('p','Input fingerprint '+r.dataset.featureFingerprint.slice(0,16)+' · seed '+r.seed,'field-help'));
      const exports=el('div',null,'action-row');exports.append(button('Export evaluation JSON',()=>download(JSON.stringify(r,null,2),'application/json','json')),button('Export research summary',()=>download('# SpoofLab local model evaluation\n\n'+r.narrative+'\n\n## Next experiments\n'+r.recommendations.map(x=>'- '+x).join('\n')+'\n\n## Limitations\n'+r.limitations.map(x=>'- '+x).join('\n')+'\n\nReport scope: '+(r.evaluationMode||'grouped_holdout')+'. Scores are uncalibrated.\n','text/markdown','md')));output.append(exports);
    }
    refresh();renderEvaluation();mounted={refresh,clearEvaluation(){evaluations.clear();evaluation=null;renderEvaluation();}};return mounted;
  }
  return {mount,metadata,eligibleMetadata,datasetForTraining,parseEvaluation,refresh(){mounted?.refresh();},clearEvaluation(){mounted?.clearEvaluation();}};
});
