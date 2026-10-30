/* Embedded Tailscale connection state. Pair once; reconnect automatically whenever Tailscale returns. */
(()=>{'use strict';
 const native=!!window.AndroidBackup;
 let wasConnected=false,attempting=false;
 const connected=()=>{try{return native&&window.AndroidBackup.isTailscaleConnected()===true}catch{return false}};
 function refresh(){
  const ready=native?connected():['localhost','127.0.0.1'].includes(location.hostname);
  const panel=document.querySelector('.sync-settings');
  if(panel)panel.hidden=native&&!ready;
  let chip=document.getElementById('tailscaleStatusChip');
  if(ready){
   if(!chip){chip=document.createElement('span');chip.id='tailscaleStatusChip';chip.className='tailscale-status-chip';document.querySelector('.header-actions')?.appendChild(chip)}
   const cfg=window.CyberpunkBridge?.config||{};
   chip.textContent=cfg.endpoint&&cfg.token?'TAILSCALE // AUTO':'TAILSCALE // PAREAR';
   chip.hidden=false;
  }else if(chip)chip.hidden=true;
  if(ready&&!wasConnected){
   const cfg=window.CyberpunkBridge?.config||{};
   if(cfg.endpoint&&cfg.token&&!attempting){
    attempting=true;const status=document.getElementById('syncStatus');if(status)status.textContent='Tailscale conectado. Sincronizando automaticamente...';
    window.CyberpunkBridge?.sync?.().then(()=>{if(status)status.textContent='Conectado · sincronização automática ativa.'}).catch(err=>{if(status)status.textContent='Tailscale ativo, mas o servidor não respondeu: '+err.message}).finally(()=>{attempting=false});
   }
  }
  wasConnected=ready;
 }
 refresh();setInterval(refresh,2500);
})();