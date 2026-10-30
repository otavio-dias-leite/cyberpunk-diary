/* Monthly calendar gestures: reliable swipe paging, pinch zoom and two-axis resizing. */
(()=>{'use strict';
 const MIN=.65,MAX=1.6,clamp=n=>Math.max(MIN,Math.min(MAX,n));
 let scale=1,touch=null,pinch=null,mouse=null,resize=null,ignoreClickUntil=0;
 const distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 const emit=(value,wrap,save=true)=>{scale=clamp(value);wrap.style.setProperty('--calendar-scale',String(scale));wrap.dataset.zoom=String(scale);const label=document.querySelector('.month-zoom-controls span');if(label)label.textContent=Math.round(scale*100)+'%';if(save)window.dispatchEvent(new CustomEvent('cyberpunk:calendar-zoom',{detail:{scale}}))};
 const page=dx=>{ignoreClickUntil=Date.now()+650;document.querySelector(dx<0?'[data-period="1"]':'[data-period="-1"]')?.click()};
 function attach(){const wrap=document.querySelector('.month-grid-wrap');if(!wrap||wrap.dataset.gesturesReady==='1')return;wrap.dataset.gesturesReady='1';scale=clamp(Number(wrap.dataset.zoom)||scale);wrap.style.setProperty('--calendar-scale',String(scale));
  let handle=wrap.querySelector('.calendar-resize-handle');if(!handle){handle=document.createElement('button');handle.type='button';handle.className='calendar-resize-handle';handle.setAttribute('aria-label','Arraste para redimensionar o calendário na horizontal e vertical');handle.innerHTML='<span></span>';wrap.append(handle)}
  handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();resize={id:e.pointerId,x:e.clientX,y:e.clientY,scale};handle.setPointerCapture(e.pointerId);wrap.classList.add('calendar-resizing')});
  handle.addEventListener('pointermove',e=>{if(!resize||resize.id!==e.pointerId)return;const dx=e.clientX-resize.x,dy=e.clientY-resize.y;emit(resize.scale+(dx+dy)/300,wrap,false)});
  const finishResize=e=>{if(!resize||resize.id!==e.pointerId)return;resize=null;wrap.classList.remove('calendar-resizing');window.dispatchEvent(new CustomEvent('cyberpunk:calendar-zoom',{detail:{scale}}))};
  handle.addEventListener('pointerup',finishResize);handle.addEventListener('pointercancel',finishResize);
  wrap.addEventListener('touchstart',e=>{if(e.target.closest('.calendar-resize-handle'))return;if(e.touches.length===2){pinch={distance:distance(e.touches),scale};touch=null}else if(e.touches.length===1){const t=e.touches[0];touch={x:t.clientX,y:t.clientY,mode:'pending'}}},{passive:true});
  wrap.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){e.preventDefault();emit(pinch.scale*distance(e.touches)/Math.max(1,pinch.distance),wrap,false);return}if(!touch||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(touch.mode==='pending'&&(Math.abs(dx)>12||Math.abs(dy)>12))touch.mode=Math.abs(dx)>Math.abs(dy)*1.12?'horizontal':'vertical';if(touch.mode==='horizontal')e.preventDefault()},{passive:false});
  wrap.addEventListener('touchend',e=>{if(pinch&&e.touches.length<2){pinch=null;window.dispatchEvent(new CustomEvent('cyberpunk:calendar-zoom',{detail:{scale}}));return}if(touch&&!e.touches.length){const dx=e.changedTouches[0].clientX-touch.x;if(touch.mode==='horizontal'&&Math.abs(dx)>42)page(dx);touch=null}},{passive:true});
  wrap.addEventListener('touchcancel',()=>{touch=null;pinch=null},{passive:true});
  wrap.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.target.closest('.calendar-resize-handle'))return;mouse={id:e.pointerId,x:e.clientX,y:e.clientY,mode:'pending'};wrap.classList.add('calendar-pointer-down')});
  document.addEventListener('pointermove',e=>{if(!mouse||mouse.id!==e.pointerId)return;const dx=e.clientX-mouse.x,dy=e.clientY-mouse.y;if(mouse.mode==='pending'&&(Math.abs(dx)>9||Math.abs(dy)>9))mouse.mode=Math.abs(dx)>Math.abs(dy)*1.12?'horizontal':'vertical';if(mouse.mode==='horizontal')wrap.classList.add('calendar-dragging')});
  document.addEventListener('pointerup',e=>{if(!mouse||mouse.id!==e.pointerId)return;const dx=e.clientX-mouse.x;if(mouse.mode==='horizontal'&&Math.abs(dx)>42)page(dx);mouse=null;wrap.classList.remove('calendar-pointer-down','calendar-dragging')});
  wrap.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}},true);
  wrap.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();emit(scale+(e.deltaY<0?.06:-.06),wrap)},{passive:false});
 }
 const observer=new MutationObserver(attach);observer.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});attach();
})();