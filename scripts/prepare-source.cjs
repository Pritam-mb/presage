// Prepare a reviewable source copy; never push, rewrite history or include private evidence.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {parseEnv}=require('node:util');const root=path.resolve(__dirname,'..');
const files=[];
function walk(relative){const base=path.join(root,relative);if(!fs.existsSync(base))return;for(const entry of fs.readdirSync(base,{withFileTypes:true})){
 if(entry.isSymbolicLink()||entry.name==='__pycache__'||entry.name.endsWith('.pyc'))continue;
 const name=path.join(relative,entry.name);if(entry.isDirectory())walk(name);else if(/\.(?:js|cjs|py|css|html|md|txt|ya?ml)$/.test(name))files.push(name);
}}
for(const dir of ['src','scripts','test','ml','.github'])walk(dir);
for(const name of ['package.json','package-lock.json','README.md','MVP.md','.gitignore','.env.example','protocols/frozen-v1.json','fixtures/sanitized-example.json','LICENSE','docs/harness.md','docs/addon_spec.md','docs/POST.template.md','docs/ANALYSIS_CUT.md','docs/PRIVACY.md','docs/THREAT_MODEL.md','docs/EXPERIMENTS.md','docs/ML_LIMITATIONS.md','docs/ORIGINALITY.md','docs/CAMERA.md','docs/ML.md','docs/EXPERIMENT.md','docs/SUBMISSION.md','docs/DEV_POST.template.md','docs/DEMO_VIDEO.md'])if(fs.existsSync(path.join(root,name)))files.push(name);
const env=fs.existsSync(path.join(root,'.env'))?parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8')):{};
const secrets=Object.values(env).filter(v=>v.length>=8);
for(const name of files){const text=fs.readFileSync(path.join(root,name),'utf8');if(secrets.some(v=>text.includes(v)))throw new Error('Configured secret found in public source: '+name);}
const dest=path.join(root,'artifacts','source-review-'+Date.now());fs.mkdirSync(dest,{recursive:true});
const manifest=[];for(const name of files){const bytes=fs.readFileSync(path.join(root,name));const target=path.join(dest,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest.push({file:name.replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
fs.writeFileSync(path.join(dest,'SOURCE_MANIFEST.json'),JSON.stringify({reviewOnly:true,includesGitHistory:false,includesTrialData:false,files:manifest},null,2));
console.log('Source review copy prepared: '+dest+'\n'+files.length+' source files. No Git history, trial data, source videos or populated .env. Review before publishing.');
