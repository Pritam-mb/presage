(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SpoofCamera=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function constraints(width,deviceId='',strict=false){
    if(![640,1280].includes(width))throw new Error('Unsupported camera profile.');
    const video={width:{ideal:width},height:{ideal:width===640?480:720},frameRate:strict?{min:25,ideal:30,max:30}:{ideal:30,max:30}};
    if(deviceId)video.deviceId={exact:deviceId};else video.facingMode='user';
    return {audio:false,video};
  }
  function stop(stream){stream?.getTracks().forEach(track=>track.stop());}
  async function acquire(mediaDevices,requested,{isCancelled=()=>false,timeoutMs=20000}={}){
    if(!mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable in this environment.');
    let expired=false,timer;
    const acquisition=Promise.resolve().then(()=>mediaDevices.getUserMedia(requested)).then(stream=>{
      if(expired||isCancelled()){stop(stream);throw new Error('Camera request cancelled or timed out.');}
      return stream;
    });
    try{return await Promise.race([acquisition,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('Camera permission timed out. Check Windows camera permission.'));},timeoutMs);})]);}
    finally{clearTimeout(timer);}
  }
  function metadata(track){const s=track?.getSettings()||{};return {label:track?.label||'Default camera',width:s.width??null,height:s.height??null,frameRate:s.frameRate??null};}
  return {constraints,acquire,stop,metadata};
});
