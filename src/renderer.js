/* Browser workspace; the optional SDK adapter is loaded only inside Electron. */
(function () {
  'use strict';
  const P = window.SpoofProtocol, R = window.SpoofReports, C = window.SpoofCamera;
  const $ = id => document.getElementById(id);
  const trials = [];
  let cameraReadiness=null;
  const cameraToken=()=>$('camera-device').value+':'+$('camera-profile').value;
  const cameraReady=()=>cameraReadiness?.token===cameraToken()&&cameraReadiness.fps>=25&&Date.now()-cameraReadiness.at<30*60*1000;
  async function persist(){if(!window.SpoofStorage)return;try{await window.SpoofStorage.save(R.report(trials));$('report-status').textContent='Trials saved locally in data/trials. They will restore on restart.';}catch(error){$('report-status').textContent='LOCAL SAVE FAILED: '+error.message+' — export JSON before closing.';}}
  const isElectron = /Electron\//.test(navigator.userAgent);
  const state = { run: null, cameraCheck: null, cameraRefresh: null, selectedId: null, sdk: null, adapterPromise: null, restartRequired: false };
  const conditionHelp = {
    live: 'Sit still in even light with your face and upper torso visible.',
    printed_photo: 'Point the webcam at your printed photograph. Record size, distance and lighting in the notes.',
    screen_replay: 'Point the webcam at a consenting video on a phone or display. Screen flicker is a confound; compare the same recording digitally.',
    injected_replay: 'Select a consenting recording. Playback is real time, without seeking or looping. Camera access is not needed.'
  };
  const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const time = seconds => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
  const short = value => String(value || '').slice(0, 8);
  const elapsed = run => run.captureStart === null ? 0 : (performance.now() - run.captureStart) / 1000;
  const sampleArrays = ['samples', 'breathingSamples', 'traceSamples', 'cardiacTraceSamples', 'faceSamples'];
  function node(tag, text, className) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
  function showView(name) {
    if (!['capture', 'trust', 'arena', 'evidence', 'ml', 'export'].includes(name)) name = 'capture';
    document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== `view-${name}`; });
    document.querySelectorAll('[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === name); el.setAttribute('aria-current', el.dataset.view === name ? 'page' : 'false'); });
    $('page-label').textContent = { capture: 'CAPTURE LABORATORY', trust: 'TRUST BOUNDARIES', arena: 'POLICY ARENA', evidence: 'EVIDENCE REPORT', ml: 'MODEL LAB', export: 'EXPORT' }[name];
    if (name === 'ml') window.SpoofML?.refresh?.();
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  }
  function busy(value) {
    for (const id of ['key','condition','duration','file','notes','camera-profile','confidence-threshold','sustain','min-bpm','max-bpm','challenge-enabled','consent','clear','import-file','forget-key']) $(id).disabled = value;
    $('start').disabled = value || !isElectron || state.restartRequired || ($('condition').value!=='injected_replay'&&!cameraReady());
    if(isElectron)$('start').title=$('condition').value!=='injected_replay'&&!cameraReady()?'Confirm consent and run Check camera FPS first. Require at least 25 delivered FPS.':'';
    $('recording-consent').disabled=value;
    $('scenario').disabled=value;$('camera-pipeline').disabled=value;
    $('check-camera').disabled = value || !isElectron;
    $('camera-device').disabled = value || !isElectron;
    $('refresh-cameras').disabled = value || !isElectron;
    $('stop').disabled = !value;
    document.querySelectorAll('.report-actions button:not([data-view]), #export-json, #export-csv, #export-html').forEach(el => { el.disabled = value || !trials.length; });
    document.querySelector('label[for="import-file"]').setAttribute('aria-disabled', String(value));
    updateCapture();
  }
  let updateShell = () => {};
  function shellStatus() {
    const consent = $('consent').checked && ($('condition').value === 'live' || $('recording-consent').checked);
    const fps = cameraReady() ? cameraReadiness.fps : null;
    return {
      busy: Boolean(state.run || state.cameraCheck || state.cameraRefresh || !$('stop').disabled),
      preview: !isElectron,
      consent: { value: consent ? 'Recorded' : 'Pending', state: consent ? 'signal' : 'attention',
        detail: consent ? 'Consent recorded for the selected input. The app saves trial metrics locally and never records video.' : 'Confirm the consent checkbox. A recording input also needs permission to use that source.' },
      camera: { value: fps === null ? 'Unavailable' : fmt(fps, 1) + ' FPS', state: fps !== null && fps >= 25 ? 'signal' : 'attention',
        detail: fps === null ? 'Run the six-second camera check. Camera trials require at least 25 delivered FPS.' : `Last diagnostic: ${fmt(fps, 1)} delivered FPS, measured ${new Date(cameraReadiness.at).toLocaleTimeString()}.` },
      sdk: { value: state.sdk ? 'Bridge ready' : (isElectron ? 'Standby' : 'Preview'), state: state.sdk ? 'signal' : (isElectron ? 'attention' : 'neutral'),
        detail: state.sdk ? 'SmartSpectra bridge loaded through the local IPC adapter. No renderer network access is used.' : (isElectron ? 'The SDK bridge starts when needed.' : 'Browser preview: live SDK capture runs in the Electron desktop app.') },
      evidence: { value: String(trials.length), count: trials.length, state: trials.length ? 'signal' : 'neutral',
        detail: trials.length ? `${trials.length} attempts in the local ledger. Counts describe trials, not independent people.` : 'No local trials yet. Capture a trial or import a JSON evidence report.' }
    };
  }
  function updateCapture() {
    window.SpoofCaptureUI?.update({ run: state.run, cameraCheck: state.cameraCheck, cameraRefresh: state.cameraRefresh,
      restartRequired: state.restartRequired, isElectron, ready: !!state.run?.ready,
      fps: cameraReadiness?.fps, elapsed: state.run ? elapsed(state.run) : 0 });
    updateShell();
  }
  // Instrument charts are SVG, bound to the current trial samples by capture-ui.js.
  function draw(samples = [], duration = 60, trial = null) {
    window.SpoofCaptureUI?.chart(samples, duration, trial);
  }

  function policyFromUI() {
    return P.validatePolicy({ ...P.PROTOCOL, durationSec: Number($('duration').value), minConfidence: Number($('confidence-threshold').value),
      sustainedSec: Number($('sustain').value), minBpm: Number($('min-bpm').value), maxBpm: Number($('max-bpm').value), challengeEnabled: $('challenge-enabled').checked });
  }
  async function loadAdapter() {
    if (!isElectron) throw new Error('Live capture requires the Electron app. Run npm install, then npm start.');
    if (window.SpoofSDK) { state.sdk = window.SpoofSDK; updateCapture(); return state.sdk; }
    if (!state.adapterPromise) state.adapterPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = '../dist/sdk.js';
      script.onload = () => window.SpoofSDK ? resolve(window.SpoofSDK) : reject(new Error('SDK adapter did not initialize. Run npm run build.'));
      script.onerror = () => reject(new Error('SDK adapter not built. Run npm install and npm run build.'));
      document.head.append(script);
    }).catch(error => { state.adapterPromise = null; throw error; });
    state.sdk = await state.adapterPromise; updateCapture(); return state.sdk;
  }
  function guard(run) { if (run.cancelled || state.run !== run) throw new Error('Trial cancelled during setup.'); }
  function bounded(promise, milliseconds, message) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]).finally(() => clearTimeout(timer));
  }
  async function openVideo(run, file) {
    run.url = URL.createObjectURL(file); const video = $('preview'); video.srcObject = null; video.src = run.url;
    await bounded(new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Unable to decode this video. Try an MP4 or WebM supported by Chromium.'));
    }), 10000, 'Timed out reading the replay video.');
    guard(run);
    if (!Number.isFinite(video.duration) || video.duration < run.trial.protocol.durationSec + 5) throw new Error('Replay must be at least the trial duration plus 5 seconds.');
    run.trial.source.video = { durationSec: video.duration, width: video.videoWidth, height: video.videoHeight };
    await bounded(video.play(), 10000, 'Replay playback did not start.'); guard(run);
    run.stream = video.captureStream();
    if (!run.stream.getVideoTracks().length) throw new Error('The selected recording has no usable video track.');
    // Do not send audio to the SDK and stop any captured audio track.
    run.stream.getAudioTracks().forEach(track => { track.stop(); run.stream.removeTrack(track); });
    run.sdk.useMediaStream(run.stream);
    video.onended = () => { if (state.run === run) void finish(run, 'replay_ended'); };
  }
  function resetPreview() {
    const video = $('preview'); video.onended = null; video.onloadedmetadata = null; video.onerror = null;
    video.pause(); video.srcObject = null; video.removeAttribute('src'); video.load();
    $('placeholder').hidden = false; $('capture-label').textContent = 'AWAITING INPUT';
  }
  async function openCamera(run) {
    const width = Number($('camera-profile').value), height = width === 640 ? 480 : 720;
    run.trial.source.requestedCamera = { width, height, frameRate: 30 };
    // Smaller frames reduce copying and IPC work; do not invent timestamps or duplicate frames.
    const stream = await C.acquire(navigator.mediaDevices,C.constraints(width,$('camera-device').value,true),{isCancelled:()=>run.cancelled||state.run!==run});
    run.stream = stream; guard(run);
    $('preview').srcObject = stream; await $('preview').play(); guard(run);
    const track = stream.getVideoTracks()[0], settings = track?.getSettings() || {};
    run.trial.source.camera = C.metadata(track);
    $('frame-status').textContent = `Camera negotiated ${settings.width || '?'} × ${settings.height || '?'} at ${fmt(settings.frameRate)} FPS. Waiting for delivered-frame evidence…`;
    if (Number.isFinite(settings.frameRate) && settings.frameRate < 25) throw new Error(`Camera negotiated only ${fmt(settings.frameRate)} FPS. SmartSpectra requires at least 25 FPS. Run Check camera FPS before another SDK trial.`);
    run.sdk.useMediaStream(stream); $('placeholder').hidden = true;
  }
  async function checkCamera() {
    if (state.run || state.cameraCheck || state.cameraRefresh) return;
    if (!$('consent').checked) { $('error').textContent='Confirm consent before checking the camera.'; return; }
    const check={cancelled:false,stream:null}; state.cameraCheck=check;busy(true);$('error').textContent='';
    $('status').textContent='Checking camera only. SmartSpectra is not running.';
    try {
      const width=Number($('camera-profile').value);
      check.stream=await C.acquire(navigator.mediaDevices,C.constraints(width,$('camera-device').value,false),{isCancelled:()=>check.cancelled});
      if(check.cancelled)throw new Error('Camera check cancelled.');
      const video=$('preview'),track=check.stream.getVideoTracks()[0],settings=track.getSettings();
      video.srcObject=check.stream;await bounded(video.play(),10000,'Camera preview did not start.');
      if(check.cancelled)throw new Error('Camera check cancelled.');
      $('placeholder').hidden=true;
      let count=0,firstMedia=null,lastMedia=null,firstWall=null,lastWall=null,callbackId;
      const start=Date.now();
      const onFrame=(now,metadata)=>{
        count++;if(firstMedia===null){firstMedia=metadata.mediaTime;firstWall=now;}lastMedia=metadata.mediaTime;lastWall=now;
        callbackId=video.requestVideoFrameCallback(onFrame);
      };
      callbackId=video.requestVideoFrameCallback(onFrame);
      try {
        await new Promise(resolve=>{const timer=setInterval(()=>{
          $('frame-status').textContent=`Camera-only check: ${count} presented frames in ${fmt((Date.now()-start)/1000)} seconds…`;
          if(Date.now()-start>=6000||check.cancelled){clearInterval(timer);resolve();}
        },200);});
      } finally {video.cancelVideoFrameCallback(callbackId);}
      if(check.cancelled)throw new Error('Camera check cancelled.');
      const wallFps=count>1&&lastWall>firstWall?(count-1)*1000/(lastWall-firstWall):0;
      const mediaFps=count>1&&lastMedia>firstMedia?(count-1)/(lastMedia-firstMedia):0;
      const diagnostic={delivered_fps:wallFps,media_timestamp_fps:mediaFps,frame_count:count,duration_s:(Date.now()-start)/1000,width:settings.width||video.videoWidth,height:settings.height||video.videoHeight};
      cameraReadiness={token:cameraToken(),fps:wallFps,at:Date.now()};
      if(window.SpoofStorage?.saveCameraCheck){try{await window.SpoofStorage.saveCameraCheck(diagnostic);}catch(error){$('error').textContent='Camera check completed, but saving failed: '+error.message;}}
      $('frame-status').textContent=`Camera-only result: ${settings.width} × ${settings.height} · negotiated ${fmt(settings.frameRate)} FPS · presented ${fmt(wallFps)} FPS · media timestamps ${fmt(mediaFps)} FPS · ${count} frames / 6 s.`;
      $('status').textContent=wallFps<25?'Camera-only delivery is below 25 FPS. The SDK cannot measure reliably with this input.':'Camera-only preview reaches 25 FPS. Compare this with SDK acknowledgements during a trial to isolate pipeline slowdown.';
    }catch(error){$('error').textContent=error.name==='OverconstrainedError'?'The camera cannot provide the requested mode.':error.message;}
    finally{check.cancelled=true;check.stream?.getTracks().forEach(t=>t.stop());resetPreview();state.cameraCheck=null;busy(false);}
  }
  async function refreshCameras(){
    if(state.run||state.cameraCheck||state.cameraRefresh)return;
    if(!$('consent').checked){$('error').textContent='Confirm consent before refreshing cameras. Discovery briefly opens the default camera to obtain device labels.';return;}
    const refresh={cancelled:false,stream:null};state.cameraRefresh=refresh;busy(true);$('error').textContent='';
    $('camera-selection-status').textContent='Requesting camera permission and discovering connected cameras…';
    try{
      refresh.stream=await C.acquire(navigator.mediaDevices,{audio:false,video:true},{isCancelled:()=>refresh.cancelled});
      const devices=await bounded(navigator.mediaDevices.enumerateDevices(),10000,'Camera discovery timed out.');
      if(refresh.cancelled)throw new Error('Camera discovery cancelled.');
      const select=$('camera-device'),previous=select.value,previousLabel=select.selectedOptions[0]?.textContent||'Previously selected camera';
      select.replaceChildren(new Option('System default camera',''));
      const cameras=devices.filter(device=>device.kind==='videoinput'&&device.deviceId);
      cameras.forEach((device,i)=>select.append(new Option(device.label||`Camera ${i+1}`,device.deviceId)));
      if(previous&&!cameras.some(device=>device.deviceId===previous))select.append(new Option(`${previousLabel.replace(/ \(disconnected\)$/,'')} (disconnected)`,previous));
      select.value=previous;
      $('camera-selection-status').textContent=previous&&!cameras.some(device=>device.deviceId===previous)?'The selected camera disconnected. Choose an available camera; capture will not silently fall back.':`${cameras.length} camera(s) discovered. Select your phone or USB camera, then run Check camera FPS.`;
    }catch(error){$('camera-selection-status').textContent=error.message;}
    finally{refresh.cancelled=true;C.stop(refresh.stream);state.cameraRefresh=null;busy(false);}
  }
  function eventTime(run, timestamp, receiptSec) {
    const ts = P.numberTs(timestamp);
    if (ts === null) return receiptSec;
    if (run.timestampOffset === null) run.timestampOffset = ts / 1e6 - receiptSec;
    return Math.max(0, ts / 1e6 - run.timestampOffset);
  }
  function handleMetrics(run, buffer) {
    if (run.cancelled || run.finalizing || run.captureStart === null) return;
    try {
      const data = state.sdk.decodeMetrics(buffer), receiptSec = elapsed(run);
      const pulse = data.cardio?.pulseRate || [], breathing = data.breathing?.rate || [], trace = data.breathing?.upperTrace || [];
      const all = [...pulse, ...breathing, ...trace];
      // Anchor the latest SDK timestamp in the first packet to its arrival time. Preserve original timestamps for audit.
      if (run.timestampOffset === null) {
        const timestamps = all.map(m => P.numberTs(m.timestamp)).filter(Number.isFinite);
        if (timestamps.length) run.timestampOffset = Math.max(...timestamps) / 1e6 - receiptSec;
      }
      function append(items, key) {
        for (const item of items) {
          if (!Number.isFinite(item.value)) continue;
          const timestamp = String(item.timestamp ?? '');
          if (run.seen[key].has(timestamp)) continue;
          run.seen[key].add(timestamp);
          if (run.trial[key].length >= 40000) throw new Error('Per-trial sample limit reached.');
          run.trial[key].push({ value: item.value, confidence: Number.isFinite(item.confidence) ? item.confidence : null,
            stable: typeof item.stable === 'boolean' ? item.stable : null, timestamp,
            elapsedSec: eventTime(run, item.timestamp, receiptSec), receivedAtSec: receiptSec });
        }
      }
      append(pulse, 'samples'); append(breathing, 'breathingSamples'); append(trace, 'traceSamples');
      append(data.cardio?.arterialPressureTrace || [], 'cardiacTraceSamples');
      for (const detection of data.face?.blinking || []) {
        const timestamp = String(detection.timestamp ?? '');
        if (run.seen.faceSamples.has(timestamp)) continue;
        run.seen.faceSamples.add(timestamp);
        const sample = { timestamp, detected: detection.detected === true, stable: detection.stable === true, elapsedSec: eventTime(run, detection.timestamp, receiptSec) };
        run.trial.faceSamples.push(sample); P.updateChallenge(run.trial.challenge, sample);
        $('blink-status').textContent = `Face signal: ${sample.stable ? 'stable' : 'not stable'} · ${sample.detected ? 'blink detected' : 'eyes open / no blink'} · ${run.trial.challenge?.state === 'active' ? `prompt count ${run.trial.challenge.blinks.length}` : 'outside the challenge window'}`;
      }
      const current = run.trial.samples.at(-1), br = run.trial.breathingSamples.at(-1);
      if (current) { $('pulse').textContent = fmt(current.value,0); $('confidence').textContent = fmt(current.confidence,0); }
      if (br) $('breathing').textContent = fmt(br.value,0);
      if (performance.now() - run.lastDraw > 150) { draw(run.trial.samples, run.trial.protocol.durationSec, run.trial); run.lastDraw = performance.now(); }
      if (!run.lastTrustUpdate || performance.now()-run.lastTrustUpdate>1000) { updateTrust(run.trial, true); run.lastTrustUpdate=performance.now(); }
    } catch (error) { recordError(run, error, 'decode'); }
  }
  function recordError(run, error, phase) {
    const message = String(error.message || error).replaceAll(run.key || '\u0000', '[redacted]');
    run.trial.errors.push({ message, phase, code: error.code ?? null, elapsedSec: elapsed(run) });
    $('error').textContent = message;
  }
  function challengeTick(run, sec) {
    const p = run.trial.protocol;
    if (!p.challengeEnabled) return;
    if (!run.trial.challenge && sec >= p.challengeAtSec) {
      const random = new Uint32Array(1); crypto.getRandomValues(random);
      // Rejection sampling avoids modulo bias for three possible prompts.
      while (random[0] === 0xffffffff) crypto.getRandomValues(random);
      run.trial.challenge = P.createChallenge(1 + random[0] % 3, sec, p.challengeWindowSec);
      run.trial.challengeEvents.push({ event: 'issued', elapsedSec: sec, target: run.trial.challenge.target });
    }
    const c = run.trial.challenge;
    if (!c) return;
    if (sec >= c.deadlineSec && c.state === 'active') {
      P.closeChallenge(c); run.trial.challengeEvents.push({ event: 'closed', elapsedSec: sec, state: c.state });
    }
    $('challenge-banner').hidden = false;
    $('challenge-banner').textContent = c.state === 'active' ? `Fresh prompt: blink ${c.target} ${c.target === 1 ? 'time' : 'times'} in ${Math.max(0, Math.ceil(c.deadlineSec-sec))} s. Detected: ${c.blinks.length}. Then keep your eyes open.` : `Freshness check: ${c.state}. ${c.blinks.length} blink transitions observed.`;
    window.SpoofCaptureUI?.blink(c);
  }
  async function start() {
    if (state.run || state.cameraCheck || state.cameraRefresh) return;
    if (state.restartRequired) { $('error').textContent = 'Restart the app before another capture; SDK cleanup did not settle.'; return; }
    $('error').textContent = '';
    let protocol;
    try { protocol = policyFromUI(); } catch (error) { $('error').textContent = error.message; return; }
    if (!$('key').value.trim() || !$('consent').checked) { $('error').textContent = 'Enter a Presage API key and confirm consent before processing.'; return; }
    const condition = $('condition').value, file = $('file').files[0];
    if(condition!=='injected_replay'&&!cameraReady()){$('error').textContent='Run the six-second camera check for this camera/mode first. Delivered FPS must reach 25. Checks expire after 30 minutes or a camera/mode change.';return;}
    if(condition!=='live'&&!$('recording-consent').checked){$('error').textContent='Confirm permission to use the selected photo or recording before processing.';return;}
    if (condition === 'injected_replay' && (!file || file.size > 500_000_000)) { $('error').textContent = 'Choose a consenting video file no larger than 500 MB.'; return; }
    if (trials.length >= 300) { $('error').textContent = 'Export and clear the ledger before collecting more than 300 trials.'; return; }
    const run = { key: $('key').value.trim(), sdk: null, stream: null, url: null, cancelled: false, finalizing: false,
      captureStart: null, timestampOffset: null, lastDraw: 0, seen: Object.fromEntries(sampleArrays.map(k => [k,new Set()])),
      trial: { trialId: crypto.randomUUID(), condition, protocol, scenario:$('scenario').value.trim()||null,camera:{pipeline:$('camera-pipeline').value},startedAt: new Date().toISOString(), durationSec: 0,
        endReason: 'starting', notes: $('notes').value, consent: { attested: true, recordingOwnerAttested:condition==='live'?null:$('recording-consent').checked, at: new Date().toISOString(), textVersion: 'consent-v3' },
        sdkVersion: 'unknown', source: { kind: condition === 'injected_replay' ? 'recording_stream' : 'webcam', fileName: condition === 'injected_replay' ? file.name : null },
        samples: [], breathingSamples: [], traceSamples: [], cardiacTraceSamples: [], faceSamples: [], validationEvents: [], processingEvents: [], errors: [], challenge: null, challengeEvents: [],
        timing: 'SDK timestamps aligned to latest sample in first packet arrival; original timestamps preserved. Wall-clock duration starts before SDK start.' } };
    state.run = run; busy(true); draw([], protocol.durationSec, run.trial);
    for (const id of ['pulse','breathing','confidence']) $(id).textContent = '—';
    $('validation').textContent = 'Preparing input…'; $('quality-indicator').className = 'quality-dot';
    $('challenge-banner').hidden = true; $('clock').textContent = `${time(0)} / ${time(protocol.durationSec)}`;
    $('blink-status').textContent = protocol.challengeEnabled ? 'Face metrics requested. The blink prompt starts at 25 seconds; wait for that prompt.' : 'Blink check is off. Enable the optional freshness check before Start to request face metrics.';
    $('status').textContent = 'Loading SDK adapter…'; $('source').textContent = P.CONDITIONS[condition].toUpperCase();
    run.setup = (async () => {
      const S = await loadAdapter(); guard(run);
      run.sdk = new S.SmartSpectraSDK({ apiKey: run.key, requestedMetrics: [...S.breathingMetrics, ...S.cardioMetrics, ...(protocol.challengeEnabled ? S.faceMetrics : [])],
        enableTelemetry: false, enableAccumulatedOutput: false, sendTimeoutMs: 15000 });
      run.trial.sdkVersion = String(S.SmartSpectraSDK.version || 'unknown');
      const validationNames = Object.fromEntries(Object.entries(S.ValidationCode).map(([name,code]) => [code,name]));
      const processingNames = Object.fromEntries(Object.entries(S.ProcessingStatus).map(([name,code]) => [code,name]));
      run.sdk.on('streamAvailable', stream => {
        if (run.cancelled || state.run !== run) { stream.getTracks().forEach(t => t.stop()); return; }
        run.stream = stream; $('preview').srcObject = stream; $('preview').play().catch(error => recordError(run,error,'preview'));
        const track = stream.getVideoTracks()[0], settings = track?.getSettings() || {};
        run.trial.source.camera = { label: track?.label || 'Default camera', width: settings.width ?? null, height: settings.height ?? null, frameRate: settings.frameRate ?? null };
        $('placeholder').hidden = true;
      });
      run.sdk.on('processingStatus', code => {
        if (run.finalizing) return;
        run.trial.processingEvents.push({ code, name: processingNames[code] || String(code), elapsedSec: elapsed(run) });
      });
      run.sdk.on('validationStatus', (code,timestamp,hint) => {
        if (run.cancelled || run.finalizing) return;
        const event = { code, name: validationNames[code] || String(code), timestamp: String(timestamp), hint: String(hint || '').replaceAll(run.key,'[redacted]'), elapsedSec: elapsed(run) };
        run.trial.validationEvents.push(event);
        run.lastValidationCode=code;
        $('validation').textContent = `${event.name.replace(/^k/,'')}${event.hint ? ' · '+event.hint : ''}`;
        $('quality-indicator').className = `quality-dot ${code === S.ValidationCode.kOk ? 'ok' : 'warn'}`;
      });
      run.sdk.on('metrics', buffer => handleMetrics(run,buffer));
      run.frameWindow = []; run.trial.frameDiagnostics = [];
      run.trial.validationFrames={known:0,warning:0};
      run.sdk.on('frameSentThrough', (sent,timestamp) => {
        if (run.cancelled || run.finalizing || !sent) return;
        if(run.lastValidationCode!==undefined){run.trial.validationFrames.known++;if(run.lastValidationCode!==0)run.trial.validationFrames.warning++;}
        const sec = elapsed(run), now = performance.now();
        run.frameWindow.push({now,timestamp:P.numberTs(timestamp)});
        while(run.frameWindow.length && now-run.frameWindow[0].now>3000)run.frameWindow.shift();
        if(run.frameWindow.length>1 && (!run.lastFrameReport || now-run.lastFrameReport>=1000)) {
          const first=run.frameWindow[0],last=run.frameWindow.at(-1);
          const receivedFps=(run.frameWindow.length-1)*1000/(last.now-first.now);
          const sourceFps=last.timestamp>first.timestamp ? (run.frameWindow.length-1)*1e6/(last.timestamp-first.timestamp) : null;
          run.trial.frameDiagnostics.push({elapsedSec:sec,receivedFps,sourceFps});run.lastFrameReport=now;
          $('frame-status').textContent=`SDK frame acknowledgements: ${fmt(receivedFps)} / s · source timestamps: ${fmt(sourceFps)} FPS. Keep the app visible; avoid other camera apps.`;
        }
      });
      run.sdk.on('error', (code,message,retryable) => {
        if (run.finalizing || state.run !== run) return;
        recordError(run,{ code,message },'sdk');
        run.trial.errors.at(-1).retryable = retryable;
        if (code === 14) {
          $('error').textContent = 'Capture stopped: sustained low frame rate. This is not a failed blink check. Use Performance camera capture, improve lighting, close other camera apps and start a fresh trial.';
          $('blink-status').textContent = 'Blink check unavailable: the SDK stopped because of low frame rate.';
        }
        // A retryable stopped session requires a fresh, user-initiated trial, not waiting on a dead pipeline.
        if (!retryable || code === 14) { run.cancelled = true; if (run.ready) void finish(run,code === 14 ? 'low_frame_rate' : 'sdk_error'); }
      });
      if (condition === 'injected_replay') {
        $('status').textContent = 'Fingerprinting replay source…';
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); guard(run);
        run.trial.source.sha256 = Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
        run.trial.source.byteLength = file.size;
        await openVideo(run,file); guard(run); $('placeholder').hidden = true;
      } else { await openCamera(run); guard(run); }
      $('status').textContent = 'Starting SmartSpectra. Camera permission may be requested…';
      run.captureStart = performance.now();
      await bounded(run.sdk.start(), 20000, 'SDK startup timed out. Check the key, cardio access and camera permissions.'); guard(run);
      run.ready = true;
      $('capture-label').textContent = '● COLLECTING'; $('status').textContent = 'Collecting real SDK evidence · settings frozen for this trial';
      run.timer = setInterval(() => {
        const sec = elapsed(run); $('clock').textContent = `${time(Math.min(sec,protocol.durationSec))} / ${time(protocol.durationSec)}`;
        challengeTick(run,sec);
        if (sec >= protocol.durationSec) void finish(run,'completed');
      },200);
    })();
    try { await run.setup; }
    catch (error) {
      if (!run.cancelled) recordError(run,error.name === 'OverconstrainedError' ? {message:'Camera driver cannot supply the requested 25–30 FPS mode. Run Check camera FPS to measure its available output; try another camera or driver setting.',code:'CAMERA_MODE_UNAVAILABLE'} : error,'startup');
      await finish(run,run.cancelled ? 'cancelled' : 'startup_error');
    }
  }
  async function stop() {
    if (state.cameraRefresh) {state.cameraRefresh.cancelled=true;C.stop(state.cameraRefresh.stream);$('stop').disabled=true;return;}
    if (state.cameraCheck) {state.cameraCheck.cancelled=true;state.cameraCheck.stream?.getTracks().forEach(t=>t.stop());$('stop').disabled=true;return;}
    const run = state.run; if (!run || run.finalizing) return;
    if (!run.ready) {
      run.cancelled = true; run.stream?.getTracks().forEach(t=>t.stop());
      $('stop').disabled = true; $('status').textContent = 'Cancelling setup; waiting for SDK lifecycle to settle…';
      // The startup promise is bounded. Its guard routes cancellation through finish().
      return;
    }
    await finish(run,'manual');
  }
  async function finish(run,reason) {
    if (run.finalizing || state.run !== run) return;
    run.finalizing = true; run.cancelled = true; clearInterval(run.timer);
    run.trial.durationSec = Math.min(elapsed(run), run.trial.protocol.durationSec); run.trial.endReason = reason;
    $('stop').disabled = true; $('status').textContent = 'Releasing capture resources…';
    run.stream?.getTracks().forEach(t=>t.stop());
    try { if (run.sdk) await bounded(run.sdk.stop(),18000,'SDK stop timed out. Restart the app before another capture.'); }
    catch (error) { recordError(run,error,'stop'); state.restartRequired = true; }
    try { run.sdk?.destroy(); } catch (error) { recordError(run,error,'destroy'); state.restartRequired = true; }
    if (run.trial.challenge?.state === 'active') {
      run.trial.challenge.state = 'unavailable'; run.trial.challengeEvents.push({ event:'interrupted', elapsedSec:run.trial.durationSec });
    }
    resetPreview(); if (run.url) URL.revokeObjectURL(run.url);
    run.key = ''; run.trial.endedAt = new Date().toISOString();
    run.trial.summary = P.summarize(run.trial); trials.push(run.trial); state.selectedId = run.trial.trialId; state.run = null;
    busy(false); renderEvidence(); draw(run.trial.samples,run.trial.protocol.durationSec,run.trial); window.SpoofCaptureUI?.complete(run.trial); updateTrust(run.trial);
    $('status').textContent = `Evidence retained in memory · ${run.trial.summary.outcome.replaceAll('_',' ')} · policy ${run.trial.summary.verifier.outcome}`;
    $('capture-label').textContent = 'TRIAL ENDED';
    await persist();
    window.dispatchEvent(new CustomEvent('spooflab:trial-saved',{detail:run.trial}));
  }
  function updateTrust(trial, provisional = false) {
    const s = P.summarize({ ...trial, durationSec: provisional ? elapsed(state.run) : trial.durationSec });
    $('trust-signal').textContent = s.pulseSamplesAfterWarmup ? `${s.pulseSamplesAfterWarmup} post-warm-up estimates` : 'No post-warm-up pulse evidence';
    const p = trial.protocol;
    $('trust-policy').textContent = `${p.minBpm}–${p.maxBpm} BPM · confidence ≥ ${p.minConfidence}% · ${p.sustainedSec} s`;
    $('trust-verdict').textContent = provisional ? 'Pending completed trial' : s.verifier.outcome;
    $('trust-reason').textContent = provisional ? 'The verifier waits for the full trial and logs any technical failure.' : s.verifier.reason;
    $('trust-trial-id').textContent = `${short(trial.trialId)}${trial.imported ? ' / IMPORTED · NO SOURCE GUARANTEE' : ''}`;
    $('trust-detail').replaceChildren(node('p',`Signal availability: ${s.outcome}. Longest eligible interval: ${fmt(s.verifier.sustainedSec)} s. Technical errors: ${trial.errors.length}.`),node('pre',JSON.stringify(p,null,2)));
    window.SpoofCaptureUI?.verdict(provisional ? 'pending' : s.verifier.outcome, provisional);
  }
  function renderEvidence() {
    window.SpoofEvidenceUI?.mount();
    const sums = trials.map(t=>P.summarize(t));
    window.SpoofEvidenceUI?.distribution(trials,sums,selectTrial);
    const endings=new Map();
    for(const t of trials)if(t.endReason&&t.endReason!=='completed'){
      const label=String(t.endReason).replaceAll('_',' ');
      endings.set(label,(endings.get(label)||0)+1);
    }
    window.SpoofEvidenceUI?.drawEndings(endings);
    $('total-trials').textContent = trials.length;
    const completedCount=trials.filter(t=>t.endReason==='completed'&&t.durationSec>=t.protocol.durationSec-.25).length;
    $('total-completed').textContent=completedCount;
    $('total-incomplete').textContent=trials.length-completedCount;
    const frozen=$('frozen-policy-summary');frozen.replaceChildren();
    if(!trials.length)frozen.append(node('p','No saved observations to evaluate.'));
    else if(window.SpoofPolicies){
      const table=node('table'),thead=node('thead'),body=node('tbody'),head=node('tr');for(const label of ['Condition','Frozen policy','Pass','Fail','Abstain','n'])head.append(node('th',label));thead.append(head);table.append(thead,body);
      const byCondition=new Map();
      for(const trial of trials){
        const measurements=window.SpoofPolicies.fromTrialMeasurements(trial);
        for(const policy of window.SpoofPolicies.POLICIES){
          const decision=window.SpoofPolicies.evaluate(policy.id,measurements).decision;
          const key=trial.condition+'|'+policy.id;
          if(!byCondition.has(key))byCondition.set(key,{condition:trial.condition,policy:policy.id,pass:0,fail:0,abstain:0,n:0});
          const row=byCondition.get(key);row[decision]++;row.n++;
        }
      }
      for(const result of byCondition.values()){const row=node('tr');for(const value of [P.CONDITIONS[result.condition],result.policy,result.pass,result.fail,result.abstain,result.n])row.append(node('td',value));body.append(row);}
      frozen.append(table,node('p',window.SpoofPolicies.LIMITATION,'field-help'));
    }

    for (const kind of ['accepted','rejected','inconclusive']) $(`total-${kind}`).textContent = sums.filter(s=>s.verifier.outcome===kind).length;
    $('empty').hidden = !!trials.length; $('trials').replaceChildren();
    const filter = $('filter').value;
    for (const t of trials.filter(t=>filter==='all'||t.condition===filter).toReversed()) {
      const s = P.summarize(t), row = node('tr'), first = node('td',P.CONDITIONS[t.condition]);
      first.append(node('small',`${short(t.trialId)} · ${t.imported ? 'IMPORTED' : 'CAPTURED'} · ${t.protocol.challengeEnabled ? 'PULSE + BLINK' : 'PULSE ONLY'}`));
      row.append(first,node('td',`${fmt(t.durationSec)} s`),node('td',s.outcome.replaceAll('_',' ')));
      const verdict=node('td'); verdict.append(window.SpoofEvidenceUI?.markerOutcome(s.verifier.outcome) || node('span',s.verifier.outcome,`badge ${s.verifier.outcome}`)); row.append(verdict);
      const action=node('td'), button=node('button','Inspect ↗'); button.addEventListener('click',()=>selectTrial(t.trialId)); action.append(button); row.append(action); $('trials').append(row);
    }
    const groups = R.aggregates(trials); $('comparison').replaceChildren(); $('comparison').classList.toggle('empty-state',!groups.length);
    if (!groups.length) $('comparison').textContent='No evidence collected. Start with a live baseline.';
    for (const g of groups) {
      const row=node('div',null,'group-row'), label=node('div',P.CONDITIONS[g.condition],'group-label');
      label.append(node('small',`${g.protocol.challengeEnabled?'PULSE + BLINK':'PULSE ONLY'} · SDK ${g.sdkVersion}`));
      label.append(node('small',`≥${g.protocol.minConfidence}% · ${g.protocol.sustainedSec}s · ${g.protocol.durationSec}s trial · ${g.protocol.minBpm}–${g.protocol.maxBpm} BPM`));
      const body=node('div',null,'group-bars'); body.append(node('div',`${g.accepted} accepted / ${g.rejected} rejected / ${g.inconclusive} inconclusive · n=${g.count}`,'group-counts'));
      const bars=node('div',null,'mini-bars');
      for(const type of ['accepted','rejected','inconclusive']) if(g[type]) { const bar=node('span',null,type); bar.style.flexGrow=g[type]; bar.title=`${type}: ${g[type]}`; bars.append(bar); }
      body.append(bars); row.append(label,body); $('comparison').append(row);
    }
    busy(!!(state.run||state.cameraCheck||state.cameraRefresh));
    if (state.selectedId) selectTrial(state.selectedId,false);
    window.SpoofML?.refresh?.();
    window.SpoofArena?.refresh?.();
  }
  function selectTrial(id,scroll=true) {
    const trial=trials.find(t=>t.trialId===id); if(!trial)return; state.selectedId=id;
    const s=P.summarize(trial); $('detail-panel').hidden=false; $('detail-id').textContent=trial.trialId;
    const content=$('detail-content'); content.replaceChildren();
    content.append(node('p',s.verifier.reason),node('p',`${P.CONDITIONS[trial.condition]} · ${fmt(trial.durationSec)} seconds · mean pulse ${fmt(s.meanPulse)} BPM · stable samples ${s.stableFraction===null?'—':fmt(s.stableFraction*100,0)+'%'} · SDK ${trial.sdkVersion}`));
    const grid=node('div',null,'detail-grid'), left=node('div'),right=node('div');
    left.append(node('h3','Confidence distribution (SDK samples, not independent trials)'));
    left.append(window.SpoofEvidenceUI?.histogram(s.confidenceBins) || node('p','No confidence samples were available during this trial.'));
    left.append(node('h3','Frozen policy'),node('pre',JSON.stringify(trial.protocol,null,2)));
    right.append(node('h3','Validation event counts'));
    const counts={}; for(const e of trial.validationEvents)counts[e.name||e.code]=(counts[e.name||e.code]||0)+1;
    right.append(node('pre',JSON.stringify(counts,null,2)),node('h3','Source, consent and challenge'),node('pre',JSON.stringify({source:trial.source,consent:trial.consent,challenge:trial.challenge},null,2)));
    grid.append(left,right);content.append(grid,node('h3','Errors'),node('pre',JSON.stringify(trial.errors,null,2)),node('div',trial.notes||'No experiment notes.','detail-notes'));
    updateTrust(trial);
    if(scroll && window.SpoofEvidenceUI?.openInspector)window.SpoofEvidenceUI.openInspector();
    else if(scroll)$('detail-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function download(content,type,extension) {
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=`spooflab-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importFile(file) {
    if(state.run||state.cameraCheck||state.cameraRefresh)throw new Error('Stop capture or camera diagnostics before importing evidence.');
    if(!file||file.size>25_000_000)throw new Error('Select a JSON report no larger than 25 MB.');
    const imported=R.parseReport(await file.text()),existing=new Set(trials.map(t=>t.trialId));
    const fresh=imported.filter(t=>!existing.has(t.trialId));
    if(trials.length+fresh.length>300)throw new Error('Import would exceed the 300-trial ledger limit.');
    trials.push(...fresh);state.selectedId=fresh.at(-1)?.trialId||state.selectedId;renderEvidence();
    await persist();
    $('report-status').textContent=`Imported ${fresh.length} trials; skipped ${imported.length-fresh.length} duplicate IDs. Imported evidence carries no source guarantee; summaries were recomputed.`;
  }
  window.SpoofML?.mount({getTrials:()=>trials,download,isBusy:()=>!!(state.run||state.cameraCheck)});
  window.SpoofArena?.mount({getTrials:()=>trials,download,isBusy:()=>!!(state.run||state.cameraCheck||state.cameraRefresh),showView,beginCapture:({condition,challenge})=>{$('condition').value=condition;$('condition').dispatchEvent(new Event('change'));$('challenge-enabled').checked=challenge;$('duration').value='90';showView('capture');}});
  $('duration').value='90';
  for(const id of ['camera-device','camera-profile','condition'])$(id).addEventListener('change',()=>busy(!!(state.run||state.cameraCheck||state.cameraRefresh)));
  $('condition').addEventListener('change',()=>{$('recording-consent-row').hidden=$('condition').value==='live';$('recording-consent').checked=false;});
  const evidenceButton=node('button','Export selected v2 trial');evidenceButton.disabled=true;
  evidenceButton.addEventListener('click',()=>{const t=trials.find(t=>t.trialId===state.selectedId);if(t)download(JSON.stringify(window.SpoofEvidence.convert(t),null,2),'application/json','json');});
  document.querySelector('.report-actions').append(evidenceButton);
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
  window.addEventListener('hashchange',()=>showView(location.hash.slice(1)));
  $('condition').addEventListener('change',()=>{ $('file-field').hidden=$('condition').value!=='injected_replay';$('condition-help').textContent=conditionHelp[$('condition').value]; });
  $('start').addEventListener('click',()=>void start()); $('stop').addEventListener('click',()=>void stop());
  $('check-camera').addEventListener('click',()=>void checkCamera());
  $('refresh-cameras').addEventListener('click',()=>void refreshCameras());
  $('camera-device').addEventListener('change',()=>{$('camera-selection-status').textContent='Selection changed. Run Check camera FPS to measure this device before a trial.';});
  $('filter').addEventListener('change',()=>{renderEvidence();window.SpoofEvidenceUI?.syncFilter();});
  $('import-file').addEventListener('change',async()=>{try{await importFile($('import-file').files[0]);}catch(error){$('report-status').textContent=`Import failed: ${error.message}`;}finally{$('import-file').value='';}});
  $('export-json').addEventListener('click',()=>download(JSON.stringify(R.report(trials),null,2),'application/json','json'));
  $('export-csv').addEventListener('click',()=>download(R.csv(trials),'text/csv;charset=utf-8','csv'));
  $('export-html').addEventListener('click',()=>download(R.html(trials),'text/html;charset=utf-8','html'));
  $('privacy').addEventListener('click',()=>$('privacy-dialog').showModal());
  $('close-privacy').addEventListener('click',()=>$('privacy-dialog').close());
  $('forget-key').addEventListener('click',()=>{$('key').value='';$('privacy-dialog').close();$('status').textContent='API key cleared from the input.';});
  $('clear').addEventListener('click',()=>$('clear-dialog').showModal()); $('cancel-clear').addEventListener('click',()=>$('clear-dialog').close());
  $('confirm-clear').addEventListener('click',async()=>{
    if(state.run||state.cameraCheck||state.cameraRefresh)return;
    if(window.SpoofStorage){try{await window.SpoofStorage.clear();}catch(error){$('report-status').textContent='Could not delete saved trials: '+error.message;return;}}
    if(state.run||state.cameraCheck||state.cameraRefresh)return;window.SpoofCaptureUI?.clear();trials.length=0;state.selectedId=null;window.SpoofArena?.clear?.();window.SpoofML?.clearEvaluation?.();renderEvidence();$('detail-panel').hidden=true;$('detail-content').replaceChildren();
    $('trust-signal').textContent='No evidence yet';$('trust-policy').textContent='No trial selected';$('trust-verdict').textContent='Inconclusive';$('trust-reason').textContent='Capture a trial or import an evidence report.';$('trust-trial-id').textContent='NO TRIAL';$('trust-detail').textContent='Capture or select a trial to inspect its frozen policy and reasoning.';
    for(const id of ['pulse','breathing','confidence'])$(id).textContent='—';draw();$('clear-dialog').close();$('report-status').textContent='In-memory evidence cleared. Exported files remain on your device.';
  });
  window.addEventListener('beforeunload',()=>{if(state.cameraRefresh){state.cameraRefresh.cancelled=true;C.stop(state.cameraRefresh.stream);}if(state.cameraCheck){state.cameraCheck.cancelled=true;C.stop(state.cameraCheck.stream);}const run=state.run;if(run){run.cancelled=true;clearInterval(run.timer);run.stream?.getTracks().forEach(t=>t.stop());try{run.sdk?.destroy();}catch{ /* bridge teardown also occurs on window close */ }if(run.url)URL.revokeObjectURL(run.url);}});
  $('runtime-label').textContent=isElectron?'Electron capture environment':'Report workspace';
  $('runtime-description').textContent=isElectron?'Real SDK measurements. Key and camera required.':'Import and inspect evidence. Live capture runs in Electron.';
  if(isElectron)$('status').textContent='Confirm consent, select your camera, and run Check camera FPS before starting a camera trial.';
  $('preview-banner').hidden=isElectron;
  $('check-camera').title='Measures the selected camera and saves numeric FPS evidence locally. No images are recorded.';
  if(window.SpoofStorage){
    const notice=node('p','Desktop autosave is on: trial metrics, notes and grouping are saved in data/trials and restored after restart. No video or API key is saved with trials. Clear all deletes this local trial store; separately exported files remain.','notice');
    $('view-capture').prepend(notice);
    $('clear-dialog').querySelector('h2').textContent='Delete all local saved trials and clear memory?';
    $('clear-dialog').querySelector('p').textContent='This deletes the app’s data/trials files. Separately exported files remain on your device.';
    $('privacy-dialog').querySelector('ul').prepend(node('li','Desktop trial autosave is enabled in data/trials. Metrics, notes and metadata remain until Clear all deletes them. Training requires separate dataset consent.'));
    for(const item of $('privacy-dialog').querySelectorAll('li'))if(item.textContent.startsWith('Trial metrics stay in memory.'))item.textContent='Trial metrics are saved locally. A key saved in .env remains there until removed; Forget API key clears only the input.';
  }
  if (!isElectron) {
    $('status').textContent='Live capture is disabled in this browser preview. Open the SpoofLab desktop app with npm start; it loads your .env key automatically.';
    $('start').title='Requires the SpoofLab Electron desktop app; no frontend key is needed in preview.';
  }
  updateShell=window.SpoofShell?.mount?.(shellStatus) || (()=>{});
  updateCapture();
  renderEvidence();draw();showView(location.hash.slice(1));
  window.addEventListener('spooflab:metadata-changed',()=>void persist());
  if(window.SpoofStorage){busy(true);window.SpoofStorage.load().then(saved=>{trials.push(...saved.trials);state.selectedId=trials.at(-1)?.trialId||null;renderEvidence();$('report-status').textContent=`Restored ${saved.trials.length} local trials. ${saved.issues.length} unreadable files. Storage: ${saved.path}`;}).catch(error=>{$('report-status').textContent='Restore failed: '+error.message;}).finally(()=>busy(false));}
})();
