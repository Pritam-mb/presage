const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const localPython=path.join(__dirname,'..','.venv',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python');
function trainLocal(dataset,{python=process.env.SPOOFLAB_PYTHON||(fs.existsSync(localPython)?localPython:'python'),timeoutMs=120000,mode='grouped'}={}) {
  if(!['grouped','exploratory','loocv'].includes(mode))throw new Error('Unknown training mode');
  const payload=JSON.stringify(dataset);
  if(payload.length>25_000_000||dataset?.schema!=='spooflab-evidence-v2'||!Array.isArray(dataset.trials)||dataset.trials.length>300)throw new Error('Invalid training dataset or size limit exceeded.');
  if(dataset.trials.some(t=>t.ml?.datasetConsent!==true))throw new Error('Every training record must have explicit dataset consent.');
  return new Promise((resolve,reject)=>{
    const env={...process.env};delete env.PRESAGE_API_KEY;
    const child=spawn(python,[path.join(__dirname,'..','ml','train.py'),'--stdin','--output','-','--mode',mode],{cwd:path.join(__dirname,'..'),env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let out='',err='',settled=false;
    function fail(error){if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(error);}
    const timer=setTimeout(()=>fail(new Error('Local training exceeded two minutes. Reduce dataset size or inspect the Python environment.')),timeoutMs);
    child.on('error',()=>fail(new Error('Could not start local Python. Install ml/requirements.txt or set SPOOFLAB_PYTHON.')));
    child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{out+=chunk.toString();if(out.length>32_000_000)fail(new Error('Training output exceeded the size limit.'));});
    child.stderr.on('data',chunk=>{err=(err+chunk.toString()).slice(-4000);});
    child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);if(code!==0)return reject(new Error('Local training failed. '+err));try{resolve(JSON.parse(out));}catch{reject(new Error('Python returned an invalid evaluation report.'));}});
    child.stdin.end(payload);
  });
}
module.exports={trainLocal};
