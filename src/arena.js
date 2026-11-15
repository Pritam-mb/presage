(function(root){'use strict';
 const P=root.SpoofPolicies;let instance;
 const conditions={live:'Me, live',printed_photo:'Printed photo',screen_replay:'Recording on a phone screen',injected_replay:'File fed to the SDK'};
 function wilson(k,n){if(!n)return null;const z=1.95996398454,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-h,c+h];}
 function mount({getTrials,isBusy,download,beginCapture,showView}){
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
  const nav=el('button',null,'nav-button');nav.dataset.view='arena';nav.append(el('span','05'),document.createTextNode('Policy Arena'));document.querySelector('nav').append(nav);
  const view=el('section',null,'view');view.id='view-arena';view.hidden=true;document.querySelector('main').insertBefore(view,document.querySelector('main > footer'));
  const intro=el('div',null,'page-intro');const heading=el('div');heading.append(el('p','FIXED POLICY / MEASUREMENTS / REVEAL','eyebrow'),el('h1','What did the policy trust?'),el('p','Run a frozen policy on saved or freshly captured measurements. Reveal the input condition after inspecting the decision.','lede'));intro.append(heading);view.append(intro,el('p',P.LIMITATION,'notice'));
  const settings=el('section',null,'panel'),policy=el('select');policy.id='arena-policy';for(const p of P.POLICIES){const o=el('option',`${p.name} / ${p.id}`);o.value=p.id;policy.append(o);}const pl=el('label','FROZEN POLICY');pl.htmlFor=policy.id;settings.append(pl,policy);
  const limits=el('pre');settings.append(el('p','Thresholds are frozen. These three policies are separate from the historical experimental verifier.'),limits);policy.addEventListener('change',()=>{limits.textContent=JSON.stringify({policy:policy.value,thresholds:P.THRESHOLDS},null,2);});policy.dispatchEvent(new Event('change'));
  const saved=el('select');saved.id='arena-trial';const sl=el('label','SAVED TRIAL / CONDITION HIDDEN');sl.htmlFor=saved.id;settings.append(sl,saved);view.append(settings);
  const output=el('section',null,'panel');output.id='arena-result';output.append(el('p','Select a saved trial to begin.','empty-state'));view.append(output);
  const scoreboard=el('section',null,'panel');scoreboard.id='arena-scoreboard';view.append(scoreboard);
  let current=null,pending=null;const revealed=new Map();
  function resetOutput(){current=null;output.replaceChildren(el('p','Select a saved trial or capture a new one.','empty-state'));}
  function score(){scoreboard.replaceChildren(el('h2','Revealed attempts by input and policy'),el('p','Distinct trial/policy pairs only. Passes over attempts include abstentions in the denominator. Intervals do not account for repeated people or recordings. Counts describe trials, not independent participants.'));
   const groups=new Map();for(const r of revealed.values()){const key=r.condition+'|'+r.trace.policyId;if(!groups.has(key))groups.set(key,{condition:r.condition,policy:r.trace.policyId,n:0,pass:0,fail:0,abstain:0});const g=groups.get(key);g.n++;g[r.trace.decision]++;}
   const table=el('table'),head=el('tr');for(const x of ['Revealed input','Policy','Pass / attempts','Fail','Abstain','Wilson 95%'])head.append(el('th',x));table.append(head);
   for(const g of groups.values()){const interval=wilson(g.pass,g.n),row=el('tr');for(const x of [conditions[g.condition]||g.condition,g.policy,`${g.pass} / ${g.n}`,g.fail,g.abstain,interval.map(x=>(100*x).toFixed(1)+'%').join('–')])row.append(el('td',x));table.append(row);}const wrap=el('div',null,'table-wrap');wrap.append(table);scoreboard.append(wrap);if(!groups.size)scoreboard.append(el('p','Reveal evaluated trials to populate this scoreboard.'));
  }
  function evaluateTrial(trial,id){
   const measurements=P.fromTrialMeasurements(trial);const trace=P.decisionTrace(id,measurements,{trialId:trial.trialId,sourceTrialReference:'saved-trial:'+trial.trialId});
   current={trial,trace};output.replaceChildren(el('p',id,'eyebrow'),el('h2',trace.decision.toUpperCase()),...trace.reasons.map(r=>el('p',r)),el('p',P.LIMITATION));
   const details=el('details');details.append(el('summary','Decision trace: exact metrics, missing fields and thresholds'),el('pre',JSON.stringify(trace,null,2)));output.append(details);
   const reveal=button('Reveal input condition',()=>{
    const condition=trial.condition;revealed.set(trial.trialId+'|'+id,{condition,trace});
    const interpretation=trace.decision==='abstain'?'Could not tell':trace.decision==='pass'?(condition==='live'?'Pass agrees with the operator live label':'Passing would be a presence error: a non-live labeled input passed'):(condition==='live'?'Failing would be a presence error: a live labeled input failed':'Fail agrees with the operator non-live label');
    output.append(el('h3','Reveal: '+(conditions[condition]||condition)),el('p',interpretation),el('p','Input labels are operator-provided metadata, not authenticated ground truth. A matching decision does not validate the policy.'));reveal.disabled=true;score();
   });reveal.id='arena-reveal';output.append(reveal,button('Export this decision trace',()=>download(JSON.stringify(trace,null,2),'application/json','json')));
  }
  const evaluateButton=button('Evaluate saved trial',()=>{if(isBusy())return;const trial=getTrials().find(t=>t.trialId===saved.value);if(trial)evaluateTrial(trial,policy.value);});evaluateButton.id='arena-evaluate';settings.append(evaluateButton);
  saved.addEventListener('change',resetOutput);
  const live=el('section',null,'panel'),preset=el('select');preset.id='arena-preset';for(const [id,name]of Object.entries(conditions)){const option=el('option',name);option.value=id;preset.append(option);}
  const instructions=el('p'),status=el('p',null,'status');status.id='arena-live-status';
  const help={live:'Sit still with face and upper torso visible. Use a fresh consenting live trial.',printed_photo:'Use a consenting printed photo with the camera fixed. Missing measurements are retained.',screen_replay:'Film a consenting recording on a separate display. The phone used as the webcam cannot also be the replay display.',injected_replay:'Select a consenting video at least 95 seconds long. Playback is real time; do not loop or seek.'};
  preset.addEventListener('change',()=>{instructions.textContent=help[preset.value];});preset.dispatchEvent(new Event('change'));
  live.append(el('h2','Live Attack Arena'),el('p','Choose the input setup, then open Capture Laboratory. The selected arena policy/version is frozen for that run; the decision receives measurements only. The normal capture view may also show its separate historical-verifier result.'),preset,instructions,
   button('Prepare live arena trial',()=>{if(isBusy())return;pending={policyId:policy.value,armedAt:Date.now()};beginCapture({condition:preset.value,challenge:policy.value==='pulse-plus-blink-v1'});status.textContent='Arena armed: '+pending.policyId+'. Confirm consent and Start in Capture Laboratory. On completion, return here for the decision/reveal.';}),
   button('Cancel arena preparation',()=>{pending=null;status.textContent='Arena preparation cancelled.';}),status);
  settings.after(live);
  window.addEventListener('spooflab:trial-saved',event=>{const t=event.detail;if(!pending||Date.parse(t.startedAt)<pending.armedAt)return;const id=pending.policyId;pending=null;refresh();saved.value=t.trialId;evaluateTrial(t,id);status.textContent='Fresh trial captured and evaluated with '+id;showView('arena');});
  function refresh(){const previous=saved.value;saved.replaceChildren();for(const t of getTrials()){const option=el('option',t.trialId.slice(0,8)+' / '+String(t.startedAt||'saved'));option.value=t.trialId;saved.append(option);}if(getTrials().some(t=>t.trialId===previous))saved.value=previous;if(current&&!getTrials().some(t=>t.trialId===current.trial.trialId))resetOutput();const ids=new Set(getTrials().map(t=>t.trialId));for(const [key,r]of revealed)if(!ids.has(r.trace.trial_id))revealed.delete(key);score();}
  refresh();instance={refresh,clear(){pending=null;revealed.clear();resetOutput();refresh();}};return instance;
 }
 root.SpoofArena={mount,refresh(){instance?.refresh();},clear(){instance?.clear();},wilson};
})(globalThis);
