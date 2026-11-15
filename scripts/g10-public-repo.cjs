const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
function audit(root=process.cwd()){
 root=path.resolve(root);const failures=[];
 const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(r.status!==0)throw new Error('Public repository must have its own initialized, committed Git history.');return r.stdout;};
 const privatePath=name=>/^(?:data|evidence\/real|evidence\/analysis|evidence\/groups|artifacts|recordings|datasets|ml-output|node_modules|\.venv)(?:\/|$)/.test(name)||/(?:^|\/)\.env(?:$|\.(?!example$))/.test(name)||/\.(?:mp4|mov|webm|avi)$/i.test(name)||/^evidence\/(?!summary\.json$)/.test(name);
 try{
 const tracked=git(['ls-files','-z']).split('\0').filter(Boolean),history=git(['log','--all','--pretty=format:','--name-only']).split(/\r?\n/).filter(Boolean);
 for(const [kind,names]of [['tracked',tracked],['historical',[...new Set(history)]]])for(const name of names)if(privatePath(name))failures.push(`${kind} private path: ${name}`);
 for(const name of tracked){const file=path.join(root,name);if(!fs.existsSync(file)||privatePath(name))continue;const content=fs.readFileSync(file,'utf8');
   if(/(?:sk-[A-Za-z0-9_-]{30,}|AIza[A-Za-z0-9_-]{30,})/.test(content))failures.push('Possible credential in '+name);
   if(name.endsWith('.json')){try{const d=JSON.parse(content);if(d?.schema==='spooflab-evidence-v2'||d?.schema==='spooflab.trial.v2'||Array.isArray(d?.trials)){if(d.synthetic!==true)failures.push('Non-synthetic trial JSON: '+name);}}catch{failures.push('Invalid JSON: '+name);}}
 }
 }catch(error){failures.push(error.message);}
 return {gate:'G10',root,passed:!failures.length,failures,limitations:'Local source/history checks only. This does not verify remote visibility or publication consent.'};
}
if(require.main===module){const r=audit(process.argv[2]||process.cwd());console.log(JSON.stringify(r,null,2));process.exitCode=r.passed?0:1;}module.exports={audit};
