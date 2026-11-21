const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { startServer } = require('./preview.cjs');
const { connect } = require('./cdp.cjs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'artifacts', 'demo_frames');
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  process.env.SPOOFLAB_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const browserPath = candidates.find(p => fs.existsSync(p));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

let nextId = 0;
const pending = new Map();
let socket;

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timeout: ' + method));
    }, 20000);
    pending.set(id, {
      resolve: v => { clearTimeout(timer); resolve(v); },
      reject: e => { clearTimeout(timer); reject(e); }
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

(async () => {
  console.log('Starting preview server...');
  const server = await startServer(0);
  const port = server.address().port;

  const profile = path.join(root, '.browser-profile', 'demo-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });

  console.log('Launching browser...');
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-sandbox',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank'
  ], { windowsHide: true });

  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(activePort); i++) await delay(100);
  const debugPort = fs.readFileSync(activePort, 'utf8').split('\n')[0];

  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = await connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl, m => {
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      }
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');

  // Set 1920x1080 Full HD viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navigating to app...');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });

  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.readyState === "complete" && !!window.SpoofReports')) break;
    await delay(50);
  }

  console.log('Importing compact 33-trial dataset...');
  await evaluate(`document.querySelector('[data-view="evidence"]').click()`);
  await delay(100);

  const compactReport = path.join(root, 'artifacts', 'demo-full-report-compact.json');
  const doc = await send('DOM.getDocument');
  const fileInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#import-file' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [compactReport] });

  for (let i = 0; i < 100; i++) {
    const trialsCount = await evaluate('document.querySelector("#total-trials").textContent');
    if (trialsCount === '33') break;
    await delay(100);
  }
  console.log('Imported trials count:', await evaluate('document.querySelector("#total-trials").textContent'));

  // Helper for capturing screenshots
  async function snap(name) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const p = path.join(outDir, `${name}.png`);
    fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  }

  // 1. Evidence Overview
  await snap('scene_05_evidence_ledger');

  // 2. Select first trial to show trial inspection details
  await evaluate(`document.querySelector('#trials tr button')?.click()`);
  await delay(300);
  await snap('scene_06_evidence_detail');

  // 3. Trust Boundaries View
  await evaluate(`document.querySelector('[data-view="trust"]').click()`);
  await delay(300);
  await snap('scene_04_trust_boundaries');

  // 4. Policy Arena View
  await evaluate(`document.querySelector('[data-view="arena"]').click()`);
  await delay(200);
  await evaluate(`document.querySelector('#arena-evaluate').click()`);
  await delay(200);
  await evaluate(`document.querySelector('#arena-reveal').click()`);
  await delay(300);
  await snap('scene_08_policy_arena');

  // 5. Model Lab View
  await evaluate(`document.querySelector('[data-view="ml"]').click()`);
  await delay(200);

  // Import exploratory-fit.json in Model Lab
  const expFitPath = path.join(root, 'evidence', 'analysis', 'exploratory-fit.json');
  const doc2 = await send('DOM.getDocument');
  const mlInput = await send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: '#ml-import-file' });
  if (mlInput && mlInput.nodeId) {
    await send('DOM.setFileInputFiles', { nodeId: mlInput.nodeId, files: [expFitPath] });
    await delay(500);
  }
  await snap('scene_07_model_lab');

  // 6. Capture Lab View with simulated pulse waveform
  await evaluate(`document.querySelector('[data-view="capture"]').click()`);
  await delay(200);

  // Populate vitals display for demo capture
  await evaluate(`
    document.querySelector('#pulse').textContent = '74.2';
    document.querySelector('#breathing').textContent = '16.5';
    document.querySelector('#confidence').textContent = '94';
    document.querySelector('#source').textContent = 'IRIUN USB WEBCAM · 27.4 FPS';
    document.querySelector('#clock').textContent = '00:42 / 01:30';
    document.querySelector('#capture-label').textContent = '● LIVE TRIAL IN PROGRESS';
    document.querySelector('#validation').textContent = 'Optimal illumination · Face centered · Stable pulse tracking';
    document.querySelector('#quality-indicator').className = 'quality-dot ok';
  `);
  await snap('scene_01_capture_overview');

  // Show active freshness challenge banner
  await evaluate(`
    const banner = document.querySelector('#challenge-banner');
    banner.hidden = false;
    banner.textContent = '⚡ ACTIVE CHALLENGE: BLINK TWICE NOW [ 0 / 2 DETECTED ]';
    banner.className = 'challenge-banner active';
  `);
  await snap('scene_03_blink_challenge');

  console.log('All demo frames captured successfully!');
  server.close();
  browser.kill();
  process.exit(0);
})();
