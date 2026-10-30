/* Cyberpunk Diario — profiles offline only; not authentication.
 * Each local profile gets a separate task storage namespace.
 * DO NOT treat a profile as a secure account; anyone with device access can switch.
 * For real privacy use Android screen lock or add encrypted native storage. */
(()=>{'use strict';
 const REG='cyberpunk-diario-local-profiles-v1',ACTIVE='cyberpunk-diario-active-profile-v1',LEGACY='cyberpunk-diario-v1';
 const snapshot=()=>{try{const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k!==null&&k!=='cyberpunk-sync-config')data[k]=localStorage.getItem(k)}window.AndroidBackup?.saveSnapshot?.(JSON.stringify(data))}catch(e){console.warn('Falha ao salvar snapshot Android',e)}};
 const read=()=>{try{const x=JSON.parse(localStorage.getItem(REG)||'[]');return Array.isArray(x)?x.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'):[]}catch{return []}};
 const save=p=>{localStorage.setItem(REG,JSON.stringify(p));snapshot()};
 const currentId=()=>{const id=localStorage.getItem(ACTIVE);return read().some(p=>p.id===id)?id:null};
 const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const create=name=>{name=name.trim().slice(0,32);if(!name)return;const profiles=read();if(profiles.length>=15){alert('Máximo de 15 perfis locais');return}const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());profiles.push({id,name});save(profiles);localStorage.setItem(ACTIVE,id);snapshot();location.reload()};
 function choose(id){if(!read().some(p=>p.id===id))return;localStorage.setItem(ACTIVE,id);snapshot();location.reload()}
 function render(){const gate=document.getElementById('accountGate'),items=document.getElementById('accountList');if(!gate)return;gate.hidden=false;const active=currentId(),profiles=read();items.innerHTML=profiles.map(p=>`<button class="account-option ${p.id===active?'selected':''}" data-account-id="${safe(p.id)}"><span>◈</span><strong>${safe(p.name)}</strong><small>${p.id===active?'EM USO':'ABRIR'}</small></button>`).join('')||'<p class="account-empty">Crie seu primeiro perfil para começar.</p>';items.querySelectorAll('[data-account-id]').forEach(b=>b.onclick=()=>choose(b.dataset.accountId))}
 function gate(){render()}
 document.addEventListener('DOMContentLoaded',()=>{
 const old=localStorage.getItem(LEGACY);if(old&&!read().length){const id='migrated';save([{id,name:'Meu diário'}]);localStorage.setItem('cyberpunk-diario-v1:'+id,old);localStorage.setItem(ACTIVE,id);snapshot()}
 const btn=document.getElementById('profileButton');if(btn)btn.addEventListener('click',gate);
 const form=document.getElementById('accountCreate');if(form)form.addEventListener('submit',e=>{e.preventDefault();create(document.getElementById('accountName').value)});
 if(!currentId())gate();else{const p=read().find(p=>p.id===currentId());if(btn&&p)btn.textContent='◈ '+p.name.toUpperCase().slice(0,14)};
 });
 window.CyberpunkAccounts={currentId,profiles:read,choose};
})();
