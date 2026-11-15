require('@smartspectra/node-sdk/preload');
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('SpoofMLBridge',Object.freeze({train:(dataset,mode='grouped')=>ipcRenderer.invoke('spooflab:train',dataset,mode)}));
contextBridge.exposeInMainWorld('SpoofStorage',Object.freeze({save:report=>ipcRenderer.invoke('spooflab:save',report),load:()=>ipcRenderer.invoke('spooflab:load'),clear:()=>ipcRenderer.invoke('spooflab:clear'),saveCameraCheck:report=>ipcRenderer.invoke('spooflab:camera-check',report)}));
