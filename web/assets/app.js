/* Cyberpunk Diary — offline-first. No frontend dependencies. */
(() => {
'use strict';
const STORE='cyberpunkDiary.v4', OLD='cyberpunkDiary.v2';
const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const two=x=>String(x).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;
const now=()=>iso(new Date());
const stamp=()=>new Date().toISOString();
const parse=d=>new Date(`${d}T12:00:00`);
const shift=(d,n)=>{const x=parse(d);x.setDate(x.getDate()+n);return iso(x)};
const weekStart=d=>shift(d,-((parse(d).getDay()+6)%7));
const addMonth=(d,n)=>{const x=parse(d);x.setDate(1);x.setMonth(x.getMonth()+n);return iso(x)};
const display=(d,opts={day:'2-digit',month:'short'})=>parse(d).toLocaleDateString('pt-BR',opts);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const themes=['carbon','soulkiller','cyberpunk','midnight','synthwave'];
const fresh=()=>({version:4,deviceId:uid(),tasks:[],notes:[],habits:[],deleted:{tasks:{},notes:{},habits:{}},settings:{theme:'carbon',mode:'now',selected:now(),showDayInWeek:false,showDayInMonth:false,showWeekInMonth:false},sync:{room:'',server:'',auto:false}});
let db;
try{db=JSON.parse(localStorage.getItem(STORE)||'null');if(!db){db=fresh();let prev=JSON.parse(localStorage.getItem(OLD)||'null');if(prev?.profiles?.length){const p=prev.profiles.find(p=>p.id===prev.active)||prev.profiles[0];db.tasks=(p.data?.tasks||[]).map(t=>({id:t.id||uid(),title:t.title||'Tarefa',tags:[t.category].filter(Boolean),frequency:t.recurrence==='daily'?'daily':t.recurrence==='custom'?'weekdays':t.recurrence==='weekly'?'weekdays':'once',weekdays:t.recurrence==='weekly'?[parse(t.startDate||t.date||now()).getDay()]:t.weekdays||[],startDate:t.startDate||t.date||now(),endDate:t.endDate||'',startTime:t.time||'',endTime:'',notes:t.description||'',completed:t.completed||[],done:!!t.done,updated:stamp()}));db.notes=(p.data?.notes||[]).map(n=>({id:n.id||uid(),title:n.title||'',body:n.body||'',date:n.date||now(),updated:stamp()}));db.settings.theme=p.data?.theme||'carbon';db.settings.mode=p.data?.calendarMode||'day';db.settings.selected=p.data?.selectedDate||now();}}}catch(e){console.warn('Storage error',e);db=fresh()}
db={...fresh(),...db,settings:{...fresh().settings,...db.settings},sync:{...fresh().sync,...db.sync},deleted:{tasks:{},notes:{},habits:{},...(db.deleted||{})}};
db.habits=Array.isArray(db.habits)?db.habits:[];db.deleted.habits=db.deleted.habits||{};
if(!themes.includes(db.settings.theme))db.settings.theme='carbon';
let selectedNote=null, expandedDay=null, panelDay=null, tagController=new AbortController(), saveDebounce, taskSaveDebounce, flushTaskDraft=null, toastTimer, socket=null, peers=new Map(), syncState='Desconectado', syncWanted=false;
function persist(publish=true){try{localStorage.setItem(STORE,JSON.stringify(db));if(publish)broadcast();return true}catch(e){toast('Falha ao salvar. Exporte um backup.');console.error(e);return false}}
function touch(obj){obj.updated=stamp();persist()}
function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2900)}
function due(t,d){if(t.deleted||(t.closedOn&&d>t.closedOn)||d<(t.startDate||now())||(t.endDate&&d>t.endDate))return false;switch(t.frequency){case'daily':return true;case'weekdays':return (t.weekdays||[]).map(Number).includes(parse(d).getDay());case'monthly':return Number(d.slice(8))===Number(t.startDate.slice(8));case'yearly':return d.slice(5)===t.startDate.slice(5);default:return d===t.startDate}}
function isDone(t,d){return t.frequency==='once'?!!t.done:(t.completed||[]).includes(d)}
function forDay(d,completed=true){return db.tasks.filter(t=>due(t,d)&&(completed||!isDone(t,d))).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')||a.title.localeCompare(b.title))}
function activeCount(d){return forDay(d,false).length}
function descriptionCard(kind,id,raw){
  if(!String(raw||'').trim())return '';
  return `<div class="rendered-description markdown-content" data-description-kind="${kind}" data-description-id="${esc(id)}">${taskMarkdownHTML(raw)}</div>`;
}
function taskHtml(t,d){const done=isDone(t,d),tags=tagHtml(t.tags),time=[t.startTime,t.endTime].filter(Boolean).join(' — ');return `<div class="task ${done?'done':''}"><input type="checkbox" data-check="${esc(t.id)}" data-date="${esc(d)}" ${done?'checked':''} aria-label="Concluir ${esc(t.title)}"><div class="task-detail"><button class="task-body task-open" data-edit="${esc(t.id)}" data-date="${esc(d)}" aria-label="Editar ${esc(t.title)}"><span class="task-title">${esc(t.title)}</span><span class="task-sub">${time?`<time>${esc(time)}</time>`:''}${tags}</span></button>${descriptionCard('task',t.id,t.notes)}</div></div>`}

function tagHtml(tags){return (tags||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}
function notesOn(d){return db.notes.filter(n=>n.date===d).sort((a,b)=>(a.title||'').localeCompare(b.title||''))}
function shortMD(md){return (md||'').replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/[*_`>\[\]()]/g,'').slice(0,115)}
function calendarItems(d){return forDay(d).map(t=>`<div class="calendar-event ${isDone(t,d)?'done':''}"><input type="checkbox" data-check="${esc(t.id)}" data-date="${esc(d)}" ${isDone(t,d)?'checked':''} aria-label="Concluir ${esc(t.title)}"><div class="calendar-event-detail"><button class="event-open" data-edit="${esc(t.id)}" data-date="${esc(d)}" aria-label="Editar ${esc(t.title)}"><span class="event-title">${esc(t.title)}</span><span class="event-meta">${t.startTime||t.endTime?`<time>${esc([t.startTime,t.endTime].filter(Boolean).join(' – '))}</time>`:''}${tagHtml(t.tags)}</span></button>${descriptionCard('task',t.id,t.notes)}</div></div>`).join('')}

function taskList(d){const a=forDay(d);return `<div class="items">${a.map(t=>taskHtml(t,d)).join('')}${!a.length?`<button type="button" class="empty-action" data-add-on="${d}">Nenhuma tarefa <span>Criar tarefa</span></button>`:''}</div>`}
function setupTagPicker(initial){
  const search=$('#tagSearch'),selected=$('#chosenTags'),box=$('#tagSuggestions'),hidden=$('#taskTags');
  if(!search||!box)return;
  const picker=search.closest('.tag-picker'),chosen=new Set(initial||[]);
  const known=[...new Set(db.tasks.flatMap(t=>t.tags||[]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const signal=tagController.signal;
  const hide=()=>{box.hidden=true;search.setAttribute('aria-expanded','false')};
  const sync=()=>{
    const previous=hidden.value;
    hidden.value=[...chosen].join(', ');
    if(previous!==hidden.value)hidden.dispatchEvent(new Event('input',{bubbles:true}));
    selected.innerHTML=[...chosen].map(x=>`<button type="button" class="tag removable" data-remove-tag="${esc(x)}" aria-label="Remover tag ${esc(x)}">${esc(x)} ×</button>`).join('');
  };
  const show=()=>{
    const q=search.value.trim();
    const items=known.filter(x=>!chosen.has(x)&&x.toLowerCase().includes(q.toLowerCase())).slice(0,9);
    if(q&&!chosen.has(q)&&!known.some(x=>x.toLowerCase()===q.toLowerCase()))items.unshift(q);
    box.innerHTML=items.map(x=>`<button type="button" data-choose-tag="${esc(x)}">${esc(x)}${known.includes(x)?'':' · Criar'}</button>`).join('');
    box.hidden=!items.length;
    search.setAttribute('aria-expanded',String(!!items.length));
  };
  const add=x=>{
    x=String(x||'').trim().slice(0,40);
    if(!x)return;
    if(chosen.size>=15&&!chosen.has(x)){toast('Limite de 15 tags');hide();return}
    chosen.add(x);
    search.value='';
    sync();
    hide(); // seleção termina a interação; não abrir novamente por foco automático
    search.blur();
  };
  search.setAttribute('aria-expanded','false');
  search.setAttribute('aria-controls','tagSuggestions');
  search.addEventListener('input',show,{signal});
  search.addEventListener('focus',show,{signal});
  search.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===','){
      e.preventDefault();
      const v=box.hidden?search.value:(box.querySelector('[data-choose-tag]')?.dataset.chooseTag||search.value);
      add(v);
    } else if(e.key==='Escape'){
      e.preventDefault();hide();search.blur();
    }
  },{signal});
  box.addEventListener('pointerdown',e=>{if(e.target.closest('[data-choose-tag]'))e.preventDefault()},{signal});
  box.addEventListener('click',e=>{
    const v=e.target.closest('[data-choose-tag]')?.dataset.chooseTag;
    if(v)add(v);
  },{signal});
  selected.addEventListener('click',e=>{
    const v=e.target.closest('[data-remove-tag]')?.dataset.removeTag;
    if(v){chosen.delete(v);sync();hide()}
  },{signal});
  document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))hide()},{signal,capture:true});
  search.addEventListener('blur',()=>{
    queueMicrotask(()=>{if(!picker.contains(document.activeElement))hide()});
  },{signal});
  sync();hide();
}

function nav(d){const mode=db.settings.mode;const v=mode==='month'?display(d,{month:'long',year:'numeric'}):mode==='week'?`${display(weekStart(d))} — ${display(shift(weekStart(d),6))}`:display(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'});return `<div class="toolbar"><div class="toolbar-left"><button class="small" data-step="-1" aria-label="Anterior">‹</button><button class="small" data-today>Hoje</button><button class="small" data-step="1" aria-label="Próximo">›</button><strong>${esc(v)}</strong></div><div class="toolbar-right"><input aria-label="Ir para data" type="date" id="jump" value="${esc(d)}" class="small"></div></div>`}
function formatRemaining(ms){
  const minutes=Math.max(0,Math.ceil(ms/60000));
  if(minutes<60)return `em ${minutes} min`;
  const hours=Math.floor(minutes/60), rem=minutes%60;
  if(hours<24)return `em ${hours}h${rem?` ${rem}min`:''}`;
  const days=Math.floor(hours/24), extra=hours%24;
  return `em ${days}d${extra?` ${extra}h`:''}`;
}
function renderNow(){
  const instant=new Date(),today=iso(instant), clock=two(instant.getHours())+':'+two(instant.getMinutes());
  const currentMinute=instant.getHours()*60+instant.getMinutes();
  const running=forDay(today,false).filter(t=>{
    if(!t.startTime)return false; // Sem horário de início não há intervalo verificável.
    const [h,m]=t.startTime.split(':').map(Number), start=h*60+m;
    // Sem fim explícito, a tarefa é pontual e fica em Agora durante o minuto inicial.
    const [eh,em]=(t.endTime||t.startTime).split(':').map(Number);
    const end=t.endTime?eh*60+em:start+1;
    return currentMinute>=start&&currentMinute<end;
  });
  const next=[];
  // Procura as próximas ocorrências por até 30 dias, incluindo tarefas recorrentes.
  for(let offset=0;offset<=30;offset++){
    const day=shift(today,offset);
    for(const task of forDay(day,false)){
      if(!task.startTime)continue;
      const [hh,mm]=task.startTime.split(':').map(Number);
      const start=parse(day);start.setHours(hh,mm,0,0);
      if(start.getTime()<=instant.getTime())continue;
      next.push({task,day,at:start.getTime()});
    }
  }
  next.sort((a,b)=>a.at-b.at||a.task.title.localeCompare(b.task.title));
  const nearest=next[0]?.at;
  const soon=next.filter(x=>x.at===nearest);
  const cards=running.map(t=>taskHtml(t,today)).join('');
  const forecast=soon.map(({task,day,at})=>`<div class="now-next-row"><button class="now-next-task" data-edit="${esc(task.id)}" data-date="${esc(day)}"><strong>${esc(task.title)}</strong><span>${esc(display(day,{weekday:'short',day:'numeric',month:'short'}))} · ${esc(task.startTime)}${task.endTime?' – '+esc(task.endTime):''}</span>${tagHtml(task.tags)}</button><span class="now-countdown">${formatRemaining(at-instant.getTime())}</span></div>`).join('');
  return `<div class="now-heading"><div><h1>Agora</h1><p>${esc(display(today,{weekday:'long',day:'numeric',month:'long'}))} · ${esc(clock)}</p></div><button class="square-add" data-add-on="${today}" title="Nova tarefa" aria-label="Criar tarefa">＋</button></div><div class="now-sections"><section class="now-group now-current"><div class="now-group-head"><h2>Em andamento</h2><span>${running.length}</span></div>${cards?`<div class="items">${cards}</div>`:'<div class="now-quiet">Nenhuma tarefa neste momento.</div>'}</section><section class="now-group now-next"><div class="now-group-head"><h2>Próximas</h2><span>${soon.length||'—'}</span></div>${forecast||'<div class="now-quiet">Nenhuma tarefa programada nos próximos 30 dias.</div>'}</section></div>`;
}


// Habit completion belongs to each date, not to the habit as a whole.
function habitDone(h,d=now()){return (h.doneDates||[]).includes(d)}
function habitStreak(h,d=now()){
 const done=new Set(h.doneDates||[]);let current=done.has(d)?d:shift(d,-1),count=0;
 while(count<3660&&done.has(current)){count++;current=shift(current,-1)}
 return count;
}
function habitTime(h){const start=h.startTime||h.time||'',end=h.endTime||'';return start&&end?`${start} – ${end}`:start?`Início ${start}`:end?`Até ${end}`:''}
const HABIT_WEEKDAYS=[1,2,3,4,5,6,0];
const HABIT_WEEKDAY_LABELS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
// Existing habits without a weekdays field remain daily for backwards compatibility.
function habitScheduled(h,d){return !Array.isArray(h.weekdays)||h.weekdays.map(Number).includes(parse(d).getDay())}
function habitList(d=now()){
 const active=db.habits.filter(h=>!h.archived).sort((a,b)=>{
  const aScheduled=habitScheduled(a,d)?0:1,bScheduled=habitScheduled(b,d)?0:1;
  return aScheduled-bScheduled||(a.startTime||a.time||'99:99').localeCompare(b.startTime||b.time||'99:99')||a.title.localeCompare(b.title);
 });
 const monday=weekStart(d),days=HABIT_WEEKDAYS.map((_,i)=>shift(monday,i));
 return active.map(h=>{
   const scheduled=habitScheduled(h,d),complete=scheduled&&habitDone(h,d),streak=habitStreak(h,d);
   const week=days.map((date,i)=>{const planned=habitScheduled(h,date),done=habitDone(h,date);return `<span class="habit-day ${done&&planned?'checked':''} ${date===d?'today':''} ${!planned?'off-day':''}" title="${esc(display(date,{weekday:'long',day:'numeric',month:'long'}))}${planned?(done?' · concluído':' · programado'):' · descanso'}"><span>${HABIT_WEEKDAY_LABELS[i]}</span><span class="habit-day-mark">${!planned?'–':done?'✓':'·'}</span></span>`}).join('');
   const schedule=HABIT_WEEKDAYS.filter(day=>habitScheduled(h,shift(monday,(day+6)%7))).map(day=>dayNames[day]).join(' · ');
   return `<article class="habit-card ${complete?'is-done':''} ${!scheduled?'habit-off':''}"><div class="habit-card-main"><input type="checkbox" data-habit-check="${esc(h.id)}" data-date="${esc(d)}" ${complete?'checked':''} ${!scheduled?'disabled':''} aria-label="${complete?'Desmarcar':'Concluir'} ${esc(h.title)}"><button type="button" class="habit-open" data-habit-edit="${esc(h.id)}"><strong>${esc(h.title)}</strong><span class="habit-meta">${habitTime(h)?`<time>${esc(habitTime(h))}</time>`:''}${tagHtml(h.tags)}</span><span class="habit-schedule">${scheduled?'':'Não programado hoje · '}${esc(schedule||'Nenhum dia')}</span></button>${h.description?`<div class="habit-description-wrap">${descriptionCard('habit',h.id,h.description)}</div>`:''}${streak?`<span class="habit-streak" title="Dias consecutivos concluídos">↗ ${streak}d</span>`:''}</div><div class="habit-week" aria-label="Semana de segunda a domingo">${week}</div></article>`;
 }).join('');
}
function renderHabits(){
 const d=now(),active=db.habits.filter(h=>!h.archived),today=active.filter(h=>habitScheduled(h,d)),done=today.filter(h=>habitDone(h,d)).length;
 const empty=`<button type="button" class="empty-action empty-habit" data-habit-new aria-label="Criar primeiro hábito"><span class="empty-title">Nenhum hábito criado</span><span class="empty-subtitle">Clique para criar</span></button>`;
 const create=`<button type="button" class="inline-create-row" data-habit-new aria-label="Criar hábito">Criar hábito</button>`;
 const pct=today.length?Math.round(100*done/today.length):0;
 return `<div class="toolbar habits-heading"><strong>Hábitos</strong><span class="habit-count">${done} de ${today.length} hoje</span></div><section class="panel habits-panel"><div class="habit-progress"><div class="habit-progress-head"><span>${esc(display(d,{weekday:'long',day:'numeric',month:'long'}))}</span><strong>${pct}%</strong></div><div class="habit-bar" role="progressbar" aria-label="Hábitos concluídos hoje" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div></div><div class="habit-cards">${active.length?habitList(d)+create:empty}</div></section>`;
}
function habitForm(id){
 const h=db.habits.find(x=>x.id===id);
 const days=Array.isArray(h?.weekdays)?h.weekdays.map(Number):HABIT_WEEKDAYS;
 const daySelector=HABIT_WEEKDAYS.map((day,i)=>`<label class="habit-weekday"><input type="checkbox" name="weekdays" value="${day}" ${days.includes(day)?'checked':''}><span>${HABIT_WEEKDAY_LABELS[i]}</span></label>`).join('');
 modal(h?'Hábito':'Novo hábito',`<form id="habitForm" class="habit-form"><fieldset class="habit-weekday-field"><legend>Dias da semana</legend><div class="habit-weekday-list">${daySelector}</div><small>Marque os dias em que o hábito deve aparecer. Por padrão, todos.</small></fieldset><label>Nome<input name="title" id="habitTitle" maxlength="120" required value="${esc(h?.title||'')}" placeholder="Nome do hábito" autocomplete="off"></label><div class="habit-time-fields"><label>Início<input name="startTime" type="time" value="${esc(h?.startTime||h?.time||'')}"></label><label>Fim<input name="endTime" type="time" value="${esc(h?.endTime||'')}"></label></div><div class="habit-md-field"><label for="habitDescription">Descrição</label>${taskMarkdownToolbar()}<textarea name="description" id="habitDescription" hidden>${esc(h?.description||'')}</textarea><div id="habitMarkdownPreview" class="rich-description markdown-content" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" aria-label="Descrição do hábito, editor visual Markdown" data-placeholder="Escreva aqui…">${taskMarkdownHTML(h?.description||'')}</div></div><label>Tags<input name="tags" value="${esc((h?.tags||[]).join(', '))}" placeholder="Separadas por vírgula"></label><div class="editor-status" id="habitStatus" role="status">Salvamento automático</div><footer>${h?`<button type="button" class="small" data-habit-delete="${esc(h.id)}">Excluir</button>`:''}<button type="button" data-close>Fechar</button></footer></form>`);
 const form=$('#habitForm');habitMarkdownSetup(form);let rec=h,timer;
 const save=()=>{
  if(!form.isConnected)return;
  const f=new FormData(form),title=String(f.get('title')||'').trim();if(!title)return;
  const startTime=String(f.get('startTime')||''),endTime=String(f.get('endTime')||'');
  // Sunday is 0 (native Date.getDay), Monday through Saturday are 1–6.
  const weekdays=f.getAll('weekdays').map(Number);
  if(!rec){rec={id:uid(),doneDates:[],updated:stamp()};db.habits.push(rec)}
  Object.assign(rec,{title,startTime,endTime,time:startTime,weekdays,description:String(f.get('description')||'').trim(),tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),updated:stamp()});
  persist();$('#habitStatus').textContent='✓ Salvo automaticamente';
 };
 form.addEventListener('input',()=>{clearTimeout(timer);$('#habitStatus').textContent='Salvando…';timer=setTimeout(save,300)});
 form.addEventListener('change',()=>{clearTimeout(timer);save()});
 flushHabit=()=>{clearTimeout(timer);save()};
}
let flushHabit=null;
function toggleHabit(id,date,checked){const h=db.habits.find(x=>x.id===id);if(!h||!habitScheduled(h,date))return;const dates=new Set(h.doneDates||[]);if(checked)dates.add(date);else dates.delete(date);h.doneDates=[...dates].sort();touch(h);render()}
// Nonessential contextual data: fail closed and retain last successful cached values.
const INFO_CACHE='cyberpunkDiary.context.v1';
let context={holidays:{},weather:{},city:'',lat:null,lon:null,updated:'',locationMode:'auto',geoLast:0,current:null};try{const stored=JSON.parse(localStorage.getItem(INFO_CACHE)||'{}');context={...context,...stored};if(stored.city&&!stored.locationMode)context.locationMode='manual'}catch{}
const saveContext=()=>{try{localStorage.setItem(INFO_CACHE,JSON.stringify(context))}catch(e){console.warn('Cache do clima:',e)}};
const infoIcon=code=>code===0?'☀':[1,2].includes(code)?'⛅':code===3?'☁':[45,48].includes(code)?'🌫':[51,53,55,61,63,65,80,81,82].includes(code)?'🌧':[71,73,75,77,85,86].includes(code)?'❄':code>=95?'⛈':'·';
// Orientações gerais: nenhuma categoria indica funcionamento confirmado de uma instituição.
function holidaySummary(date){
 const names=context.holidays[date]||[];
 if(!names.length)return '';
 return `<button type="button" class="holiday-impact" data-holiday-date="${esc(date)}" title="Ver impacto provável do feriado em aulas e serviços" aria-label="Ver funcionamento provável no feriado: ${esc(names.join(', '))}">🎓 Aulas: provável pausa · 🏬 Comércio: consultar</button>`;
}
function holidayDetails(date){
 const names=context.holidays[date]||[];
 if(!names.length)return;
 modal('Feriado · '+display(date,{day:'numeric',month:'long',year:'numeric'}),`<div class="holiday-details">
  <strong class="holiday-label">✦ ${esc(names.join(' · '))}</strong>
  <div class="holiday-impact-row"><strong>🎓 Aulas</strong><span>Geralmente suspensas. Confirme o calendário da escola ou universidade.</span></div>
  <div class="holiday-impact-row"><strong>🏬 Comércio</strong><span>Pode abrir ou fechar, conforme legislação local, acordo coletivo e estabelecimento.</span></div>
  <div class="holiday-impact-row"><strong>🏦 Bancos</strong><span>Em feriado nacional, agências geralmente fechadas. Serviços digitais podem funcionar.</span></div>
  <div class="holiday-impact-row"><strong>🏛 Serviços públicos</strong><span>Repartições geralmente fechadas; serviços essenciais costumam continuar.</span></div>
  <div class="holiday-impact-row"><strong>🏥 Saúde e emergência</strong><span>Emergências mantêm atendimento; consultas e serviços eletivos variam.</span></div>
  <p class="holiday-disclaimer">Informações indicativas para feriados nacionais do Brasil. Não são horários confirmados. Feriados estaduais, municipais e pontos facultativos podem ter regras diferentes.</p>
 </div>`);
}
function contextualDay(d){const holidays=context.holidays[d]||[],w=context.weather[d];return `${holidays.map(h=>`<span class="context-chip holiday-chip" title="Feriado: ${esc(h)}">✦ ${esc(h)}</span>`).join('')}${w?`<span class="context-chip weather-chip" title="${w.source==='history'?'Histórico meteorológico':'Previsão'} para ${esc(d)}: ${esc(w.min)}–${esc(w.max)} °C${Number.isFinite(w.rain)?', chuva '+w.rain+'%':''}"><span class="weather-symbol" aria-hidden="true">${infoIcon(w.code)}</span> ${esc(w.min)}°–${esc(w.max)}°${Number.isFinite(w.rain)?` · ☂ ${esc(w.rain)}%`:''}</span>`:''}${d===now()&&context.current&&Number.isFinite(context.current.temp)?`<span class="context-chip weather-chip" title="Temperatura atual em ${esc(context.city)}">Agora ${esc(Math.round(context.current.temp))}°C${Number.isFinite(context.current.humidity)?` · umidade ${esc(Math.round(context.current.humidity))}%`:''}${Number.isFinite(context.current.wind)?` · vento ${esc(Math.round(context.current.wind))} km/h`:''}</span>`:''}`}
function contextLine(d){const badges=contextualDay(d);return badges?`<div class="context-line">${badges}</div>`:''}
function compactWeather(d){const w=context.weather[d];if(!w||!Number.isFinite(w.min)||!Number.isFinite(w.max))return '';const isToday=d===now(),current=isToday&&Number.isFinite(context.current?.temp);return `<span class="weather-inline" title="${esc(context.city||'Localização atual')}: ${current?'agora '+Math.round(context.current.temp)+'°C · ':''}${w.source==='history'?'histórico · ':''}mínima ${esc(w.min)}°C, máxima ${esc(w.max)}°C${Number.isFinite(w.rain)?', chance de chuva '+w.rain+'%':''}"><span class="weather-symbol" aria-hidden="true">${infoIcon(w.code)}</span> <span>${current?`${esc(Math.round(context.current.temp))}° · `:''}${esc(w.min)}°/${esc(w.max)}°</span></span>`}
function weatherHeadingIcon(d){const w=context.weather[d];return w&&Number.isFinite(w.min)&&Number.isFinite(w.max)?`<span class="heading-weather-symbol" aria-label="Condição meteorológica" title="Clima do dia">${infoIcon(w.code)}</span>`:''}
function weatherCityHint(){return context.city?'':`<button type="button" class="weather-setup" data-city-open title="Ativar localização ou escolher cidade">☁ Ativar clima local</button>`}
let contextLoading=false,geolocationInFlight=false;
const weatherRequestKey=()=>`${Number(context.lat).toFixed(3)}:${Number(context.lon).toFixed(3)}`;
function visibleWeatherRange(){
 const d=db.settings.selected||now();
 if(db.settings.mode==='month'){
   const first=d.slice(0,7)+'-01',start=shift(first,-((parse(first).getDay()+6)%7));
   return [start,shift(start,41)];
 }
 if(db.settings.mode==='week'){const start=weekStart(d);return [start,shift(start,6)]}
 return [d,d];
}
function recordDaily(daily,source){
 (daily.time||[]).forEach((d,i)=>{
  const lo=daily.temperature_2m_min?.[i],hi=daily.temperature_2m_max?.[i];
  if(!Number.isFinite(lo)||!Number.isFinite(hi))return;
  const rain=daily.precipitation_probability_max?.[i];
  context.weather[d]={code:daily.weather_code?.[i],min:Math.round(lo),max:Math.round(hi),rain:Number.isFinite(rain)?Math.round(rain):null,source};
 });
}
async function loadContext(force=false){
 if(contextLoading||!navigator.onLine)return;
 const [rangeStart,rangeEnd]=visibleWeatherRange(),y=Number(rangeStart.slice(0,4));
 const years=[...new Set([y,Number(rangeEnd.slice(0,4)),Number(now().slice(0,4))])];
 const stale=Date.now()-(Date.parse(context.updated||0)||0)>60*60000;
 const locationReady=Number.isFinite(context.lat)&&Number.isFinite(context.lon);
 // Forecast refreshes hourly. Historical months are requested only once per location.
 const historicalCutoff=shift(now(),-8);
 const historyEnd=rangeEnd<historicalCutoff?rangeEnd:historicalCutoff;
 const historicalRequired=locationReady&&rangeStart<=historyEnd;
 const monthKey=locationReady?`${weatherRequestKey()}:${rangeStart}:${historyEnd}`:'';
 const historyPending=historicalRequired&&!context.historyLoaded?.[monthKey];
 const holidaysPending=years.some(year=>!context.holidayYears?.includes(year));
 if(!force&&!stale&&!historyPending&&!holidaysPending)return;
 contextLoading=true;
 try{
  await Promise.all(years.map(async year=>{
   if(context.holidayYears?.includes(year)&&!force)return;
   try{
    const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`,{signal:AbortSignal.timeout(9500)});
    if(!r.ok)throw Error('Feriados indisponíveis');
    for(const h of await r.json())if(h.date)context.holidays[h.date]=[...new Set([...(context.holidays[h.date]||[]),h.localName||h.name])];
    context.holidayYears=[...new Set([...(context.holidayYears||[]),year])];
   }catch(e){console.warn('Feriados:',e.message)}
  }));
  if(locationReady){
   if(force||stale||!context.current){
    try{
     const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(context.lat)}&longitude=${encodeURIComponent(context.lon)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&past_days=7&forecast_days=16&timezone=auto`;
     const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Previsão indisponível');
     const data=await r.json(),live=data.current||{};
     recordDaily(data.daily||{},'forecast');
     context.current={temp:live.temperature_2m,feels:live.apparent_temperature,humidity:live.relative_humidity_2m,wind:live.wind_speed_10m,code:live.weather_code,time:live.time};
     context.updated=new Date().toISOString();
    }catch(e){console.warn('Previsão:',e.message)}
   }
   if(historyPending||force&&historicalRequired){
    try{
     const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(context.lat)}&longitude=${encodeURIComponent(context.lon)}&start_date=${rangeStart}&end_date=${historyEnd}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
     const r=await fetch(url,{signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error('Histórico indisponível');
     recordDaily((await r.json()).daily||{},'history');
     context.historyLoaded={...(context.historyLoaded||{}),[monthKey]:Date.now()};
    }catch(e){console.warn('Histórico:',e.message)}
   }
  }
  saveContext();if(['day','week','month'].includes(db.settings.mode)&&$('#overlay').hidden)render();
 }finally{contextLoading=false}
}
function locateForWeather(initiatedByUser=false){
 if(geolocationInFlight)return;
 if(!navigator.geolocation||!window.isSecureContext){if(initiatedByUser)toast('GPS requer HTTPS ou localhost. Informe a cidade.');return}
 geolocationInFlight=true;
 const status=$('#cityStatus');if(status)status.textContent='Obtendo localização…';
 navigator.geolocation.getCurrentPosition(pos=>{
  geolocationInFlight=false;const lat=pos.coords.latitude,lon=pos.coords.longitude;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  const moved=!Number.isFinite(context.lat)||!Number.isFinite(context.lon)||Math.abs(context.lat-lat)>.02||Math.abs(context.lon-lon)>.02;
  context.lat=lat;context.lon=lon;context.locationMode='auto';context.geoLast=Date.now();context.city='Localização atual (GPS)';
  if(moved){context.weather={};context.historyLoaded={}}context.updated='';saveContext();
  if($('#overlay')&&!$('#overlay').hidden)close();if(initiatedByUser)toast('Localização ativada');loadContext(true);render();
 },err=>{
  geolocationInFlight=false;const msg=err.code===1?'Permissão de localização negada. Informe a cidade.':err.code===2?'Localização indisponível. Informe a cidade.':'GPS demorou a responder. Tente novamente.';
  if(err.code===1){context.locationMode='manual';saveContext()}
  const el=$('#cityStatus');if(el)el.textContent=msg;
  if(initiatedByUser)toast(msg);
 },{enableHighAccuracy:false,maximumAge:30*60*1000,timeout:12000});
}
async function enableAutomaticLocation(){
 if(context.locationMode==='manual')return;
 if(!navigator.geolocation||!window.isSecureContext)return;
 if(Number.isFinite(context.lat)&&Number.isFinite(context.lon)&&Date.now()-(context.geoLast||0)<60*60000)return;
 try{if(navigator.permissions?.query){const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state==='denied'){context.locationMode='manual';saveContext();return}}}catch{}
 locateForWeather(false);
}
async function selectCity(city){city=city.trim();if(city.length<2)return toast('Informe uma cidade');const status=$('#cityStatus');if(status)status.textContent='Buscando…';try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=pt&format=json`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Busca indisponível');const candidates=(await r.json()).results||[];const place=candidates.find(p=>p.country_code==='BR')||candidates[0];if(!place)throw Error('Cidade não encontrada');context.city=`${place.name}, ${place.admin1||place.country}`;context.lat=place.latitude;context.lon=place.longitude;context.locationMode='manual';context.geoLast=0;context.weather={};context.historyLoaded={};context.updated='';saveContext();close();toast(`Clima: ${context.city}`);loadContext(true)}catch(e){if(status)status.textContent=e.message}}
function cityModal(){const c=context.current;modal('Clima e feriados',`<div class="field"><p class="muted">${esc(context.city||'Localização não configurada')} · feriados nacionais do Brasil</p>${Number.isFinite(c?.temp)?`<p class="weather-current"><span class="weather-symbol" aria-hidden="true">${infoIcon(c.code)}</span> <strong>${esc(Math.round(c.temp))}°C</strong> agora${Number.isFinite(c.feels)?` · sensação ${esc(Math.round(c.feels))}°C`:''}${Number.isFinite(c.humidity)?` · umidade ${esc(c.humidity)}%`:''}${Number.isFinite(c.wind)?` · vento ${esc(Math.round(c.wind))} km/h`:''}</p>`:''}<button class="geo-action" type="button" data-gps-activate>⌖ Usar localização automática (GPS)</button><label for="cityInput">Ou escolher cidade manualmente</label><input id="cityInput" value="${context.locationMode==='manual'?esc(context.city):''}" placeholder="Ex.: Rio de Janeiro" autocomplete="address-level2"><div class="editor-status" id="cityStatus" aria-live="polite"></div><p class="muted">O navegador solicitará permissão. Coordenadas ficam neste dispositivo e são enviadas apenas ao serviço de previsão do tempo.</p></div><footer><button class="small" data-city-save>Usar cidade</button><button class="small" data-city-clear>Desativar clima</button></footer>`)}

function renderDay(){const d=db.settings.selected;return `${nav(d)}<section class="panel day-list"><h2>${esc(display(d,{weekday:'long',day:'numeric',month:'long'}))} ${weatherHeadingIcon(d)} <span class="muted">· ${activeCount(d)} pendente(s)</span></h2>${weatherCityHint()}${contextLine(d)}${holidaySummary(d)}${taskList(d)}<div class="day-actions">${forDay(d).length?`<button class="inline-create-row" data-add-on="${d}" aria-label="Criar tarefa em ${esc(display(d))}">Criar tarefa</button>`:""}</div></section>`}
function renderWeek(){const start=weekStart(db.settings.selected);let html='<div class="week-wrap"><div class="week-grid">';for(let i=0;i<7;i++){const d=shift(start,i),items=calendarItems(d);html+=`<section class="week-col ${d===now()?'today':''}" data-create-on="${d}"><div class="week-head"><span class="week-title">${dayNames[parse(d).getDay()]} · ${esc(display(d))} ${weatherHeadingIcon(d)}</span>${compactWeather(d)}<button class="square-add" data-add-on="${d}" aria-label="Criar tarefa em ${esc(display(d))}" title="Nova tarefa">＋</button></div>${context.holidays[d]?.length?`<div class="context-line">${context.holidays[d].map(h=>`<span class="context-chip holiday-chip">✦ ${esc(h)}</span>`).join('')}</div>`:''}${holidaySummary(d)}<div class="cal-events">${items||`<button type="button" class="empty-calendar" data-add-on="${d}" aria-label="Criar tarefa">Criar tarefa</button>`}</div></section>`}return nav(db.settings.selected)+weatherCityHint()+html+'</div></div>'}
function renderMonth(){
  const d=db.settings.selected,first=d.slice(0,7)+'-01';
  const firstDay=(parse(first).getDay()+6)%7,start=shift(first,-firstDay);
  let html='<div class="panel month-panel"><div class="month-scroll" role="region" aria-label="Calendário mensal completo" tabindex="0"><div class="grid-month">';
  for(const name of ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'])html+=`<div class="weekday">${name}</div>`;
  for(let i=0;i<42;i++){
    const day=shift(start,i),other=day.slice(0,7)!==d.slice(0,7),events=calendarItems(day);
    html+=`<section class="daybox ${other?'other':''} ${day===now()?'today':''}" data-date="${day}" data-create-on="${day}">
      <div class="day-head"><div class="day-title-line"><span class="daynum">${Number(day.slice(8))}</span>${weatherHeadingIcon(day)}</div>${compactWeather(day)}</div>${context.holidays[day]?.length?`<div class="context-line">${context.holidays[day].map(h=>`<span class="context-chip holiday-chip" title="Feriado: ${esc(h)}">✦ ${esc(h)}</span>`).join('')}</div>`:''}${holidaySummary(day)}
      <button class="square-add month-add" data-add-on="${day}" title="Nova tarefa" aria-label="Criar tarefa em ${esc(display(day))}">＋</button>
      <div class="cal-events">${events||`<button type="button" class="empty-calendar" data-add-on="${day}" aria-label="Criar tarefa">Criar tarefa</button>`}</div>
    </section>`;
  }
  return nav(d)+weatherCityHint()+html+'</div></div></div>';
}

// Markdown é armazenado como texto e convertido somente para nós permitidos.
// Links HTTP(S) only. Escape user text and attributes before rendering.
// Linkificação local: não há chamadas externas para reconhecer URLs.
// Nunca cria href com esquemas executáveis (javascript:, data:, file: etc.).
const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?<![\w@/])(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:com\.br|com|org|net|edu|gov|io|dev|app|br|co|me|info|tech|site|online|ai|gg|xyz|uk|de|fr|jp|pt)(?:\/[^\s<>"'`]*)?/giu;
function safeLinkURL(value){
  try{
    let raw=String(value||'').replace(/&amp;/g,'&').trim();
    if(!/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) raw='https://'+raw;
    const u=new URL(raw);
    return ['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')?u.href:null;
  }catch{return null}
}
function linkPieces(raw){
  const pieces=[],source=String(raw||'');let offset=0;
  for(const match of source.matchAll(LINK_PATTERN)){
    const start=match.index,whole=match[0];
    if(start<offset)continue;
    // A pontuação e os parênteses de fechamento não fazem parte de URLs soltas.
    let url=whole;
    while(/[.,!?;:}\]]$/.test(url))url=url.slice(0,-1);
    while(url.endsWith(')')&&(url.match(/\)/g)||[]).length>(url.match(/\(/g)||[]).length)url=url.slice(0,-1);
    const href=safeLinkURL(url);
    if(!href||!url){continue}
    if(start>offset)pieces.push({text:source.slice(offset,start)});
    pieces.push({text:url,href});
    if(url.length<whole.length)pieces.push({text:whole.slice(url.length)});
    offset=start+whole.length;
  }
  if(offset<source.length)pieces.push({text:source.slice(offset)});
  return pieces.length?pieces:[{text:source}];
}
function inlineMD(raw){
  const links=[];
  // Preserva blocos de código e links explícitos antes de detectar URLs.
  const tokens=[];
  let content=String(raw||'').replace(/`([^`\n]+)`/g,(whole)=>{
    const token=`DIARYCODETOKEN${tokens.length}END`;tokens.push(`<code>${esc(whole.slice(1,-1))}</code>`);return token;
  });
  content=content.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi,(whole,label,url)=>{
    const href=safeLinkURL(url);if(!href)return whole;
    const token=`DIARYLINKTOKEN${links.length}END`;
    links.push(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="Abrir link">${esc(label)}</a>`);
    return token;
  });
  // Ignora os tokens já protegidos. O restante pode conter URLs sem Markdown.
  content=content.split(/(DIARY(?:LINK|CODE)TOKEN\d+END)/g).map(part=>{
    if(/^DIARY(?:LINK|CODE)TOKEN\d+END$/.test(part))return part;
    return linkPieces(part).map(item=>{
      if(!item.href)return item.text;
      const token=`DIARYLINKTOKEN${links.length}END`;
      links.push(`<a href="${esc(item.href)}" target="_blank" rel="noopener noreferrer" title="Abrir link">${esc(item.text)}</a>`);
      return token;
    }).join('');
  }).join('');
  return esc(content).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/DIARYLINKTOKEN(\d+)END/g,(_m,i)=>links[Number(i)]||'')
    .replace(/DIARYCODETOKEN(\d+)END/g,(_m,i)=>tokens[Number(i)]||'');
}
// No editor visual, transforma texto digitado/colado em anchors sem reinicializar
// contenteditable (evita perder foco, cursor e composição IME).
function linkifyRichEditor(root){
  if(!root)return false;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(!node.nodeValue||!LINK_PATTERN.test(node.nodeValue)){LINK_PATTERN.lastIndex=0;return NodeFilter.FILTER_REJECT}
    LINK_PATTERN.lastIndex=0;
    if(node.parentElement?.closest('a,code,pre,[contenteditable="false"]'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  let changed=false;
  for(const node of nodes){
    const parts=linkPieces(node.nodeValue);
    if(!parts.some(x=>x.href))continue;
    const fragment=document.createDocumentFragment();
    for(const part of parts){if(!part.href)fragment.appendChild(document.createTextNode(part.text));else{
      const anchor=document.createElement('a');anchor.href=part.href;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.textContent=part.text;fragment.appendChild(anchor);
    }}
    node.replaceWith(fragment);changed=true;
  }
  return changed;
}
function markdownHTML(raw){let out='',list='';const close=()=>{if(list){out+=`</${list}>`;list=''}};for(const line of String(raw||'').split('\n')){const h=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/),bullet=line.match(/^\s*[-*]\s+(.+)$/),numbered=line.match(/^\s*\d+[.)]\s+(.+)$/),quote=line.match(/^>\s?(.*)$/);if(bullet||numbered){const wanted=bullet?'ul':'ol';if(list!==wanted){close();list=wanted;out+=`<${list}>`}out+=`<li>${inlineMD((bullet||numbered)[1])}</li>`;continue}close();if(h)out+=`<h${h[1].length}>${inlineMD(h[2])}</h${h[1].length}>`;else if(quote)out+=`<blockquote>${inlineMD(quote[1])}</blockquote>`;else if(/^\s*---+\s*$/.test(line))out+='<hr>';else out+=line.trim()?`<p>${inlineMD(line)}</p>`:'<p><br></p>'}close();return out}

