// Audit product claims, not supplied development instructions or executable tests.
const path=require('node:path');
const strict=/(proves? liveness|detects? deepfakes?|secure authentication|sdk vulnerability|anti-?spoof guarantee|unspoofable)/i;
const medical=/\b(diagnos(?:e|es|ed|ing|is)|treatment|medical advice|stress level|anxiety|clinical)\b/i;
const neg=/\b(no|not|never|without|cannot|can't|isn't|does not|do not|must not|avoid|prohibited|excluded|neither)\b/i;
function isProductFile(relative){
 const f=relative.replaceAll('\\','/');
 if(['README.md','MVP.md'].includes(f))return true;
 if(/^src\//.test(f))return /\.(?:html|js|cjs)$/.test(f);
 return /^docs\//.test(f)&&/\.md$/.test(f)&&!['docs/harness.md','docs/addon_spec.md'].includes(f);
}
function scan(text,name){
 if(!isProductFile(name))return [];
 return text.split(/\r?\n/).flatMap((line,i)=>(strict.test(line)||medical.test(line))&&!neg.test(line)?[`${name}:${i+1}`]:[]);
}
function audit(root,files,read){return files.flatMap(file=>scan(read(file),path.relative(root,file)));}
module.exports={scan,isProductFile,audit};
