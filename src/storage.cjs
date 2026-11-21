const fs=require('node:fs/promises');const path=require('node:path');const R=require('./reports.cjs');
const {isDeepStrictEqual}=require('node:util');
function createStore(root){
 let queue=Promise.resolve();
 const safe=id=>{if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('Invalid saved trial ID');return path.join(root,id+'.json');};
 function serialize(task){const result=queue.then(task);queue=result.catch(()=>{});return result;}
 return {
 save(report,secret=''){return serialize(async()=>{
   if(report?.schema!==R.SCHEMA || !Array.isArray(report.trials) || report.trials.length>300)
     throw new Error('Unsupported report schema or too many trials.');
   const ids=new Set();
   const trials=report.trials.map(original=>{
     const [trial]=R.parseReport(JSON.stringify({schema:R.SCHEMA,trials:[original]}));
     safe(trial.trialId);
     if(ids.has(trial.trialId))throw new Error('Duplicate saved trial ID');
     ids.add(trial.trialId);
     trial.imported=original.imported===true;
     return trial;
   });
   await fs.mkdir(root,{recursive:true});for(const t of trials){
   let data=JSON.stringify(R.report([t]),(key,value)=>['apiKey','deviceId','groupId','filePath'].includes(key)?undefined:value,2);
   if(secret)data=data.split(secret).join('[redacted]');const file=safe(t.trialId);await fs.writeFile(file+'.tmp',data,'utf8');await fs.rename(file+'.tmp',file);
 }return {saved:trials.length,path:root};});},
 load(){return serialize(async()=>{
   await fs.mkdir(root,{recursive:true});const records=new Map(),issues=new Set(),conflicts=new Set();
   for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.json')).sort().slice(0,300)){
     try{
       const original=JSON.parse((await fs.readFile(path.join(root,name),'utf8')).replace(/^\uFEFF/,''));
       // Legacy autosaves contain one direct trial. Validate them through exactly
       // the same report parser without rewriting or migrating the source file.
       const report=original&&typeof original.trialId==='string'&&!Object.hasOwn(original,'trials')?{schema:R.SCHEMA,trials:[original]}:original;
       const parsed=R.parseReport(JSON.stringify(report));
       for(const t of parsed){
         t.imported=report.trials.find(x=>x.trialId===t.trialId)?.imported===true;
         if(conflicts.has(t.trialId)){issues.add(name);continue;}
         const previous=records.get(t.trialId);
         if(previous&&!isDeepStrictEqual(previous.trial,t)){
           // Neither conflicting copy is chosen as the authoritative capture.
           conflicts.add(t.trialId);records.delete(t.trialId);for(const file of previous.files)issues.add(file);issues.add(name);
         }else if(!previous)records.set(t.trialId,{trial:t,files:new Set([name])});
         else previous.files.add(name);
       }
     }catch{issues.add(name);}
   }
   const trials=[...records.values()].map(r=>r.trial).sort((a,b)=>a.trialId<b.trialId?-1:a.trialId>b.trialId?1:0);
   return {trials,issues:[...issues].sort(),path:root};
 });},
 clear(){return serialize(async()=>{await fs.mkdir(root,{recursive:true});for(const name of await fs.readdir(root))if(/^[A-Za-z0-9_-]{1,100}\.json(?:\.tmp)?$/.test(name))await fs.unlink(path.join(root,name));return true;});}
 };
}module.exports={createStore};
