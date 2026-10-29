/* Cyberpunk Diário — authenticated local-network synchronization.
 * Desktop is the LAN server; Android and desktop browser are bidirectional clients.
 * HTTP is for trusted private LANs only. Never forward port 8765 to the public internet.
 */
(()=>{'use strict';
 const STORAGE='cyberpunk-sync-config';
 let config={endpoint:'',token:''},timer=null,pushing=false,localSnapshot=null;
 try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');config={endpoint:String(saved.endpoint||''),token:String(saved.token||'')}}catch{}
 const normalize=v=>{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))throw new Error('Use um endereço HTTP/HTTPS válido');return u.origin};
 const headers=()=>({'Content-Type':'application/json','Authorization':'Bearer '+config.token});
 async function request(path,options={}){if(!config.endpoint||!config.token)throw new Error('Configure o servidor e o código de pareamento');const r=await fetch(config.endpoint+path,{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store'});if(!r.ok)throw new Error(r.status===401?'Código de pareamento incorreto':'Servidor respondeu '+r.status);return r.json()}
 function activeKey(){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('cyberpunk-diario-v1:')&&k.endsWith(':guest'))return k}for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('cyberpunk-diario-v1:'))return k}return 'cyberpunk-diario-v1:guest'}
 function localState(){if(localSnapshot)return localSnapshot;try{return JSON.parse(localStorage.getItem(activeKey())||'null')}catch{return null}}
 function applyRemote(state){if(!state||typeof state!=='object')return;localSnapshot=state;window.dispatchEvent(new CustomEvent('cyberpunk:remote-state',{detail:{state}}))}
 async function sync(){if(pushing)return;const remote=await request('/api/state'),local=localState(),remoteState=remote.state||null;if(!local&&!remoteState)return;if(!local&&remoteState){applyRemote(remoteState);return}if(local&&!remoteState){await request('/api/state',{method:'PUT',body:JSON.stringify({state:local})});return}const lt=Number(local.updatedAt||0),rt=Number(remoteState.updatedAt||0);if(rt>lt){applyRemote(remoteState);return}pushing=true;try{await request('/api/state',{method:'PUT',body:JSON.stringify({state:local})})}finally{pushing=false}}
 function changed(snapshot){if(snapshot&&typeof snapshot==='object')localSnapshot=snapshot;if(config.endpoint&&config.token){clearTimeout(timer);timer=setTimeout(()=>sync().catch(err=>window.dispatchEvent(new CustomEvent('cyberpunk:sync-error',{detail:{message:err.message}}))),700)}}
 function configure(endpoint,token){if(!endpoint&&!token){config={endpoint:'',token:''};localStorage.removeItem(STORAGE);return}config={endpoint:normalize(endpoint),token:String(token||'')};if(config.token.length<20)throw new Error('Código de pareamento inválido');localStorage.setItem(STORAGE,JSON.stringify(config))}
 window.CyberpunkBridge={config,configure,changed,sync,pull:sync,push:sync};
 window.addEventListener('online',()=>{if(config.endpoint)sync().catch(()=>{})});
 if(['localhost','127.0.0.1'].includes(location.hostname)){fetch('/api/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d?.token){config={endpoint:location.origin,token:d.token};localStorage.setItem(STORAGE,JSON.stringify(config));sync().catch(()=>{})}}).catch(()=>{})}
 if(config.endpoint&&config.token){sync().catch(()=>{});setInterval(()=>sync().catch(()=>{}),7000)}
 window.addEventListener('cyberpunk:local-change',changed);
})();