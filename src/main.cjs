const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, session, ipcMain } = require('electron');
const {trainLocal}=require('./ml-process.cjs');
const {createStore}=require('./storage.cjs');
const { bindSmartSpectraIpc } = require('@smartspectra/node-sdk/main');
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1380, height: 930, backgroundColor: '#0A100E',
    titleBarStyle: 'hidden', titleBarOverlay: {color:'#0A100E',symbolColor:'#D2E2D8',height:40}, autoHideMenuBar:true,
    webPreferences: { preload: path.join(__dirname,'..','dist','preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
  bindSmartSpectraIpc(win);
  ipcMain.handle('spooflab:camera-check',async(event,report)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==page)throw new Error('Camera check storage is local only.');
    for(const field of ['delivered_fps','duration_s','width','height','media_timestamp_fps','frame_count'])if(!Number.isFinite(report?.[field])||report[field]<0)throw new Error('Invalid camera diagnostic.');
    if(report.duration_s<6||report.duration_s>120||report.delivered_fps>240||report.width>7680||report.height>4320||report.frame_count>30000)throw new Error('Camera diagnostic is outside supported bounds.');
    const saved={schema:'spooflab-camera-fps-v1',synthetic:false,measured_at:new Date().toISOString()};
    for(const field of ['delivered_fps','duration_s','width','height','media_timestamp_fps','frame_count'])saved[field]=report[field];
    const dir=path.join(__dirname,'..','evidence','real');await fs.promises.mkdir(dir,{recursive:true});
    await fs.promises.writeFile(path.join(dir,'camera_fps.json'),JSON.stringify(saved,null,2));return {saved:true};
  });
  const store=createStore(path.join(__dirname,'..','data','trials'));
  for(const [channel,handler]of Object.entries({'save':report=>store.save(report,process.env.PRESAGE_API_KEY?.trim()),'load':()=>store.load(),'clear':()=>store.clear()})){
    ipcMain.handle('spooflab:'+channel,async(event,payload)=>{
      if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==page)throw new Error('Local storage is available only to the desktop app.');
      return handler(payload);
    });
  }
  let training=false;
  ipcMain.handle('spooflab:train',async(event,dataset,mode='grouped')=>{
    if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame || event.senderFrame.url.split('#')[0]!==page)throw new Error('Training is available only to the local app.');
    if(training)throw new Error('A local training job is already running.');
    training=true;try{return await trainLocal(dataset,{mode});}finally{training=false;}
  });
  const allowed = (contents, permission, details = {}) => contents === win.webContents &&
    permission === 'media' && win.webContents.getURL().split('#')[0] === page &&
    !(details.mediaTypes || []).includes('audio');
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(allowed(contents, permission, details)));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) =>
    allowed(contents, permission, details));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('did-finish-load', () => {
    const key = process.env.PRESAGE_API_KEY?.trim();
    if (key && win.webContents.getURL().split('#')[0] === page) {
      // Populate only our local password field; never bundle or log the secret.
      win.webContents.executeJavaScript(
        `document.getElementById('key').value = ${JSON.stringify(key)};`
      ).catch(() => { console.error('Could not populate the API key field. Enter it in the app.'); });
    }
  });
  win.loadURL(page);
});
app.on('window-all-closed', () => app.quit());
