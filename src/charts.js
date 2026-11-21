(function (root) {
  'use strict';
  const namespace = 'http://www.w3.org/2000/svg';
  let sequence = 0;

  function svg(tag, attrs = {}, text) {
    const element = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) element.setAttribute(key, String(value));
    }
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function frame({title, summary, width, height}) {
    const key = 'sl-figure-' + (++sequence);
    const chart = svg('svg', {class: 'lab-chart', viewBox: '0 0 '+width+' '+height,
      role: 'img', 'aria-labelledby': key+'-title '+key+'-description'});
    chart.append(svg('title', {id: key+'-title'}, title), svg('desc', {id: key+'-description'}, summary));
    return chart;
  }

  function hatch(chart) {
    const id = 'sl-missing-' + (++sequence);
    const defs = svg('defs'), pattern = svg('pattern', {id, width: 8, height: 8, patternUnits: 'userSpaceOnUse'});
    pattern.append(svg('path', {d:'M-2 2 2 -2 M0 8 8 0 M6 10 10 6', class:'chart-hatch'}));
    defs.append(pattern); chart.prepend(defs);
    return 'url(#'+id+')';
  }

  function mark(parent, tag, attrs, label) {
    const item = svg(tag, attrs);
    if (label) {
      item.setAttribute('aria-label', label);
      item.append(svg('title', {}, label));
    }
    parent.append(item);
    return item;
  }

  function icon(name) {
    const paths = {pass:'m4 10 4 4 8-8', fail:'m5 5 10 10m0-10L5 15',
      abstain:'M4 10h12', info:'M10 9v6m0-10v1', inspect:'M3 10s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5zm7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
      empty:'M3 5h14v10H3zm4 5h6', error:'m10 3 8 14H2zm0 4v5m0 2v1', loading:'M16 9a6 6 0 1 0-2 6'};
    const item = svg('svg', {viewBox:'0 0 20 20',width:18,height:18,fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':true});
    item.append(svg('path',{d:paths[name] || paths.info}));
    return item;
  }

  function state(message,kind='empty') {
    const element=document.createElement('div');
    element.className='chart-state chart-state-'+kind;
    element.append(icon(kind), document.createTextNode(message));
    element.setAttribute('role',kind==='error'?'alert':'status');
    return element;
  }

  root.SpoofCharts={svg,frame,hatch,mark,icon,state};
})(globalThis);
