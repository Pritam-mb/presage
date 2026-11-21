(function(root){
  'use strict';
  const P=root.SpoofPolicies,C=root.SpoofCharts;
  const conditions={live:'Me, live',printed_photo:'Printed photo',screen_replay:'Recording on a phone screen',injected_replay:'File fed to the SDK'};
  const columns={live:'Live',printed_photo:'Photo',screen_replay:'Screen replay',injected_replay:'File replay'};
  const words={pass:'Rule passed',fail:'Rule failed',abstain:'Rule could not score'};
  let instance;
  function wilson(k,n){
    if(!n)return null;
    const z=1.95996398454,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
    return [Math.max(0,c-h),Math.min(1,c+h)];
  }
  function el(tag,text,cls){const item=document.createElement(tag);if(text!=null)item.textContent=text;if(cls)item.className=cls;return item;}
  function button(text,fn){const btn=el('button',text);btn.type='button';btn.addEventListener('click',fn);return btn;}
  function mount({getTrials,isBusy,download,beginCapture,showView}){
    const view=el('section',null,'view');view.id='view-arena';view.hidden=true;document.querySelector('main').insertBefore(view,document.querySelector('main > footer'));
    const intro=el('div',null,'page-intro');intro.append(el('h1','Policy Arena'),el('p','Score a trial from its measurements, then reveal the declared input.','lede'));
    const workspace=el('div',null,'arena-workspace'),settings=el('section',null,'panel arena-config');
    const output=el('section',null,'panel arena-verdict');output.id='arena-result';output.setAttribute('aria-live','polite');
    workspace.append(settings,output);view.append(intro,workspace);
    const policy=el('select');policy.id='arena-policy';policy.hidden=true;
    const tabs=el('div',null,'arena-tabs');tabs.setAttribute('aria-label','Frozen policy');
    const chips=el('div',null,'threshold-chips');
    const saved=el('select');saved.id='arena-trial';
    const sl=el('label','Saved trial');sl.htmlFor=saved.id;
    const evaluateButton=button('Score blindly',()=>{if(isBusy())return;const trial=getTrials().find(t=>t.trialId===saved.value);if(trial)evaluateTrial(trial,policy.value);});
    evaluateButton.id='arena-evaluate';evaluateButton.className='primary';
    const helper=el('p',null,'field-help');
    settings.append(el('h2','01 / Frozen rule'),tabs,policy,chips,sl,saved,evaluateButton,helper);
    let current=null,pending=null,ledgerRows=[];
    const revealed=new Map();
    function resetOutput(){
      current=null;output.className='panel arena-verdict';
      output.replaceChildren(el('p','02 / Blind verdict','micro'),C.state('Score a saved trial to see its decision and evidence.'));
    }
    function updatePolicy(){
      for(const b of tabs.children)b.setAttribute('aria-pressed',b.dataset.policy===policy.value);
      chips.replaceChildren();
      const t=P.THRESHOLDS,active=P.POLICIES.find(p=>p.id===policy.value);
      const values=[active.version,t.pulseWarmupSec+' s warm-up','≥ '+t.minimumPostWarmupPulseEstimates+' estimates'];
      if(policy.value!=='pulse-only-v1')values.push('≥ '+100*t.minimumStableFraction+'% stable','≤ '+100*t.maximumValidationErrorFrameFraction+'% warnings');
      if(policy.value==='pulse-plus-blink-v1')values.push('Fresh blink required');
      for(const value of values)chips.append(el('span',value));
      resetOutput();
    }
    for(const [index,p] of P.POLICIES.entries()){
      const option=el('option',p.name);option.value=p.id;policy.append(option);
      const b=button(['Pulse only','Quality-gated','Quality + blink'][index],()=>{policy.value=p.id;updatePolicy();});
      b.dataset.policy=p.id;tabs.append(b);
    }
    policy.onchange=updatePolicy;saved.onchange=resetOutput;updatePolicy();
    const drawer=document.createElement('dialog');drawer.className='lab-drawer arena-trace';
    drawer.setAttribute('aria-label','Decision trace');view.append(drawer);
    function inspect(trace){
      const code=JSON.stringify(trace,null,2),notice=el('p',null,'status');notice.setAttribute('role','status');
      const copy=button('Copy trace',async()=>{try{await navigator.clipboard.writeText(code);notice.textContent='Trace copied.';}catch{notice.textContent='Copy unavailable. Select the trace text or export the file.';}});
      drawer.replaceChildren(button('Close',()=>drawer.close()),el('h2','Decision trace'),el('p',trace.policyId),el('pre',code),copy,
        button('Export JSON',()=>download(code,'application/json','json')),notice);drawer.showModal();
    }
    function evaluateTrial(trial,id){
      const measurements=P.fromTrialMeasurements(trial),trace=P.decisionTrace(id,measurements,{trialId:trial.trialId,sourceTrialReference:'saved-trial:'+trial.trialId});
      current={trial,trace};output.className='panel arena-verdict';
      const label=el('div',null,'arena-result-label');label.append(C.icon(trace.decision),el('strong',words[trace.decision]));
      const code=el('h2',trace.decision.toUpperCase(),'verdict-code');code.setAttribute('aria-label','Decision code '+trace.decision);
      const details=el('details'),dl=el('dl',null,'arena-metrics');
      for(const [key,value] of Object.entries(trace.metricsRead))dl.append(el('dt',key),el('dd',value===null?'Unavailable':typeof value==='object'?JSON.stringify(value):String(value)));
      details.append(el('summary','Measurements and missing fields'),dl,el('p','Missing: '+(trace.missingFields.join(', ')||'None')));
      output.replaceChildren(el('p','02 / Blind verdict','micro'),label,code,...trace.reasons.map(r=>el('p',r)),details);
      const actions=el('div',null,'action-row'),reveal=button('Reveal condition',()=>{
        revealed.set(trial.trialId+'|'+id,{condition:trial.condition,trace});reveal.disabled=true;
        const correct=(trace.decision==='pass')===(trial.condition==='live');
        const state=trace.decision==='abstain'?'abstain':correct?'right':'wrong';
        output.dataset.reveal=state;output.classList.add('is-revealed');
        const revealedNote=el('div',null,'reveal-note');revealedNote.append(C.icon(state==='right'?'pass':state==='wrong'?'fail':'abstain'),
          el('strong','Reveal: '+conditions[trial.condition]),el('span',state==='abstain'?'Rule could not score':correct?'Agrees with declared input':'Conflicts with declared input'));
        output.append(revealedNote);score();
      });
      reveal.id='arena-reveal';actions.append(reveal,button('Inspect trace',()=>inspect(trace)));
      output.append(actions,el('p',P.LIMITATION,'field-help'));delete output.dataset.reveal;
    }
    const live=el('details',null,'panel arena-fresh');live.append(el('summary','Prepare a fresh trial'));
    const preset=el('select');preset.id='arena-preset';
    for(const [key,value] of Object.entries(conditions)){const option=el('option',value);option.value=key;preset.append(option);}
    const instructions=el('p'),status=el('p',null,'status');status.id='arena-live-status';status.setAttribute('role','status');
    const help={live:'Use a consenting live participant and review framing before capture.',printed_photo:'Confirm permission for the photograph before capture.',screen_replay:'Confirm permission for the recorded material before capture.',injected_replay:'Select the consented recording in Capture.'};
    preset.onchange=()=>{instructions.textContent=help[preset.value];};preset.onchange();
    const prepare=button('Prepare live arena trial',()=>{if(isBusy())return;pending={policyId:policy.value,armedAt:Date.now()};beginCapture({condition:preset.value,challenge:policy.value==='pulse-plus-blink-v1'});status.textContent='Prepared '+pending.policyId+'. Confirm consent in Capture.';});
    const cancel=button('Cancel arena preparation',()=>{pending=null;status.textContent='Preparation cancelled.';});
    const pl=el('label','Input setup');pl.htmlFor=preset.id;
    live.append(pl,preset,instructions,prepare,cancel,status);settings.append(live);
    const scoreboard=el('section',null,'panel');scoreboard.id='arena-scoreboard';view.append(scoreboard);
    const trade=el('section',null,'panel arena-tradeoff');view.append(trade);
    function score(){
      scoreboard.replaceChildren(el('h2','03 / Revealed scoreboard'),el('p','Each revealed trial counts once per rule. Pass share includes abstentions. Intervals describe trials with repeated sources.'));
      const groups=new Map();
      for(const {condition,trace} of revealed.values()){
        const key=trace.policyId+'|'+condition;
        if(!groups.has(key))groups.set(key,{pass:0,fail:0,abstain:0,n:0});
        const group=groups.get(key);group[trace.decision]++;group.n++;
      }
      const table=el('table',null,'arena-matrix'),head=el('tr');head.append(el('th','Rule'));
      for(const label of Object.values(columns))head.append(el('th',label));
      const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
      for(const p of P.POLICIES){
        const tr=el('tr');tr.append(el('th',p.name));
        for(const key of Object.keys(columns)){
          const group=groups.get(p.id+'|'+key),cell=el('td');
          if(!group){cell.append(el('span','Unavailable','unavailable-cell'),el('small','n = 0'));tr.append(cell);continue;}
          const lohi=wilson(group.pass,group.n).map(x=>(100*x).toFixed(1)+'%').join(' – ');
          const bar=C.frame({title:p.name+' / '+columns[key],summary:group.pass+' pass, '+group.fail+' fail, '+group.abstain+' abstain of '+group.n,width:100,height:8});
          bar.setAttribute('preserveAspectRatio','none');let pos=0;
          for(const decision of ['pass','fail','abstain']){
            const w=100*group[decision]/group.n,correct=(decision==='pass')===(key==='live');
            C.mark(bar,'rect',{x:pos,y:0,width:w,height:8,fill:decision==='abstain'?'var(--amber)':correct?'var(--signal)':'var(--red)'},decision+' '+group[decision]+' of '+group.n);pos+=w;
          }
          cell.append(bar,el('strong',group.pass+' / '+group.n+' passed'),el('small',group.fail+' failed · '+group.abstain+' abstained'),el('small','95% '+lohi));tr.append(cell);
        }
        body.append(tr);
      }
      table.append(body);const wrap=el('div',null,'table-wrap');wrap.append(table);scoreboard.append(wrap);
      if(!groups.size)scoreboard.append(C.state('Score a trial and reveal its input to populate the matrix.'));
    }
    function refresh(){
      const trials=getTrials(),prior=saved.value;saved.replaceChildren();
      trials.forEach((t,i)=>{const option=el('option','Trial '+(i+1)+' · condition hidden');option.value=t.trialId;saved.append(option);});
      if(trials.some(t=>t.trialId===prior))saved.value=prior;
      const busy=isBusy();saved.disabled=!trials.length||busy;evaluateButton.disabled=saved.disabled;prepare.disabled=busy;
      helper.textContent=busy?'Finish the active capture first.':!trials.length?'Import a report in Evidence or prepare a fresh trial.':'The input label stays hidden during scoring.';
      const ids=new Set(trials.map(t=>t.trialId));if(current&&!ids.has(current.trial.trialId))resetOutput();
      for(const [key,r] of revealed)if(!ids.has(r.trace.trial_id))revealed.delete(key);
      score();root.SpoofEvidenceUI.tradeoff(trade,ledgerRows);
    }
    root.addEventListener('spooflab:trial-saved',event=>{
      const t=event.detail;if(!pending||Date.parse(t.startedAt)<pending.armedAt)return;
      const id=pending.policyId;pending=null;refresh();saved.value=t.trialId;evaluateTrial(t,id);status.textContent='Fresh trial scored.';showView('arena');
    });
    instance={refresh,rows(rows){ledgerRows=rows;root.SpoofEvidenceUI.tradeoff(trade,rows);},
      clear(){pending=null;revealed.clear();delete output.dataset.reveal;resetOutput();refresh();}};
    refresh();return instance;
  }
  root.SpoofArena={mount,refresh(){instance?.refresh();},clear(){instance?.clear();},setRows(rows){instance?.rows(rows);},wilson};
})(globalThis);
