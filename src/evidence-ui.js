(function(root) {
  'use strict';
  const C=root.SpoofCharts;
  const $=id=>document.getElementById(id);
  const conditionLabels={live:'Live baseline',printed_photo:'Photograph',screen_replay:'Screen replay',injected_replay:'File replay'};
  const outcomeLabels={accepted:'Rule passed',rejected:'Rule failed',inconclusive:'Rule could not score'};
  const icons={accepted:'pass',rejected:'fail',inconclusive:'abstain'};
  let drawer, filters, endingPanel, returnFocus, sortColumn, sortDirection=1;
  function el(tag,text,cls){
    const item=document.createElement(tag);
    if(text!=null)item.textContent=text;
    if(cls)item.className=cls;
    return item;
  }
  function markerOutcome(outcome){
    const chip=el('span',null,'evidence-outcome');
    chip.append(C.icon(icons[outcome]),el('span',outcomeLabels[outcome]||outcome));
    return chip;
  }
  function mount(){
    if(filters)return;
    const view=$('view-evidence'),stats=view.querySelector('.evidence-stats');
    view.querySelector('.page-intro').after(stats);
    endingPanel=el('section',null,'panel early-panel');
    endingPanel.append(el('h2','Early endings'),$('early-endings'));
    stats.after(endingPanel);
    const filter=$('filter');
    filters=el('div',null,'ledger-filters');filters.setAttribute('aria-label','Filter by condition');
    for(const option of filter.options){
      const b=el('button',option.value==='all'?'All inputs':conditionLabels[option.value]);
      b.type='button';b.dataset.condition=option.value;
      b.onclick=()=>{filter.value=option.value;filter.dispatchEvent(new Event('change'));};
      filters.append(b);
    }
    filter.closest('.filter-row').hidden=true;
    view.querySelector('.ledger-panel .panel-heading').after(filters);
    drawer=document.createElement('dialog');drawer.className='lab-drawer trial-inspector';drawer.setAttribute('aria-labelledby','inspection-drawer-title');
    const close=el('button','Close');close.type='button';close.addEventListener('click',()=>drawer.close());
    const panel=$('detail-panel');panel.querySelector('h2').id='inspection-drawer-title';panel.querySelector('.panel-heading').append(close);
    document.body.append(drawer);drawer.append(panel);
    drawer.addEventListener('click',e=>{if(e.target===drawer && e.clientX<drawer.getBoundingClientRect().left)drawer.close();});
    drawer.addEventListener('close',()=>returnFocus?.isConnected && returnFocus.focus());
    view.querySelector('.ledger-panel .table-wrap').classList.add('ledger-scroll');
    const headings=[...view.querySelectorAll('.ledger-scroll th')];
    for(const [index,head] of headings.slice(0,4).entries()){
      const b=el('button',head.textContent,'sort-ledger');b.type='button';b.setAttribute('aria-label','Sort by '+head.textContent);
      b.onclick=()=>{
        sortDirection=sortColumn===index?-sortDirection:1;sortColumn=index;
        headings.forEach(h=>h.removeAttribute('aria-sort'));
        head.setAttribute('aria-sort',sortDirection===1?'ascending':'descending');sortLedger();
      };
      head.replaceChildren(b);
    }
    $('outcome-overview').querySelector('.outcome-key').replaceChildren(...Object.keys(icons).map(key=>{const li=el('li');li.append(markerOutcome(key));return li;}));
  }
  function sortLedger(){
    if(sortColumn===undefined)return;
    const body=$('trials'),rows=[...body.rows];
    const val=row=>row.cells[sortColumn].textContent;
    rows.sort((a,b)=>sortDirection*(sortColumn===1?parseFloat(val(a))-parseFloat(val(b)):val(a).localeCompare(val(b))));
    body.append(...rows);
  }
  function histogram(bins){
    const n=bins.reduce((count,b)=>count+b.count,0);
    if(!n)return C.state('No confidence samples were available during this trial.','unavailable');
    const max=Math.max(...bins.map(b=>b.count)),chart=C.frame({title:'SDK confidence by range',summary:bins.map(b=>b.low+' to '+(b.low+20)+' percent: '+b.count).join('. '),width:420,height:160});
    bins.forEach((bin,i)=>{
      const x=10+i*82,height=90*bin.count/max;
      C.mark(chart,'rect',{x,y:115-height,width:58,height,fill:'var(--signal-dim)',tabindex:0},bin.low+' to '+(bin.low+20)+'%: '+bin.count+' of '+n+' SDK samples');
      chart.append(C.svg('text',{x:x+29,y:107-height,'text-anchor':'middle',class:'chart-row-label'},bin.count),
        C.svg('text',{x:x+29,y:137,'text-anchor':'middle',class:'chart-tick'},bin.low+'–'+(bin.low+20)+'%'));
    });
    return chart;
  }
  function openInspector(){
    if(!drawer.open){returnFocus=document.activeElement;drawer.showModal();}
  }
  function drawEndings(counts){
    const holder=$('early-endings');holder.replaceChildren();
    if(!counts.size){holder.append(C.state('No early endings in this ledger.'));return;}
    const n=[...counts.values()].reduce((a,b)=>a+b,0);
    for(const [label,count] of counts){
      const entry=el('span',null,'ending-entry'),size=el('strong',count+' / '+n);
      const chart=C.frame({title:label,summary:count+' of '+n+' early endings',width:160,height:8});
      C.mark(chart,'rect',{x:0,y:0,width:160,height:8,fill:'var(--line)'});
      C.mark(chart,'rect',{x:0,y:0,width:160*count/n,height:8,fill:'var(--amber)'},label+': '+count+' of '+n);
      entry.append(el('span',label),size,chart);holder.append(entry);
    }
  }
  function syncFilter(){
    for(const b of filters.children)b.setAttribute('aria-pressed',b.dataset.condition===$('filter').value);
  }
  function distribution(trials,summaries,onInspect){
    const holder=$('quality-plot');holder.replaceChildren();const stable=$('quality-measure').value==='stable';
    if(!trials.length){holder.append(C.state('Run a trial or import an evidence report to compare signal quality.'));return;}
    const rows=Object.entries(conditionLabels).map(([key,label])=>{
      const data=[],positions=[];let total=0;
      for(let i=0;i<trials.length;i++){
        const t=trials[i];if(t.condition!==key)continue;total++;
        const val=stable?summaries[i].stableFraction:summaries[i].meanConfidence;
        if(Number.isFinite(val))data.push({t,v:stable?val*100:val});
      }
      data.sort((a,b)=>a.v-b.v);
      for(const item of data){
        let lane=positions.findIndex(last=>item.v-last>=3);
        if(lane<0)lane=positions.length;
        positions[lane]=item.v;item.lane=lane;
      }
      return {label,data,total,height:Math.max(48,positions.length*12+26)};
    });
    const width=720,left=164,right=670,height=rows.reduce((sum,r)=>sum+r.height,0)+48;
    const x=v=>left+(right-left)*v/100;
    const caption=rows.map(r=>r.label+': '+r.data.length+' measured of '+r.total).join('. ');
    const svg=C.frame({title:stable?'Stable pulse samples':'Mean pulse confidence',summary:caption,width,height}),hatch=C.hatch(svg);
    for(const tick of [0,25,50,75,100]){
      C.mark(svg,'line',{x1:x(tick),x2:x(tick),y1:28,y2:height-10,class:'chart-grid'});
      svg.append(C.svg('text',{x:x(tick),y:18,'text-anchor':'middle',class:'chart-tick'},tick+'%'));
    }
    let y=30;
    for(const row of rows){
      svg.append(C.svg('text',{x:2,y:y+15,class:'chart-row-label'},row.label),C.svg('text',{x:2,y:y+33,class:'chart-tick'},row.data.length+' measured / '+row.total));
      if(!row.data.length){
        C.mark(svg,'rect',{x:left,y:y+3,width:right-left,height:24,fill:hatch});
        svg.append(C.svg('text',{x:left+8,y:y+20,class:'chart-tick'},'Unavailable'));
      }
      for(const item of row.data){
        const label=row.label+' / '+item.v+'% / '+item.t.trialId.slice(0,8)+' / n='+row.total;
        const dot=C.mark(svg,'circle',{cx:x(item.v),cy:y+13+item.lane*12,r:5,tabindex:0,role:'button',class:'strip-mark'},label);
        dot.onclick=()=>onInspect(item.t.trialId);
        dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dot.onclick();}};
      }
      y+=row.height;
    }
    holder.append(svg);
  }
  function tradeoff(holder,rows){
    holder.replaceChildren();
    holder.append(el('h2','The trade-off'),el('p','Live pass share on the horizontal axis. Screen and file replay pass share on the vertical axis.'));
    const sets=root.SpoofPolicies.POLICIES.map(p=>{
      const subset=rows.filter(r=>r.policy===p.id), live=subset.find(r=>r.condition==='live');
      const replay=subset.filter(r=>['screen_replay','injected_replay'].includes(r.condition));
      return {p,live,n:replay.reduce((s,r)=>s+r.n,0),k:replay.reduce((s,r)=>s+r.pass,0)};
    });
    if(!sets.some(s=>s.live?.n&&s.n)){holder.append(C.state('Collect or import both live and replay trials to plot their pass shares.','unavailable'));return;}
    const legend=el('dl',null,'tradeoff-values');
    const chart=C.frame({title:'Live and replay pass shares',summary:'Each point represents one frozen rule. Exact counts follow the plot. Crosshairs show Wilson 95% intervals.',width:520,height:250});
    const x=p=>63+397*p,y=p=>199-159*p;
    for(const t of [0,.25,.5,.75,1]){
      C.mark(chart,'line',{x1:x(t),x2:x(t),y1:y(0),y2:y(1),class:'chart-grid'});
      C.mark(chart,'line',{x1:x(0),x2:x(1),y1:y(t),y2:y(t),class:'chart-grid'});
      chart.append(C.svg('text',{x:x(t),y:221,'text-anchor':'middle',class:'chart-tick'},t*100+'%'),C.svg('text',{x:52,y:y(t)+4,'text-anchor':'end',class:'chart-tick'},t*100+'%'));
    }
    chart.append(C.svg('text',{x:64,y:20,class:'chart-row-label'},'Replay passed'),C.svg('text',{x:460,y:244,class:'chart-row-label','text-anchor':'end'},'Live passed'));
    sets.forEach(({p,live,n,k},i)=>{
      legend.append(el('dt',(i+1)+' / '+p.name));
      if(!live?.n||!n){legend.append(el('dd','Unavailable'));return;}
      const cx=x(live.pass/live.n),cy=y(k/n),a=root.SpoofArena.wilson(live.pass,live.n),b=root.SpoofArena.wilson(k,n);
      const label=p.name+' / Live '+live.pass+' of '+live.n+' / Replay '+k+' of '+n;
      const fmt=pair=>pair.map(p=>(100*p).toFixed(1)+'%').join('–');
      C.mark(chart,'line',{x1:x(a[0]),x2:x(a[1]),y1:cy,y2:cy,class:'chart-whisker'});
      C.mark(chart,'line',{x1:cx,x2:cx,y1:y(b[0]),y2:y(b[1]),class:'chart-whisker'});
      C.mark(chart,'circle',{cx,cy,r:5,tabindex:0,class:'tradeoff-mark'},label+' / Wilson 95%: live '+fmt(a)+', replay '+fmt(b));
      chart.append(C.svg('text',{x:cx+8,y:cy-5,class:'chart-row-label'},String(i+1)));
      legend.append(el('dd','Live '+live.pass+'/'+live.n+' · replay '+k+'/'+n));
    });
    const layout=el('div',null,'tradeoff-layout');layout.append(chart,legend);holder.append(layout,el('p','Wilson 95% intervals use all attempts, including abstentions. Repeated people and recordings limit interpretation.','field-help'));
  }
  root.SpoofEvidenceUI={mount,sortLedger,histogram,markerOutcome,openInspector,drawEndings,distribution,syncFilter,tradeoff};
})(globalThis);
