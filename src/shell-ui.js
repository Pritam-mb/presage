(() => {
  'use strict';
  const paths = {
    capture:'M3 8V4h4m10 0h4v4m0 8v4h-4M7 20H3v-4 M6 12h4l2-5 2 9 2-4h2',
    trust:'M3 5h6v5H3z M15 14h6v5h-6z M9 7h5v9h1',
    arena:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
    evidence:'M4 4v16h17 M8 15v-4m5 4V6m5 9V9',
    ml:'M3 6h18M3 12h18M3 18h18 M8 3v6m8 0v6m-7 0v6',
    export:'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
    collapse:'M3 4h18v16H3z M9 4v16m7-12-3 4 3 4',
    braces:'M9 3H7v6l-3 3 3 3v6h2m6-18h2v6l3 3-3 3v6h-2',
    table:'M3 4h18v16H3z M3 10h18M9 4v16',
    report:'M6 2h9l4 4v16H6z M14 2v5h5 M9 12h7m-7 4h7',
    consent:'m4 12 5 5L20 6', camera:'M3 6h13v12H3z M16 10l5-3v10l-5-3',
    sdk:'M7 7h10v10H7z M9 2v5m6-5v5m-6 10v5m6-5v5M2 9h5m-5 6h5m10-6h5m-5 6h5',
    lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',
    circle:'M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0'
  };
  function icon(name){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');
    const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.circle);svg.append(p);return svg;
  }
  const pages={capture:'Capture',trust:'Trust Boundaries',arena:'Policy Arena',evidence:'Evidence',ml:'Model Lab',export:'Export'};
  window.SpoofShell={icon,mount(read){
    const $=id=>document.getElementById(id);
    const nav=document.querySelector('nav');
    Object.entries(pages).forEach(([view,title],i)=>{
      const button=nav.querySelector('[data-view="'+view+'"]');if(!button)return;
      const number=document.createElement('span'),label=document.createElement('span');
      number.className='nav-index';number.textContent=String(i+1).padStart(2,'0');label.className='nav-text';label.textContent=title;
      button.replaceChildren(icon(view),number,label);button.title=title;button.setAttribute('aria-label',title);
    });
    const toggle=$('rail-toggle');toggle.append(icon('collapse'));
    toggle.onclick=()=>{const compact=document.body.classList.toggle('compact-rail');toggle.setAttribute('aria-expanded',String(!compact));toggle.setAttribute('aria-label',compact?'Expand navigation':'Collapse navigation');};
    document.querySelectorAll('[data-icon]').forEach(e=>e.replaceChildren(icon(e.dataset.icon)));
    $('privacy').prepend(icon('lock'));
    const statusItems=[['consent','Consent'],['camera','Camera FPS'],['sdk','SDK'],['evidence','Local evidence']];
    const buttons=new Map(),drawer=$('status-drawer');let selected;
    for(const [key,label] of statusItems){
      const b=document.createElement('button'),title=document.createElement('span'),value=document.createElement('strong');
      b.type='button';b.className='instrument-chip';title.textContent=label;value.id='strip-'+key;
      b.append(icon(key),title,value);document.querySelector('.status-items').append(b);buttons.set(key,b);
      b.onclick=()=>{selected=key;update();drawer.showModal();};
    }
    function update(){
      const data=read();
      for(const [key,label] of statusItems){
        const b=buttons.get(key),d=data[key];
        if(b.lastElementChild.textContent!==d.value)b.lastElementChild.textContent=d.value;
        b.dataset.state=d.state;
        if(selected===key){$('drawer-title').textContent=label;$('drawer-detail').textContent=d.detail;}
      }
      $('window-section').textContent=pages[location.hash.slice(1)]||pages.capture;
      $('export-guidance').textContent=data.evidence.count?'Downloads include the trials currently in the ledger.':'Save a trial or import an evidence JSON in Evidence to enable downloads.';
    }
    update();
    const obs=new MutationObserver(update);
    for(const id of ['status','frame-status','error','page-label','total-trials','runtime-label'])obs.observe($(id),{childList:true,subtree:true,characterData:true});
    document.addEventListener('change',update);
    return update;
  }};
})();
