/* Touch-first monthly calendar: pinch zoom, swipe paging, normal vertical scroll. */
(()=>{'use strict';
 const KEY='cyberpunk-calendar-zoom-v2',MIN=.65,MAX=1.6;
 let scale=Math.max(MIN,Math.min(MAX,Number(localStorage.getItem(KEY)||1))),touchStart=null,pinchStart=null,ignoreClickUntil=0;
 const clamp=n=>Math.max(MIN,Math.min(MAX,n)),distance=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 function apply(wrap,value,save=true){scale=clamp(value);if(save)localStorage.setItem(KEY,String(scale));wrap.style.setProperty('--calendar-scale',String(scale));wrap.dataset.zoom=String(scale);const label=document.querySelector('.month-zoom-controls span');if(label)label.textContent=Math.round(scale*100)+'%';window.dispatchEvent(new CustomEvent('cyberpunk:calendar-zoom',{detail:{scale}}))}
 function attach(){const wrap=document.querySelector('.month-grid-wrap'),nav=document.querySelector('.calendar-toolbar .calendar-nav');if(!wrap||!nav||wrap.dataset.touchReady==='1')return;wrap.dataset.touchReady='1';apply(wrap,Number(wrap.dataset.zoom)||scale,false);
  const controls=document.querySelector('.month-zoom-controls');if(controls){controls.querySelectorAll('[data-month-zoom]').forEach(b=>b.addEventListener('click',()=>apply(wrap,b.dataset.monthZoom==='reset'?1:scale+Number(b.dataset.monthZoom)*.15)));const label=controls.querySelector('span');if(label)label.textContent=Math.round(scale*100)+'%'}
  wrap.addEventListener('touchstart',e=>{if(e.touches.length===2){pinchStart={distance:distance(e.touches),scale};touchStart=null}else if(e.touches.length===1){const t=e.touches[0];touchStart={x:t.clientX,y:t.clientY,time:Date.now()}}},{passive:true});
  wrap.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinchStart){e.preventDefault();apply(wrap,pinchStart.scale*distance(e.touches)/Math.max(1,pinchStart.distance))}},{passive:false});
  wrap.addEventListener('touchend',e=>{if(e.touches.length<2)pinchStart=null;if(!e.touches.length&&touchStart){const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.25&&Date.now()-touchStart.time<900){ignoreClickUntil=Date.now()+500;document.querySelector(dx<0?'[data-period="1"]':'[data-period="-1"]')?.click()}touchStart=null}},{passive:true});
  wrap.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();return}if(e.target.closest('.day-cell'))setTimeout(()=>{const open=document.querySelector('[data-show-day-items="1"]');if(open&&/Ver todos/.test(open.textContent))open.click()},0)},true);
  wrap.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();apply(wrap,scale+(e.deltaY<0?.06:-.06))},{passive:false});
  nav.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')document.querySelector('[data-period="-1"]')?.click();if(e.key==='ArrowRight')document.querySelector('[data-period="1"]')?.click();if(e.key==='Home')document.querySelector('[data-period="today"]')?.click()});
 }
 const observer=new MutationObserver(attach);observer.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});attach();
})();