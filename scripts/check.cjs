const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');let failures=0;
for(const dir of ['src','scripts','test','test/support'])for(const name of fs.readdirSync(path.join(root,dir))){if(!/\.(cjs|js)$/.test(name))continue;const result=spawnSync(process.execPath,['--check',path.join(root,dir,name)],{encoding:'utf8',windowsHide:true});if(result.status){failures++;console.error(result.stderr);}}
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8'),renderer=fs.readFileSync(path.join(root,'src/renderer.js'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);if(new Set(ids).size!==ids.length){failures++;console.error('Duplicate DOM IDs');}
for(const match of renderer.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(match[1])){failures++;console.error('Missing DOM ID:',match[1]);}
if(!failures)console.log('Syntax and DOM reference checks passed.');process.exitCode=failures?1:0;
