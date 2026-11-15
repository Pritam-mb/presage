// Use the same local Python preference as desktop training.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const local=path.join(root,'.venv',process.platform==='win32'?'Scripts':'bin',process.platform==='win32'?'python.exe':'python');
const python=process.env.SPOOFLAB_PYTHON||(fs.existsSync(local)?local:'python');
const result=spawnSync(python,['-m','unittest','discover','-s','ml','-p','test_*.py'],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)console.error('Could not start Python. Set up the local .venv and install ml/requirements.txt.');
process.exitCode=result.status===0?0:1;