// Renderização de descrição de tarefa com checkboxes ligados ao Markdown original.
function taskMarkdownHTML(raw){
  let index=-1;
  const marked=String(raw||'').split('\n').map(line=>{
    index++;
    const match=line.match(/^(\s*[-*]\s+)\[([ xX])\](\s*)(.*)$/);
    if(!match)return line;
    return `- <input type="checkbox" class="task-md-checkbox" data-md-line="${index}" ${match[2].toLowerCase()==='x'?'checked':''} aria-label="Marcar item da descrição"> ${match[4]}`;
  }).join('\n');
  // Protect the generated checkbox HTML while escaping all user-authored Markdown.
  const tokens=[];
  const safe=marked.replace(/<input type="checkbox" class="task-md-checkbox" data-md-line="\d+" (?:checked )?aria-label="Marcar item da descrição">/g,m=>{tokens.push(m);return `TASKCHECKTOKEN${tokens.length-1}END`});
  return markdownHTML(safe).replace(/TASKCHECKTOKEN(\d+)END/g,(_m,i)=>tokens[Number(i)]||'');
}
function taskMarkdownToolbar(){return `<div class="task-md-tools" role="toolbar" aria-label="Formatar descrição"><button type="button" data-task-md="h1" title="Título grande">H1</button><button type="button" data-task-md="h2" title="Subtítulo">H2</button><button type="button" data-task-md="bold" title="Negrito"><strong>B</strong></button><button type="button" data-task-md="italic" title="Itálico"><em>I</em></button><button type="button" data-task-md="list" title="Lista">☷</button><button type="button" data-task-md="check" title="Checklist">☑</button><button type="button" data-task-md="quote" title="Citação">❞</button><button type="button" data-task-md="code" title="Código">&lt;/&gt;</button><button type="button" data-task-md="link" title="Inserir link" aria-label="Inserir link">🔗 Link</button></div>`}
// O texto visível é o editor. O textarea invisível é somente o espelho para FormData.
function richDescriptionMarkdown(root){
  const clean=s=>String(s||'').replace(/\u00a0/g,' ');
  function inline(node){
    if(node.nodeType===3)return clean(node.nodeValue);
    if(node.nodeType!==1)return '';
    const tag=node.tagName;
    if(tag==='INPUT'&&node.type==='checkbox')return node.checked?'[x] ':'[ ] ';
    if(tag==='BR')return '\n';
    const value=[...node.childNodes].map(inline).join('');
    if(tag==='A'){const url=safeLinkURL(node.getAttribute('href'));return url?'['+value+']('+url+')':value}
    if(tag==='STRONG'||tag==='B')return '**'+value+'**';
    if(tag==='EM'||tag==='I')return '*'+value+'*';
    if(tag==='CODE')return '`'+value+'`';
    return value;
  }
  function block(node){
    if(node.nodeType===3)return clean(node.nodeValue);
    if(node.nodeType!==1)return '';
    const tag=node.tagName;
    if(/^H[1-6]$/.test(tag))return '#'.repeat(Number(tag[1]))+' '+[...node.childNodes].map(inline).join('').trim();
    if(tag==='UL'||tag==='OL')return [...node.children].filter(x=>x.tagName==='LI').map((li,i)=>{
      const value=[...li.childNodes].map(inline).join('').trim();
      return tag==='OL'?`${i+1}. ${value}`:`- ${value}`;
    }).join('\n');
    if(tag==='BLOCKQUOTE')return [...node.childNodes].map(inline).join('').split('\n').map(x=>'> '+x).join('\n');
    if(tag==='HR')return '---';
    if(tag==='P'||tag==='DIV'){
      const value=[...node.childNodes].map(inline).join('').trimEnd();
      return /^\[[ x]\] /i.test(value)?'- '+value:value;
    }
    return inline(node);
  }
  return [...root.childNodes].map(block).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function richDescriptionSetup(form, sourceSelector, richSelector){
  const source=form.querySelector(sourceSelector),rich=form.querySelector(richSelector);
  if(!source||!rich)return;
  const sync=()=>{source.value=richDescriptionMarkdown(rich).slice(0,10000);source.dispatchEvent(new Event('input',{bubbles:true}))};
  rich.addEventListener('input',sync);
  rich.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]'))sync()});
  rich.addEventListener('focusout',e=>{if(!rich.contains(e.relatedTarget)){linkifyRichEditor(rich);sync()}});
  rich.addEventListener('keydown',e=>{
    if(e.key===' '&&!e.ctrlKey&&!e.metaKey){
      const selection=window.getSelection();if(!selection?.rangeCount||!selection.isCollapsed)return;
      let el=selection.anchorNode;while(el&&el.parentNode!==rich)el=el.parentNode;
      if(!el||el.nodeType!==1)return;
      const prefix=el.textContent.trim();const tag=/^#{1,6}$/.test(prefix)?'h'+prefix.length:prefix==='-'||prefix==='*'?'ul':prefix==='1.'?'ol':prefix==='>'?'blockquote':null;
      if(!tag)return;e.preventDefault();
      const item=document.createElement(tag==='ul'||tag==='ol'?'li':tag);item.appendChild(document.createElement('br'));
      if(tag==='ul'||tag==='ol'){const list=document.createElement(tag);list.appendChild(item);el.replaceWith(list)}else el.replaceWith(item);
      selectEnd(item);sync();
    }
    if((e.ctrlKey||e.metaKey)&&['b','i'].includes(e.key.toLowerCase())){
      e.preventDefault();document.execCommand(e.key.toLowerCase()==='b'?'bold':'italic',false,null);sync();
    }
  });
  rich.addEventListener('paste',e=>{
    e.preventDefault();const text=e.clipboardData?.getData('text/plain')||'';
    document.execCommand('insertText',false,text);sync();
  });
  form.querySelectorAll('[data-task-md]').forEach(button=>{
    button.addEventListener('mousedown',e=>e.preventDefault());
    button.addEventListener('click',()=>{
      const kind=button.dataset.taskMd;
      rich.focus();
      if(kind==='link'){
        const selection=window.getSelection();const selected=selection?.toString()||'';
        const input=window.prompt('Endereço do link (HTTPS)',/^https?:\/\//i.test(selected)?selected:'https://');
        if(input===null)return;const url=safeLinkURL(input);
        if(!url){toast('Informe uma URL HTTP ou HTTPS válida');return}
        const text=selected&&!/^https?:\/\//i.test(selected)?selected:url;
        if(selected)document.execCommand('insertText',false,text);
        else document.execCommand('insertText',false,text);
        // Substitui o texto recém-inserido por um link sem inserir HTML não confiável.
        const selection2=window.getSelection(),node=selection2?.anchorNode;
        if(node?.nodeType===3){
          const range=document.createRange(),end=selection2.anchorOffset,start=Math.max(0,end-text.length);
          range.setStart(node,start);range.setEnd(node,end);selection2.removeAllRanges();selection2.addRange(range);
          document.execCommand('createLink',false,url);
        }
      }else if(kind==='bold'||kind==='italic')document.execCommand(kind,false,null);
      else if(kind==='h1'||kind==='h2')document.execCommand('formatBlock',false,kind==='h1'?'h1':'h2');
      else if(kind==='list')document.execCommand('insertUnorderedList');
      else if(kind==='quote')document.execCommand('formatBlock',false,'blockquote');
      else if(kind==='code'){document.execCommand('insertText',false,'`código`')}
      else if(kind==='check'){
        document.execCommand('insertHTML',false,'<p><input type="checkbox" aria-label="Item da lista"> Item</p>');
      }
      sync();
    });
  });
  source.value=richDescriptionMarkdown(rich);
}
function taskMarkdownSetup(form){richDescriptionSetup(form,'#taskNotes','#taskMarkdownPreview')}
function habitMarkdownSetup(form){richDescriptionSetup(form,'#habitDescription','#habitMarkdownPreview')}

function editorMarkdown(el){if(!el)return'';const clean=t=>(t||'').replace(/\u00a0/g,' ');function inline(node){if(node.nodeType===3)return clean(node.textContent);if(node.nodeType!==1)return'';const tag=node.tagName,v=[...node.childNodes].map(inline).join('');if(tag==='STRONG'||tag==='B')return '**'+v+'**';if(tag==='EM'||tag==='I')return '*'+v+'*';if(tag==='CODE')return '`'+v+'`';if(tag==='A'){const href=node.getAttribute('href')||'';return /^https?:\/\//.test(href)?'['+v+']('+href+')':v}if(tag==='BR')return'\n';return v}function block(node){if(node.nodeType===3)return clean(node.textContent);if(node.nodeType!==1)return'';const tag=node.tagName;if(/^H[1-6]$/.test(tag))return '#'.repeat(Number(tag[1]))+' '+[...node.childNodes].map(inline).join('').replace(/\n+$/,'');if(tag==='UL'||tag==='OL')return [...node.children].filter(x=>x.tagName==='LI').map((li,i)=>(tag==='OL'?`${i+1}. `:'- ')+[...li.childNodes].map(inline).join('')).join('\n');if(tag==='P'||tag==='DIV')return [...node.childNodes].map(inline).join('').replace(/\n+$/,'');return inline(node)}return [...el.childNodes].map(block).join('\n').replace(/\n{4,}/g,'\n\n').trimEnd()}

function renderNotes(){if(!selectedNote||!db.notes.some(n=>n.id===selectedNote))selectedNote=db.notes.slice().sort((a,b)=>(b.updated||'').localeCompare(a.updated||''))[0]?.id||null;const n=db.notes.find(x=>x.id===selectedNote);const frequency=n?.frequency||'once';return `<div class="toolbar"><strong>Notas <span class="muted">${db.notes.length}</span></strong><button class="inline-create-row note-create" data-newnote>Criar nota</button></div><div class="notes-layout"><div class="panel notes-list">${db.notes.length?db.notes.slice().sort((a,b)=>(b.updated||'').localeCompare(a.updated||'')).map(x=>`<button class="note-row ${selectedNote===x.id?'active':''}" data-note="${esc(x.id)}"><strong>${esc(x.title||shortMD(x.body).split('\n')[0]||'Sem título')}</strong><small>${esc(display(x.date||now()))} · ${esc(({once:'Uma vez',daily:'Diária',weekly:'Semanal',monthly:'Mensal'})[x.frequency||'once'])}</small></button>`).join(''):'<button type="button" class="empty-action" data-newnote>Nenhuma nota <span>Criar nota</span></button>'}</div><div class="panel note-card">${n?`<div class="note-edit"><div class="note-controls"><label>Data<input aria-label="Data da nota" class="note-date" id="noteDate" type="date" value="${esc(n.date||now())}"></label><label>Repetição<select id="noteFrequency" aria-label="Repetição da nota">${[['once','Uma vez'],['daily','Todo dia'],['weekly','Toda semana'],['monthly','Todo mês']].map(([v,label])=>`<option value="${v}" ${frequency===v?'selected':''}>${label}</option>`).join('')}</select></label><button class="small delete-note" data-delnote title="Excluir nota" aria-label="Excluir nota">✕</button></div><input id="noteTitle" aria-label="Título da nota" placeholder="Sem título" value="${esc(n.title)}"><div id="noteRich" class="markdown-editor markdown-content" role="textbox" aria-label="Nota editável com formatação Markdown" aria-multiline="true" contenteditable="true" spellcheck="true" data-placeholder="Escreva aqui… Use #, ##, -, > ou 1. seguido de espaço.">${markdownHTML(n.body)}</div><div class="editor-status" id="noteSaveStatus" aria-live="polite">✓ Salvo automaticamente</div></div>`:'<button type="button" class="empty-action empty-note" data-newnote>Criar nota</button>'}</div></div>`}

function render(){document.body.dataset.theme=db.settings.theme;const accent=getComputedStyle(document.body).getPropertyValue('--accent').trim()||'#e53935';const iconSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#101114"/><path d="M15 9h25l10 10v36H15zM40 9v12h10M22 28h21M22 36h21M22 44h14" fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;document.querySelector('link[rel=icon]').href='data:image/svg+xml,'+encodeURIComponent(iconSvg);$('#theme').value=db.settings.theme;$$('[data-mode]').forEach(n=>n.classList.toggle('active',n.dataset.mode===db.settings.mode));$('#heading').textContent=({now:'Agora',day:'Dia',week:'Semana',month:'Mês',notes:'Notas',habits:'Hábitos'})[db.settings.mode];$('#todayText').textContent=display(now(),{day:'numeric',month:'long'});$('#main').innerHTML=({now:renderNow,day:renderDay,week:renderWeek,month:renderMonth,notes:renderNotes,habits:renderHabits})[db.settings.mode]();if(db.settings.mode!=='month')expandedDay=null;$('#dayPanel').hidden=true;$('#main').classList.remove('view-enter');void $('#main').offsetWidth;$('#main').classList.add('view-enter')}
function drawPanel(){let d=panelDay;const el=$('#dayPanel');if(!d||db.settings.mode!=='month'){el.hidden=true;el.classList.remove('panel-enter');return}el.hidden=false;el.classList.remove('panel-enter');void el.offsetWidth;el.classList.add('panel-enter');el.innerHTML=`<div class="toolbar"><strong>${esc(display(d,{weekday:'long',day:'numeric',month:'long'}))}</strong><button class="small" data-panelclose aria-label="Fechar">✕</button></div><div class="toolbar"><span class="muted">${activeCount(d)} pendente(s)</span><button class="primary small" data-paneladd="${d}">+ Tarefa</button></div>${taskList(d)}`}
function modal(title,body,buttons=''){const o=$('#overlay');o.hidden=false;o.innerHTML=`<section role="dialog" aria-modal="true" aria-label="${esc(title)}" class="dialog"><header><h2>${esc(title)}</h2><button class="small" data-close aria-label="Fechar">✕</button></header>${body}${buttons}</section>`;o.querySelector('input:not([type=hidden]),select,textarea,button')?.focus()}
function close(){if(flushHabit){flushHabit();flushHabit=null}if(flushTaskDraft){const fn=flushTaskDraft;flushTaskDraft=null;clearTimeout(taskSaveDebounce);fn()}const o=$('#overlay');o.hidden=true;o.innerHTML='';render()}
function taskForm(task=null,date=db.settings.selected){const occurrence=date;const selectedWeekday=parse(date).getDay();const defaultFrequency=db.settings.mode==='week'?'weekdays':'once';const t=task||{title:'',notes:'',tags:[],frequency:defaultFrequency,weekdays:defaultFrequency==='weekdays'?[selectedWeekday]:[],startDate:date,endDate:'',startTime:'',endTime:''};const f=t.frequency||'once';modal(task?'Editar tarefa':'Nova tarefa',`<form id="taskForm"><div class="form-grid"><div class="field full"><label for="taskTitle">Título</label><input id="taskTitle" name="title" maxlength="140" value="${esc(t.title)}" placeholder="Nome da tarefa" required></div><div class="field full"><label for="tagSearch">Tags</label><div class="tag-picker"><div id="chosenTags" class="chosen-tags"></div><input id="tagSearch" type="text" autocomplete="off" placeholder="Buscar ou criar tag" aria-label="Buscar tags" maxlength="40"><div id="tagSuggestions" class="tag-suggestions" hidden></div><input id="taskTags" name="tags" type="hidden" value="${esc((t.tags||[]).join(', '))}"></div></div><div class="field full"><label for="frequency">Frequência</label><select name="frequency" id="frequency">${[['once','Uma vez'],['daily','Todo dia'],['weekdays','Dias da semana'],['monthly','Todo mês nesta data'],['yearly','Todo ano nesta data']].map(([v,n])=>`<option value="${v}" ${f===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="field full" id="weekdayField" ${f!=='weekdays'?'hidden':''}><label>Dias da semana</label><div class="weekdays">${dayNames.map((s,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${(t.weekdays||[]).map(Number).includes(i)?'checked':''}>${s}</label>`).join('')}</div></div><div class="field"><label for="startDate">Data de início</label><input type="date" name="startDate" id="startDate" value="${esc(t.startDate||date)}" required></div><div class="field"><label for="endDate">Data final (opcional)</label><input type="date" name="endDate" id="endDate" value="${esc(t.endDate||'')}"></div><div class="field"><label for="startTime">Início</label><input type="time" name="startTime" id="startTime" value="${esc(t.startTime||'')}"></div><div class="field"><label for="endTime">Fim</label><input type="time" name="endTime" id="endTime" value="${esc(t.endTime||'')}"></div><div class="field full"><label for="taskNotes">Descrição (opcional)</label>${taskMarkdownToolbar()}<textarea name="notes" id="taskNotes" hidden>${esc(t.notes||'')}</textarea><div id="taskMarkdownPreview" class="rich-description markdown-content" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" aria-label="Descrição da tarefa, editor visual Markdown" data-placeholder="Escreva aqui…">${taskMarkdownHTML(t.notes||'')}</div></div></div><footer>${task?`<button type="button" class="finish-task ${isDone(task,occurrence)?'is-finished':''}" data-finish-task="${esc(t.id)}" data-date="${esc(occurrence)}">${isDone(task,occurrence)?'↶ Reabrir':'✓ Finalizar tarefa'}</button><button type="button" class="close-forever ${t.closedOn?'is-closed':''}" data-close-forever="${esc(t.id)}" data-date="${esc(occurrence)}" title="${t.closedOn?'Voltar a mostrar recorrências futuras':'Concluir nesta data e impedir novas ocorrências'}">${t.closedOn?'↶ Reativar recorrência':'✓ Encerrar definitivamente'}</button><button type="button" data-deletetask="${esc(t.id)}">Excluir</button>`:''}<span class="task-save-state" id="taskSaveStatus" role="status" aria-live="polite">✓ Salvamento automático</span><button type="button" data-close>Fechar</button></footer></form>`);$('#frequency').addEventListener('change',e=>$('#weekdayField').hidden=e.target.value!=='weekdays');tagController.abort();tagController=new AbortController();setupTagPicker(t.tags||[]);const form=$('#taskForm');taskMarkdownSetup(form);let record=task;const status=()=>$('#taskSaveStatus');const collect=()=>{const f=new FormData(form),start=f.get('startDate'),end=f.get('endDate'),st=f.get('startTime'),et=f.get('endTime'),frequency=f.get('frequency'),weekdays=f.getAll('weekday').map(Number);if(!String(f.get('title')||'').trim())return {invalid:'Título obrigatório'};if(end&&end<start)return {invalid:'Confira a data final'};if(st&&et&&et<=st)return {invalid:'Confira os horários'};if(frequency==='weekdays'&&!weekdays.length)return {invalid:'Escolha um dia da semana'};return {value:{title:String(f.get('title')).trim(),tags:[...new Set(String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,15),frequency,weekdays,startDate:start,endDate:end,startTime:st,endTime:et,notes:f.get('notes'),updated:stamp()}}};const saveDraft=()=>{const {invalid,value}=collect();if(invalid){if(status()){status().textContent=invalid;status().dataset.state='warning'}return false}if(record)Object.assign(record,value);else{record={...value,id:uid(),completed:[],done:false};db.tasks.push(record)}const ok=persist();if(status()){status().textContent=ok?'✓ Salvo automaticamente':'Falha ao salvar';status().dataset.state=ok?'saved':'warning'}return ok};const queue=()=>{if(status()){status().textContent='Salvando…';status().dataset.state='pending'}clearTimeout(taskSaveDebounce);taskSaveDebounce=setTimeout(saveDraft,380)};form.addEventListener('input',queue);form.addEventListener('change',queue);form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(taskSaveDebounce);saveDraft();close()});flushTaskDraft=saveDraft;if(status())status().textContent=task?'✓ Salvo automaticamente':'Digite para criar automaticamente'}
function createNote(date=now()){const n={id:uid(),title:'',body:'',date,frequency:'once',updated:stamp()};db.notes.push(n);selectedNote=n.id;db.settings.mode='notes';persist();render();$('#noteRich')?.focus()}
function toggleTask(id,d,checked){const t=db.tasks.find(t=>t.id===id);if(!t)return;if(t.frequency==='once')t.done=checked;else{t.completed=Array.isArray(t.completed)?t.completed:[];t.completed=checked?[...new Set([...t.completed,d])]:t.completed.filter(x=>x!==d)}touch(t);render()}
function closeTaskForever(id,d){const t=db.tasks.find(x=>x.id===id);if(!t)return;
  if(t.closedOn){delete t.closedOn;touch(t);close();toast('Tarefa reativada');return}
  if(!confirm('Encerrar esta tarefa definitivamente? Ela ficará concluída na data selecionada e não aparecerá nas datas seguintes.'))return;
  if(t.frequency==='once'){t.done=true;t.closedOn=d}
  else{t.completed=Array.isArray(t.completed)?t.completed:[];t.completed=[...new Set([...t.completed,d])];t.closedOn=d}
  touch(t);close();toast('Tarefa encerrada. Futuras ocorrências ocultadas')
}
function removeTask(id){if(!confirm('Excluir esta tarefa?'))return;flushTaskDraft=null;clearTimeout(taskSaveDebounce);db.tasks=db.tasks.filter(x=>x.id!==id);db.deleted.tasks[id]=stamp();persist();close();render()}
function removeNote(){if(!confirm('Excluir esta nota?'))return;db.notes=db.notes.filter(n=>n.id!==selectedNote);db.deleted.notes[selectedNote]=stamp();selectedNote=null;persist();render()}
function settingsModal(){modal('Backup',`<div class="items"><p class="muted">Seus dados ficam neste navegador. Exporte backups regularmente.</p><button data-export>Exportar JSON</button><button data-import>Importar JSON</button></div>`)}
function exportJSON(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=`cyberpunk-diary-${now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function merge(incoming){if(!incoming||!Array.isArray(incoming.tasks)||!Array.isArray(incoming.notes))throw Error('Arquivo inválido');let changes=0;for(const type of ['tasks','notes','habits']){const tomb=incoming.deleted?.[type]||{};for(const [key,when] of Object.entries(tomb)){if(!db.deleted[type][key]||db.deleted[type][key]<when){db.deleted[type][key]=when;changes++}}const byId=new Map(db[type].map(x=>[x.id,x]));for(const rec of (incoming[type]||[])){if(!rec?.id||!rec.updated)continue;const prior=byId.get(rec.id);if(!prior||prior.updated<rec.updated){byId.set(rec.id,rec);changes++}}db[type]=[...byId.values()].filter(rec=>!db.deleted[type][rec.id]||db.deleted[type][rec.id]<rec.updated)}if(changes){persist(false);render()}return changes}
async function importJSON(file){try{if(!file||file.size>10e6)throw Error('Arquivo vazio ou grande demais');const obj=JSON.parse(await file.text());if(!confirm('Mesclar tarefas, notas e hábitos deste arquivo com os dados atuais?'))return;toast(`${merge(obj)} alterações importadas`)}catch(e){toast('Erro: '+e.message)}}
/* WebRTC uses a small websocket signaling service; task data only traverses encrypted RTC DataChannels. */
function syncModal(){modal('Sincronização P2P',`<div class="form-grid sync-layout"><div class="field full"><label for="syncServer">Servidor</label><input id="syncServer" autocomplete="off" spellcheck="false" value="${esc(db.sync.server||defaultServer())}" placeholder="wss://seu-servidor/signal"></div><div class="field full"><label for="syncRoom">ID de sincronização</label><input id="syncRoom" autocomplete="off" spellcheck="false" value="${esc(db.sync.room)}" placeholder="Gerar ou colar ID"></div><div class="field full sync-buttons"><button data-generate-id>Gerar ID</button><button data-copy-id>Copiar ID</button></div><div class="field full"><label class="pill"><input type="checkbox" id="syncAuto" ${db.sync.auto?'checked':''}> Conectar automaticamente</label></div><div class="field full qr-area"><div class="qr-frame"><canvas id="pairQR" width="232" height="232" role="img" aria-label="QR Code de pareamento"></canvas></div><div class="qr-side"><strong>Conectar dispositivo</strong><p class="muted">Escaneie o QR com a câmera do outro dispositivo.</p><button data-copy-link>Copiar link</button><button data-save-qr>Salvar QR</button><small id="qrInfo" class="muted"></small></div></div></div><p class="syncstatus" id="syncStatus">${esc(syncState)} · ${peers.size} conexão(ões) P2P</p><footer><button data-disconnect>Desconectar</button><button class="primary" data-connect>Conectar</button></footer>`);if(!$('#syncRoom').value){$('#syncRoom').value=randomRoom()}drawQR()}
function randomRoom(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('')}
function pairURL(){const room=$('#syncRoom')?.value.trim(),server=$('#syncServer')?.value.trim();if(!/^[-a-zA-Z0-9]{16,128}$/.test(room||'')||!/^wss?:\/\/\S+/.test(server||''))return null;const u=new URL(location.href);u.hash=new URLSearchParams({pair:room,server}).toString();return u.toString()}
function drawQR(){const canvas=$('#pairQR'),info=$('#qrInfo');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);const url=pairURL();if(!url){if(info)info.textContent='Informe um ID e servidor válidos';return}try{const qr=new DiaryQR.QRCode(0,DiaryQR.Level.M);qr.addData(url);qr.make();const n=qr.getModuleCount(),pad=12,scale=Math.floor((canvas.width-2*pad)/n),side=n*scale,start=Math.floor((canvas.width-side)/2);ctx.fillStyle='#101015';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect(start+x*scale,start+y*scale,scale,scale);if(info)info.textContent=location.hostname==='localhost'||location.hostname==='127.0.0.1'?'Use um endereço acessível no outro dispositivo.':'O QR contém o ID de acesso. Não compartilhe publicamente.'}catch(e){if(info)info.textContent='QR muito longo: use uma URL de servidor menor.';console.warn(e)}}
function pairFromLink(){let params;try{params=new URLSearchParams(location.hash.slice(1))}catch{return}const room=params.get('pair'),server=params.get('server');if(!room&&!server)return;history.replaceState(null,'',location.pathname+location.search);if(!/^[-a-zA-Z0-9]{16,128}$/.test(room||'')||!/^wss?:\/\/\S+$/.test(server||'')){toast('Link de pareamento inválido');return}syncModal();$('#syncRoom').value=room;$('#syncServer').value=server;$('#syncAuto').checked=true;drawQR();const dialog=$('#overlay .dialog');dialog.insertAdjacentHTML('afterbegin','<p class="pair-notice">Pareamento recebido. Confira o servidor e toque em Conectar para sincronizar seus dados.</p>')}
function defaultServer(){return location.protocol==='https:'?`wss://${location.host}/signal`:`ws://${location.hostname||'localhost'}:8787`}
function syncSet(s){syncState=s;$('#syncDot').style.color=socket?.readyState===1?'var(--alt)':'var(--muted)';const el=$('#syncStatus');if(el)el.textContent=`${s} · ${[...peers.values()].filter(p=>p.dc?.readyState==='open').length} conexão(ões) P2P`}
function disconnect(){syncWanted=false;socket?.close();socket=null;for(const p of peers.values())p.pc.close();peers.clear();syncSet('Desconectado')}
function sendSignal(to,body){if(socket?.readyState===1)socket.send(JSON.stringify({type:'signal',to,body}))}
function sendData(pc){if(pc.dc?.readyState==='open')pc.dc.send(JSON.stringify({type:'sync',db:{tasks:db.tasks,notes:db.notes,habits:db.habits,deleted:db.deleted}}))}
function broadcast(){for(const p of peers.values())sendData(p)}
function makePeer(peerId,initiator){if(peers.has(peerId))return peers.get(peerId);const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}),p={pc,dc:null};peers.set(peerId,p);pc.onicecandidate=e=>{if(e.candidate)sendSignal(peerId,{candidate:e.candidate})};pc.onconnectionstatechange=()=>{syncSet(pc.connectionState==='connected'?'Sincronizado':`Conexão ${pc.connectionState}`);if(['closed','failed','disconnected'].includes(pc.connectionState)){peers.delete(peerId);pc.close()}};const channel=dc=>{p.dc=dc;dc.onopen=()=>{syncSet('Sincronizado');sendData(p)};dc.onmessage=e=>{try{let m=JSON.parse(e.data);if(m.type==='sync'){const n=merge(m.db);if(n)broadcast()}}catch(err){console.warn(err)}};dc.onclose=()=>syncSet('Aguardando conexão')};pc.ondatachannel=e=>channel(e.channel);if(initiator){channel(pc.createDataChannel('diary'));pc.createOffer().then(o=>pc.setLocalDescription(o).then(()=>sendSignal(peerId,{description:pc.localDescription}))).catch(console.warn)}return p}
async function receiveSignal(from,body){const p=makePeer(from,false);try{if(body.description){await p.pc.setRemoteDescription(body.description);if(body.description.type==='offer'){const answer=await p.pc.createAnswer();await p.pc.setLocalDescription(answer);sendSignal(from,{description:p.pc.localDescription})}}if(body.candidate)await p.pc.addIceCandidate(body.candidate)}catch(e){console.warn('WebRTC signal error',e)}}
function connect(){if(!window.RTCPeerConnection||!window.WebSocket){toast('WebRTC ou WebSocket indisponível');return}let server=$('#syncServer')?.value.trim()||db.sync.server,room=$('#syncRoom')?.value.trim()||db.sync.room,auto=$('#syncAuto')?.checked??db.sync.auto;if(!/^wss?:\/\/\S+/.test(server)||!/^[-a-zA-Z0-9]{16,128}$/.test(room)){toast('Informe servidor e ID válido (mínimo 16 caracteres)');return}if(location.protocol==='https:'&&server.startsWith('ws://')){toast('Use WSS em páginas HTTPS');return}disconnect();db.sync={server,room,auto};persist(false);syncWanted=true;try{socket=new WebSocket(server);syncSet('Conectando…');socket.onopen=()=>{socket.send(JSON.stringify({type:'join',room,device:db.deviceId}));syncSet('Aguardando dispositivos')};socket.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='peers'){for(const peerId of m.ids||[])if(peerId!==db.deviceId)makePeer(peerId,db.deviceId>peerId)}else if(m.type==='joined'&&m.id!==db.deviceId){if(db.deviceId>m.id)makePeer(m.id,true)}else if(m.type==='signal')receiveSignal(m.from,m.body);else if(m.type==='error')syncSet(m.message||'Erro de conexão')}catch(err){console.warn(err)}};socket.onclose=()=>syncSet('Servidor desconectado');socket.onerror=()=>syncSet('Falha no servidor');close();toast('Sincronização iniciada')}catch(e){syncSet('Falha: '+e.message)}}
function saveNoteBody(body){const n=db.notes.find(n=>n.id===selectedNote);if(!n)return;n.body=body;n.updated=stamp();queueNoteSave()}
function queueNoteSave(){const status=$('#noteSaveStatus');if(status)status.textContent='Salvando…';clearTimeout(saveDebounce);saveDebounce=setTimeout(()=>{const ok=persist();const el=$('#noteSaveStatus');if(el)el.textContent=ok?'✓ Salvo automaticamente':'Falha ao salvar'},350)}
function selectEnd(el){const sel=window.getSelection(),r=document.createRange();r.selectNodeContents(el);r.collapse(false);sel.removeAllRanges();sel.addRange(r)}
function applyMarkdownShortcut(e){const rich=e.target.closest('#noteRich');if(!rich||e.key!==' '||e.ctrlKey||e.metaKey)return;const sel=window.getSelection();if(!sel.rangeCount||!rich.contains(sel.anchorNode)||!sel.isCollapsed)return;let node=sel.anchorNode;while(node&&node.parentNode!==rich)node=node.parentNode;if(!node||node.nodeType!==1)return;const prefix=(node.textContent||'').trim();let tag=null;if(/^#{1,6}$/.test(prefix))tag='h'+prefix.length;else if(prefix==='-'||prefix==='*')tag='ul';else if(prefix==='1.')tag='ol';else if(prefix==='>')tag='blockquote';if(!tag)return;e.preventDefault();const replacement=document.createElement(tag==='ul'||tag==='ol'?'li':tag);replacement.appendChild(document.createElement('br'));if(tag==='ul'||tag==='ol'){const list=document.createElement(tag);list.appendChild(replacement);node.replaceWith(list)}else node.replaceWith(replacement);selectEnd(replacement);saveNoteBody(editorMarkdown(rich))}
function insertVisualFormat(kind){const rich=$('#noteRich');if(!rich)return;rich.focus();if(kind==='bold'||kind==='italic')document.execCommand(kind,false,null);saveNoteBody(editorMarkdown(rich))}

document.addEventListener('beforeinput',e=>{if(e.target.id==='noteRich'&&e.inputType==='insertFromPaste'&&e.dataTransfer){e.preventDefault();document.execCommand('insertText',false,e.dataTransfer.getData('text/plain'))}});
// Links reais nas tarefas, hábitos, notas e editores visuais.
// Tratamento em captura: impede que os controles de calendário/edição
// interceptem ou destruam o elemento antes da navegação.
function openDiaryLink(anchor){
  const url=safeLinkURL(anchor.getAttribute('href'));
  if(!url){toast('Link inválido');return}
  // Executar durante o clique do usuário para evitar bloqueio de pop-ups.
  const tab=window.open(url,'_blank');
  if(tab){try{tab.opener=null}catch(_){}}
  else window.location.assign(url); // fallback para bloqueador de pop-ups
}
document.addEventListener('click',e=>{
  const anchor=e.target.closest('a[href]');
  if(!anchor||!anchor.closest('.rendered-description,.rich-description,#noteRich'))return;
  e.preventDefault();e.stopImmediatePropagation();
  openDiaryLink(anchor);
},true);
// Atalho de teclado: Enter em links focados abre o endereço.
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.ctrlKey||e.metaKey||e.altKey)return;
  const anchor=e.target.closest('a[href]');
  if(!anchor||!anchor.closest('.rendered-description,.rich-description,#noteRich'))return;
  e.preventDefault();e.stopImmediatePropagation();openDiaryLink(anchor);
},true);
// Converter URLs digitadas ao concluir palavra ou ao colar, mantendo o texto editável.
function autoLinkEditor(root){
  if(!root)return;
  if(linkifyRichEditor(root)){
    if(root.id==='noteRich')saveNoteBody(editorMarkdown(root));
    else root.dispatchEvent(new Event('input',{bubbles:true}));
  }
}
document.addEventListener('keyup',e=>{
  if(![' ','Enter','Tab'].includes(e.key))return;
  const root=e.target.closest('.rich-description,#noteRich');
  if(!root)return;
  // Delay de um frame para deixar o navegador terminar a operação nativa.
  requestAnimationFrame(()=>autoLinkEditor(root));
});
document.addEventListener('paste',e=>{
  const root=e.target.closest('.rich-description,#noteRich');
  if(root)setTimeout(()=>autoLinkEditor(root),30);
});
document.addEventListener('focusout',e=>{if(e.target.id==='noteRich'){if(linkifyRichEditor(e.target))saveNoteBody(editorMarkdown(e.target));}});

document.addEventListener('keydown',e=>{if(e.target.closest('#noteRich')){if(e.key===' ')applyMarkdownShortcut(e);if((e.ctrlKey||e.metaKey)&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();insertVisualFormat(e.key.toLowerCase()==='b'?'bold':'italic')}}});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.holidayDate){holidayDetails(b.dataset.holidayDate)}else if(b.dataset.mode){db.settings.mode=b.dataset.mode;persist(false);render();if(['day','week','month'].includes(db.settings.mode))loadContext();$('#sidebar').classList.remove('open')}else if(b.dataset.step){const d=db.settings.selected,k=Number(b.dataset.step);db.settings.selected=db.settings.mode==='month'?addMonth(d,k):shift(d,k*(db.settings.mode==='week'?7:1));persist(false);render();if(['day','week','month'].includes(db.settings.mode))loadContext()}else if(b.hasAttribute('data-today')){db.settings.selected=now();persist(false);render();loadContext()}else if(b.dataset.day){db.settings.selected=b.dataset.day;persist(false);render();loadContext()}else if(b.hasAttribute('data-panelclose')){panelDay=null;drawPanel()}else if(b.dataset.expand){expandedDay=expandedDay===b.dataset.expand?null:b.dataset.expand;render()}else if(b.dataset.addOn){taskForm(null,b.dataset.addOn)}else if(b.dataset.noteOn){createNote(b.dataset.noteOn)}else if(b.dataset.paneladd){taskForm(null,b.dataset.paneladd)}else if(b.dataset.edit){taskForm(db.tasks.find(t=>t.id===b.dataset.edit),b.dataset.date||db.settings.selected)}else if(b.dataset.finishTask){if(flushTaskDraft){clearTimeout(taskSaveDebounce);flushTaskDraft();flushTaskDraft=null}const task=db.tasks.find(t=>t.id===b.dataset.finishTask);if(task){const date=b.dataset.date||db.settings.selected,complete=!isDone(task,date);toggleTask(task.id,date,complete);close();toast(complete?'Tarefa finalizada':'Tarefa reaberta')}}else if(b.dataset.closeForever){if(flushTaskDraft){clearTimeout(taskSaveDebounce);flushTaskDraft();flushTaskDraft=null}closeTaskForever(b.dataset.closeForever,b.dataset.date||db.settings.selected)}else if(b.dataset.deletetask){removeTask(b.dataset.deletetask)}else if(b.hasAttribute('data-newnote'))createNote();else if(b.dataset.note){selectedNote=b.dataset.note;render();$('#noteRich')?.focus()}else if(b.hasAttribute('data-delnote'))removeNote();else if(b.hasAttribute('data-habit-new'))habitForm();else if(b.dataset.habitEdit)habitForm(b.dataset.habitEdit);else if(b.dataset.habitDelete){if(confirm('Excluir hábito?')){const id=b.dataset.habitDelete;db.habits=db.habits.filter(h=>h.id!==id);db.deleted.habits[id]=stamp();persist();flushHabit=null;close()}}else if(b.hasAttribute('data-gps-activate'))locateForWeather(true);else if(b.hasAttribute('data-city-save'))selectCity($('#cityInput')?.value||'');else if(b.hasAttribute('data-city-clear')){context.city='';context.lat=null;context.lon=null;context.weather={};context.current=null;context.locationMode='manual';saveContext();close();render()}else if(b.hasAttribute('data-city-open'))cityModal();else if(b.hasAttribute('data-close'))close();else if(b.hasAttribute('data-export'))exportJSON();else if(b.hasAttribute('data-import'))$('#importFile').click();else if(b.hasAttribute('data-generate-id')){$('#syncRoom').value=randomRoom();drawQR()}else if(b.hasAttribute('data-copy-id')){navigator.clipboard?.writeText($('#syncRoom').value).then(()=>toast('ID copiado')).catch(()=>toast('Não foi possível copiar'))}else if(b.hasAttribute('data-copy-link')){const url=pairURL();if(url)navigator.clipboard?.writeText(url).then(()=>toast('Link copiado')).catch(()=>toast('Não foi possível copiar'));else toast('Informe servidor e ID válidos')}else if(b.hasAttribute('data-save-qr')){if(!pairURL())return toast('Informe servidor e ID válidos');const a=document.createElement('a');a.href=$('#pairQR').toDataURL('image/png');a.download='cyberpunk-diary-pareamento.png';a.click()}else if(b.hasAttribute('data-connect'))connect();else if(b.hasAttribute('data-disconnect')){disconnect();db.sync.auto=false;persist(false);syncModal()}});
document.addEventListener('click',e=>{if(e.target.closest('button,input,a,label,[contenteditable],.calendar-event,.day-details,.task'))return;const cell=e.target.closest('[data-create-on]');if(cell&&['week','month'].includes(db.settings.mode))taskForm(null,cell.dataset.createOn)});
document.addEventListener('pointerdown',e=>{if(e.target.closest('a[href],.rich-description,.rendered-description,#noteRich'))return;if(expandedDay&&db.settings.mode==='month'&&!e.target.closest('.daybox.expanded')&&!e.target.closest('#overlay')&&!e.target.closest('[data-expand]')){expandedDay=null;render()}});
document.addEventListener('change',e=>{
  const checkbox=e.target.closest('.rendered-description input[data-md-line]');
  if(!checkbox)return;
  const wrapper=checkbox.closest('[data-description-kind][data-description-id]');
  const record=wrapper?.dataset.descriptionKind==='habit'
    ?db.habits.find(h=>h.id===wrapper.dataset.descriptionId)
    :db.tasks.find(t=>t.id===wrapper.dataset.descriptionId);
  if(!record)return;
  const key=wrapper.dataset.descriptionKind==='habit'?'description':'notes';
  const lines=String(record[key]||'').split('\n');
  const index=Number(checkbox.dataset.mdLine);
  if(!Number.isInteger(index)||index<0||index>=lines.length)return;
  if(!/^(\s*[-*]\s+)\[[ xX]\]/.test(lines[index]))return;
  lines[index]=lines[index].replace(/^(\s*[-*]\s+)\[[ xX]\]/,`$1[${checkbox.checked?'x':' '}]`);
  record[key]=lines.join('\n');
  touch(record);
  // Preserve scrolling, checkbox focus and current calendar view.
  wrapper.innerHTML=taskMarkdownHTML(record[key]);
});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.habitCheck){toggleHabit(t.dataset.habitCheck,t.dataset.date,t.checked)}else if(t.dataset.check){toggleTask(t.dataset.check,t.dataset.date,t.checked)}else if(t.dataset.option){db.settings[t.dataset.option]=t.checked;persist(false);render()}else if(t.id==='jump'&&t.value){db.settings.selected=t.value;persist(false);render()}else if(t.id==='noteDate'||t.id==='noteFrequency'){const n=db.notes.find(n=>n.id===selectedNote);if(n){if(t.id==='noteDate')n.date=t.value||now();else n.frequency=t.value;touch(n)}}});
document.addEventListener('input',e=>{if(['syncRoom','syncServer'].includes(e.target.id)){drawQR();return}if(e.target.id==='noteRich'){saveNoteBody(editorMarkdown(e.target));return}if(e.target.id==='noteTitle'){const n=db.notes.find(n=>n.id===selectedNote);if(n){n.title=e.target.value;n.updated=stamp();const listRow=document.querySelector(`.note-row[data-note="${CSS.escape(n.id)}"] strong`);if(listRow)listRow.textContent=n.title||shortMD(n.body).split('\n')[0]||'Sem título';queueNoteSave()}}});
$('#theme').addEventListener('change',e=>{db.settings.theme=e.target.value;persist(false);render()});$('#syncOpen').addEventListener('click',syncModal);$('#backupOpen').addEventListener('click',settingsModal);$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));$('#importFile').addEventListener('change',e=>{importJSON(e.target.files[0]);e.target.value=''});$('#overlay').addEventListener('click',e=>{if(e.target.id==='overlay')close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(expandedDay){expandedDay=null;render()}else close();panelDay=null;drawPanel()}});
// Atualiza a seção Agora periodicamente e ao retornar para a aba.
const refreshNow=()=>{if(db.settings.mode==='now'&&document.visibilityState==='visible'&&$('#overlay').hidden)render()};
setInterval(refreshNow,15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshNow();enableAutomaticLocation();loadContext()}});
window.addEventListener('focus',refreshNow);
window.addEventListener('pagehide',()=>{clearTimeout(saveDebounce);clearTimeout(taskSaveDebounce);flushTaskDraft?.();flushHabit?.();persist(false)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(saveDebounce);clearTimeout(taskSaveDebounce);flushTaskDraft?.();flushHabit?.();persist(false)}});persist(false);render();loadContext();enableAutomaticLocation();pairFromLink();if(db.sync.auto&&db.sync.room&&db.sync.server&&$('#overlay').hidden){setTimeout(()=>connect(),250)}if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(console.warn);
})();
