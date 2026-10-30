/* Monthly calendar interaction layer */
(()=>{'use strict';
 const KEY='cyberpunk-calendar-zoom-v1';
 let scale=Math.max(.65,Math.min(1.8,Number(localStorage.getItem(KEY)||1))),gesture=null,ignoreClickUntil=0;
 const clamp=n=>Math.max(.65,Math.min(1.8,n));
 function attach(){
  const wrap=document.querySelector('.month-grid-wrap'),nav=document.querySelector('.calendar-toolbar .calendar-nav');
  if(!wrap||!nav||wrap.dataset.interactive==='1')return;
  wrap.dataset.interactive='1';wrap.style.setProperty('--calendar-scale',scale);
  const controls=document.createElement('span');controls.className='calendar-zoom-controls';
  controls.innerHTML='<span>ZOOM</span><button type="button" data-calzoom="-1" aria-label="Diminuir zoom">−</button><button type="button" data-calzoom="0" aria-label="Restaurar zoom">'+Math.round(scale*100)+'%</button><button type="button" data-calzoom="1" aria-label="Aumentar zoom">+</button>';
  nav.appendChild(controls);
  const handle=document.createElement('button');handle.type='button';handle.className='calendar-resize-handle';handle.setAttribute('aria-label','Arraste para redimensionar o calendário');handle.title='Arraste para redimensionar';handle.innerHTML='<span></span>';wrap.appendChild(handle);
  wrap.addEventListener('click',e=>{
   if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();return}
   if(e.target.closest('[data-calzoom]')){const b=e.target.closest('[data-calzoom]'),v=Number(b.dataset.calzoom);scale=v===0?1:clamp(scale+v*.15);localStorage.setItem(KEY,String(scale));wrap.style.setProperty('--calendar-scale',scale);const reset=wrap.querySelector('[data-calzoom="0"]');if(reset)reset.textContent=Math.round(scale*100)+'%';e.preventDefault();return}
   if(e.target.closest('.day-cell'))setTimeout(()=>{const open=document.querySelector('[data-show-day-items="1"]');if(open&&/Ver todos/.test(open.textContent))open.click()},0);
  },true);
  wrap.addEventListener('pointerdown',e=>{
   if(e.target.closest('.calendar-resize-handle')){gesture={kind:'resize',x:e.clientX,y:e.clientY,scale,wrap};e.preventDefault();e.stopPropagation();return}
   if(e.target.closest('.day-cell'))gesture={kind:'pan',x:e.clientX,y:e.clientY};
  });
 }
 window.addEventListener('pointermove',e=>{
  if(!gesture)return;
  if(gesture.kind==='resize'){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;scale=clamp(gesture.scale+(dx+dy)/420);gesture.wrap.style.setProperty('--calendar-scale',scale);const label=gesture.wrap.querySelector('[data-calzoom="0"]');if(label)label.textContent=Math.round(scale*100)+'%';e.preventDefault();return}
  if(gesture.kind==='pan'){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)>58&&Math.abs(dx)>Math.abs(dy)*1.2){gesture.kind='done';ignoreClickUntil=Date.now()+450;const prev=document.querySelector('[data-period="-1"]'),next=document.querySelector('[data-period="1"]');(dx<0?next:prev)?.click()}}
 },{passive:false});
 window.addEventListener('pointerup',()=>{if(gesture?.kind==='resize')localStorage.setItem(KEY,String(scale));gesture=null});
 window.addEventListener('pointercancel',()=>{gesture=null});
 const observer=new MutationObserver(attach);observer.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});attach();
})();