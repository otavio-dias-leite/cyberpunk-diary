/* Calendar navigation by swipe/drag anywhere over the month grid. No zoom, pinch or resize UI. */
(()=>{'use strict';
 let gesture=null,ignoreClickUntil=0;
 const THRESHOLD=42,START_THRESHOLD=10;
 const page=dx=>{
  ignoreClickUntil=Date.now()+700;
  const selector=dx<0?'[data-period="1"]':'[data-period="-1"]';
  document.querySelector('#main '+selector)?.click();
 };
 function attach(){
  const wrap=document.querySelector('.month-grid-wrap');
  if(!wrap||wrap.dataset.swipeReady==='1')return;
  wrap.dataset.swipeReady='1';
  wrap.addEventListener('pointerdown',e=>{
   if(e.button!==undefined&&e.button!==0)return;
   gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:'pending'};
   wrap.classList.add('calendar-pointer-down');
  },{capture:true});
  document.addEventListener('pointermove',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
   if(gesture.mode==='pending'&&(Math.abs(dx)>START_THRESHOLD||Math.abs(dy)>START_THRESHOLD))
    gesture.mode=Math.abs(dx)>Math.abs(dy)*1.15?'horizontal':'vertical';
   if(gesture.mode==='horizontal'){e.preventDefault();wrap.classList.add('calendar-dragging')}
  },{capture:true,passive:false});
  document.addEventListener('pointerup',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const dx=e.clientX-gesture.x,mode=gesture.mode;
   gesture=null;wrap.classList.remove('calendar-pointer-down','calendar-dragging');
   if(mode==='horizontal'&&Math.abs(dx)>=THRESHOLD)page(dx);
  },{capture:true});
  document.addEventListener('pointercancel',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   gesture=null;wrap.classList.remove('calendar-pointer-down','calendar-dragging');
  },{capture:true});
  wrap.addEventListener('click',e=>{
   if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
  },true);
 }
 const observer=new MutationObserver(attach);
 observer.observe(document.getElementById('main')||document.body,{childList:true,subtree:true});
 attach();
})();