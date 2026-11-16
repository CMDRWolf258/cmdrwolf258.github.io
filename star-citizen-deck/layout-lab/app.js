/* Star Citizen Control Deck — version from Windows companion API. */
'use strict';
const icons = {
 grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15.9 8.1-3 6-4.8 2.1 2-5.4z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
 radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M12 12l5-5M12 7a5 5 0 0 1 5 5M12 3a9 9 0 0 1 9 9"/>',
 cpu:'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4M1 15h4m14-6h4m-4 6h4"/>',
 pickaxe:'<path d="m14 8-7 13M2 5c7-4 14-3 19 3-8-1-13 1-16 8"/>',
 person:'<circle cx="12" cy="6" r="3.2"/><path d="M5 21v-3c0-7 14-7 14 0v3M9 12v7m6-7v7"/>',
 sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="#07111d"/><circle cx="15" cy="12" r="2" fill="#07111d"/><circle cx="10" cy="18" r="2" fill="#07111d"/>',
 settings:'<circle cx="12" cy="12" r="3.5"/><path d="M9 2h6l.5 2.5 2 1 2.2-1.2 3 5-2 1.7v2.2l2 1.7-3 5-2.2-1.2-2 1L15 22H9l-.5-2.3-2-1-2.2 1.2-3-5 2-1.7v-2.2l-2-1.7 3-5 2.2 1.2 2-1z"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 toggle:'<path d="M12 2v10M6.4 6.5a9 9 0 1 0 11.2 0"/>',
 circle:'<circle cx="12" cy="12" r="8"/><path d="m9 12 2 2 4-4"/>',
 arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',
 lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 sync:'<path d="M21 11A9 9 0 0 0 5 5L3 7m0-5v5h5M3 13a9 9 0 0 0 16 6l2-2m0 5v-5h-5"/>',
 shield:'<path d="m12 2 9 4v6c0 5-3.3 8.3-9 10-5.7-1.7-9-5-9-10V6z"/>',
 chevron:'<path d="m5 9 7 7 7-7"/>',
 edit:'<path d="M3 21l5-1 13-13-4-4L4 16zM14 6l4 4"/>',
 alert:'<path d="m12 2 10 19H2zM12 8v6m0 3v1"/>',
};
const svg=(name,css='')=>`<svg class="${css}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">${icons[name]||icons.circle}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token=localStorage.getItem('scdeck-token')||'';
let app=null,active='home',settingsTab='bindings',profileFilter='all',search='',localStates={},localSliders={};
let sessionData=null;
let shipReference=null,shipReferenceKey='',shipReferenceChecked=0,sessionHistoryExpanded=false,shipDetailsExpanded=false;
let toastTimer=null;
const activeHoldTouches=new Map();
const el=id=>document.getElementById(id);
async function request(path,data){
  let resp=await fetch(path,{method:data===undefined?'GET':'POST',headers:{...(token?{'X-Deck-Token':token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
  const j=await resp.json();
  if(!resp.ok)throw Object.assign(new Error(j.error||`HTTP ${resp.status}`),{status:resp.status});
  return j;
}
function notify(message,isError=false){
  const root=el('toast-root');
  root.innerHTML=`<div class="toast ${isError?'error':''}"><strong>${isError?'COMMAND NOT SENT':'CONTROL DECK'}</strong>${esc(message)}</div>`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>root.innerHTML='',3700);
}
function clock(){const d=new Date();el('top-time').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});}
function linkStatus(ok){const node=el('top-link');node.className='connection-chip'+(ok?'':' offline');node.innerHTML=`<span class="dot"></span>${ok?'LINK ESTABLISHED':'OFFLINE'}`;}
async function startup(){
  el('settings-icon').innerHTML=svg('settings'); clock();setInterval(clock,15000);
  setInterval(refreshSession,4000);
  if(!token){showPairing();return;}
  await loadState();
  setInterval(async()=>{
    if(!token||!app)return;
    try{
      const fresh=await request('/api/state');
      const changed=fresh.last_import!==app.last_import||fresh.armed!==app.armed||fresh.version!==app.version||JSON.stringify(fresh.controls)!==JSON.stringify(app.controls);
      app=fresh;linkStatus(true);updateRail();
      if(changed && !el('modal-root').innerHTML){render();}
    }catch(err){linkStatus(false);if(err.status===401){token='';localStorage.removeItem('scdeck-token');showPairing();}}
  },9000);
}
async function loadState(){
  try{app=await request('/api/state');linkStatus(true);render();refreshSession();}
  catch(err){linkStatus(false);if(err.status===401){token='';localStorage.removeItem('scdeck-token');showPairing();}else notify(err.message,true);}
}
async function refreshSession(){
 if(!token||!app)return;
 try{
  sessionData=await request('/api/session');
  const shipKey=(sessionData.status!=='missing' && sessionData.vehicle_status!=='Released')?(sessionData.vehicle_class||''):'';
  if(shipKey!==shipReferenceKey){
    shipReferenceKey=shipKey;shipReference=null;shipReferenceChecked=0;
  }
  paintSessionPanels();
  if(shipKey && Date.now()-shipReferenceChecked>10*60*1000){
    shipReferenceChecked=Date.now();
    refreshShipReference(shipKey);
  }
 }catch(_){sessionData=null;paintSessionPanels();}
}
async function refreshShipReference(requestedClass){
 try{
  const data=await request('/api/ship-reference');
  if(requestedClass!==shipReferenceKey)return;
  shipReference=data;
 }catch(_){
  if(requestedClass!==shipReferenceKey)return;
  shipReference={status:'unavailable',reason:'Community ship database unavailable'};
 }
 paintSessionPanels();
}
function paintSessionPanels(){
 const history=el('session-history');
 if(history)sessionHistoryExpanded=history.open;
 const session=el('session-intelligence');
 if(session)session.innerHTML=sessionIntelligenceHTML();
 const previousDetails=el('ship-details');
 if(previousDetails)shipDetailsExpanded=previousDetails.open;
 const banner=el('ship-intelligence');
 if(banner)banner.innerHTML=shipIntelligenceHTML();
 const nav=el('quantum-intelligence');
 if(nav)nav.innerHTML=quantumIntelligenceHTML();
}
function shipIntelligenceHTML(){
 const s=sessionData;
 if(!s)return '<div class="ship-status">Connecting to local ship intelligence…</div>';
 const name=s.vehicle_name||s.ship_channel||'No ship detected';
 const reference=shipReference?.ship;
 const confirmed=s.vehicle_status==='Pilot control';
 const inferred=s.vehicle_status==='Inferred';
 const condition=s.status==='stale'?'LAST OBSERVED / STALE LOG':s.status==='missing'?'GAME.LOG NOT FOUND':confirmed?'LOCAL PILOT CONTROL OBSERVED':inferred?'SHIP IDENTIFIED · NAVIGATION EVENT':'UNCONFIRMED SHIP CHANNEL';
 const referenceStatus=reference ? (shipReference.status==='snapshot'?'CACHED REFERENCE · '+(reference.version||''):'WIKI DATABASE · '+(reference.version||'CURRENT')) : shipReferenceKey?(shipReference?.reason||'Looking up ship specifications…'):'No ship specification record selected';
 const displayName=reference?.name||name;
 const number=(value,suffix='')=>value===null||value===undefined||value===''?'—':Number(value).toLocaleString()+suffix;
 const specs=[
  ['CREW',reference?number(reference.crew):'—'],
  ['CARGO',reference?number(reference.cargo_capacity,' SCU'):'—'],
  ['SCM',reference?number(reference.scm_speed,' m/s'):'—'],
  ['MAX SPEED',reference?number(reference.max_speed,' m/s'):'—'],
  ['SHIELDS',reference?number(reference.shield_hp,' HP'):'—'],
  ['HULL',reference?number(reference.hull_hp,' HP'):'—']
 ];
 const stats=reference?'<div class="ship-stat-grid">'+specs.map(([label,value])=>'<div class="ship-stat"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>').join('')+'</div>':'';
 const equipment=Array.isArray(reference?.equipment)?reference.equipment:[];
 const components=equipment.length?'<div class="ship-equipment">'+equipment.map(x=>'<div><b>'+esc(x.name)+'</b><small>'+esc(x.type||'Factory reference component')+'</small></div>').join('')+'</div>':'<p class="subtle-note">Factory component list is not available from this record. Custom-fitted parts cannot be detected from Game.log.</p>';
 const sourceUrl=reference?.source_url;
 const srcLink=sourceUrl?'<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener noreferrer">OPEN SHIP DATABASE</a>':'';
 const full=reference?'<div class="ship-detail-facts"><span>'+esc(reference.manufacturer||'')+'</span><span>'+esc(reference.role||'')+'</span>'
  +(reference.length!=null?'<span>'+esc(number(reference.length))+' × '+esc(number(reference.beam))+' × '+esc(number(reference.height))+' m</span>':'')
  +(reference.mass!=null?'<span>'+esc(number(reference.mass,' kg'))+'</span>':'')+'</div>':'';
 return '<div class="ship-banner-top"><div><div class="ship-kicker">DETECTED VESSEL / SHIP INTELLIGENCE</div>'
  +'<div class="ship-name">'+esc(displayName)+'</div><div class="ship-evidence">'+esc(condition)+'</div></div>'
  +'<div class="ship-reference-tag">REFERENCE · NOT LIVE TELEMETRY</div></div>'
  +stats+'<div class="ship-banner-bottom"><span>'+esc(referenceStatus)+'</span>'
  +(reference?'<details id="ship-details" class="ship-details" '+(shipDetailsExpanded?'open':'')+'><summary>FACTORY REFERENCE &amp; SYSTEMS</summary>'+full+components+'</details>':'')
  +srcLink+'</div>';
}
function sessionIntelligenceHTML(){
 const s=sessionData;
 if(!s)return '<p class="subtle-note">Connecting to the read-only Game.log monitor…</p>';
 const state=s.status==='monitoring'?'LOG MONITORED':s.status==='stale'?'LOG NOT RECENT':'LOG NOT FOUND';
 const note=s.status==='missing'?(s.error||'Game.log not located. Set its path in Settings → Connection.'):(s.status==='stale'?'This game log has not changed in over 15 minutes. Information below is last observed, not live.':'Game.log is being monitored; events update when the game writes them.');
 const detectedVehicle=s.vehicle_name||(s.vehicle_status==='Released'?'Not currently identified':s.ship_channel||'Unknown');
 const vehicleEvidence=s.vehicle_name?(s.vehicle_source||'Event observed')
    :(s.vehicle_status==='Released'?'Pilot control released':s.ship_channel?'Comms channel only (unverified)':'No local vehicle event found');
 const rows=[
  ['DETECTED VEHICLE',detectedVehicle],
  ['SHIP EVIDENCE',vehicleEvidence],
  ['LOCATION-RELATED EVENT',s.location_activity||'Unknown'],
  ['LAST JURISDICTION',s.jurisdiction||'Unknown'],
  ['QUANTUM TARGET CODE',s.quantum_target||'Not observed']
 ];
 const detail=rows.map(([name,value])=>'<div class="session-data-row"><span>'+esc(name)+'</span><b>'+esc(value)+'</b></div>').join('');
 const events=(s.events||[]);
 const eventHTML=e=>'<div class="session-event"><span class="session-event-mark">'+(e.historical?'HISTORY':'LOG')+'</span><span>'+esc(e.detail)+'</span></div>';
 const feed=events.slice(0,3).map(eventHTML).join('');
 const older=events.slice(3).map(eventHTML).join('');
 const history=older?'<details id="session-history" '+(sessionHistoryExpanded?'open':'')+'><summary class="session-history-title">SHOW '+(events.length-3)+' OLDER EVENTS</summary>'+older+'</details>':'';
 const contracts=(s.contracts||[]).slice(-3).map(e=>'<div class="session-event"><span class="session-event-mark">'+esc(e.status)+'</span><span>'+esc(e.name)+'</span></div>').join('');
 return '<div class="session-heading"><b>'+esc(state)+'</b><span>READ-ONLY / GAME.LOG</span></div>'
  +'<p class="session-explainer">'+esc(note)+'</p><div class="session-data">'+detail+'</div>'
  +(contracts?'<div class="microhead"><span>RECENT CONTRACT EVENTS</span><span>LOG-DERIVED</span></div>'+contracts:'')
  +'<div class="microhead"><span>RECENT GAME EVENTS</span><span>LAST 7</span></div>'
  +(feed||'<p class="subtle-note">No supported events detected in the current log yet.</p>')+history
  +'<p class="subtle-note">Pilot-control events identify a controlled vehicle when logged. Navigation-derived ship IDs are inferred; neither provides continuous live ship telemetry.</p>';
}
function quantumIntelligenceHTML(){
 const s=sessionData;
 if(!s)return '<p class="subtle-note">Connecting to Game.log…</p>';
 const label=s.quantum_target||'Not observed';
 const status=s.quantum_target?(s.quantum_status||'Unknown'):'No quantum destination event detected';
 return '<div class="session-heading"><b>LOG-OBSERVED QUANTUM TARGET</b><span>'+esc(s.status==='stale'?'STALE':s.status==='missing'?'NO LOG':'READ-ONLY')+'</span></div>'
  +'<div class="quantum-target">'+esc(label)+'</div><div class="quantum-state">'+esc(status)+'</div>'
  +'<p class="subtle-note">This is the last target code recorded by Game.log, not a synced Starmap route, distance, or ETA.</p>';
}
function showPairing(){
  const template=`<div class="modal-wrap pair-wrap"><div class="modal" role="dialog" aria-modal="true" aria-label="Pair companion"><div class="pair-logo">${svg('compass')}</div><div class="eyebrow" style="justify-content:center">INITIAL CONNECTION</div><h2>Pair with Serenity</h2><p>Start <b>START_DECK.bat</b> on your PC, then enter the six-digit PIN displayed in the companion window.</p><form id="pair-form"><div class="field"><label for="pair-pin">PAIRING CODE</label><input id="pair-pin" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" required></div><button class="primary-btn" type="submit">CONNECT CONTROL DECK</button></form><p class="hint">Both devices must be on the same trusted local network.</p></div></div>`;
  el('modal-root').innerHTML=template;
  el('pair-form').onsubmit=async ev=>{ev.preventDefault();try{
    const result=await request('/api/pair',{pin:el('pair-pin').value});token=result.token;
    localStorage.setItem('scdeck-token',token);el('modal-root').innerHTML='';await loadState();
  }catch(e){notify(e.message,true);}};
}
function render(){
 if(!app)return;
 document.body.classList.toggle('cockpit-page', active!=='settings');
 const version=app.version||'unknown';
 if(el('deck-footer-version'))el('deck-footer-version').innerHTML='<b>STAR CITIZEN DECK</b> / V'+esc(version);
 if(el('top-version'))el('top-version').textContent='v'+version;
 renderNav();renderContent();updateRail();
}
function renderNav(){
  el('profile-nav').innerHTML=app.profiles.map(p=>`<button data-profile="${esc(p.id)}" class="sidebar-button ${active===p.id?'active':''}" aria-label="${esc(p.name)}"><span>${svg(p.icon)}</span><small>${esc(p.short)}</small></button>`).join('');
  el('profile-nav').querySelectorAll('[data-profile]').forEach(node=>node.onclick=()=>{active=node.dataset.profile;render();el('main-area').scrollTop=0;});
  const btn=el('settings-nav');btn.classList.toggle('active',active==='settings');btn.onclick=()=>{active='settings';render();el('main-area').scrollTop=0;};
}
const heroTexts={
  home:['SYSTEM OVERVIEW','Your ship. One command center.','Favorite controls and quick access. Labels and bindings are editable in Settings.'],
  nav:['NAVIGATION SUITE','Travel without reaching for the keyboard.','Quantum travel, flight modes and energy distribution.'],
  scm:['COMBAT SUITE','Stay focused on the fight.','Targeting, weapons and defensive systems within easy reach.'],
  systems:['SHIP SYSTEMS','Every switch has a purpose.','Electrical systems, flight readiness, access and landing configuration.'],
  mining:['INDUSTRIAL SUITE','Precision at your fingertips.','Mining operator controls and an experimental local-value power slider.'],
  foot:['PERSONNEL SUITE','Equipment ready.','Useful on-foot controls for FPS activities and ground operations.'],
  utility:['AUXILIARY SUITE','Everything else, organized.','Cargo, salvage, EVA, camera and communication controls.'],
};
function renderContent(){
  if(active==='settings')return renderSettings();
  renderCockpitContent();
}

function bindingLabel(control){return control.kind==='slider'?'STEP KEYS': control.binding?control.binding.replace(/^(kb1_|mo1_)/i,'').replace(/mwheel_up/ig,'WHEEL UP').replace(/mwheel_down/ig,'WHEEL DOWN').replace(/\+/g,' + ').toUpperCase():'UNASSIGNED';}
function controlHTML(c){
  if(c.kind==='slider')return `<div class="slider-control"><div class="slider-head"><div><div class="slider-title">${esc(c.label)}</div><span class="ctl-mini">LOCAL VISUAL REFERENCE</span></div><div class="slider-val" id="val-${esc(c.id)}">${localSliders[c.id]??35}%</div></div><div class="slider-row"><button class="step-btn" data-step="${esc(c.id)}" data-direction="down" title="Decrease one step">−</button><input data-slider="${esc(c.id)}" type="range" min="0" max="100" value="${localSliders[c.id]??35}" aria-label="Local laser output preview"><button class="step-btn" data-step="${esc(c.id)}" data-direction="up" title="Increase one step">+</button></div><div class="slider-note">SLIDER IS A VISUAL GUIDE. ONLY THE ± BUTTONS SEND SINGLE INPUTS WHEN MAPPED.</div></div>`;
  let on=Boolean(localStates[c.id]);let symbol=c.kind==='toggle'?`<span class="micro-switch"><b></b></span>`:svg(c.kind==='hold'?'lock':c.confirm?'alert':'arrow');
  return `<button class="ctl ${c.confirm?'guarded ':''}${c.kind==='toggle'?'toggle-control ':''}${on?'active':''}" data-control="${esc(c.id)}" title="${esc(c.description)}"><span class="ctl-top"><span class="ctl-name">${esc(c.label)}</span><span class="ctl-glyph">${symbol}</span></span><span class="ctl-bottom"><span class="ctl-binding ${c.binding?'':'unmapped'}">${esc(bindingLabel(c))}</span><span class="ctl-mini">${c.kind==='toggle'?'COMMAND':c.kind==='hold'?'TOUCH + HOLD':c.confirm?'GUARDED':'EXECUTE'}</span></span></button>`;
}
function updateRail(){if(!app)return;
 const mapped=app.controls.filter(c=>c.binding||c.kind==='slider'&&(c.binding_up||c.binding_down)).length;
 const all=app.controls.length;
 const syncInfo=app.last_import?new Date(app.last_import).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Not imported';
 el('status-rail').innerHTML=`<div class="rail-title">MISSION CONTROL / 01</div>
 <div class="rail-block"><div class="rail-kicker">LOCAL CONNECTION</div><div class="rail-value blue">● SERENITY LINK</div><div class="rail-small">Your iPad is connected to the Windows companion.</div><span class="rail-chip">LAN / CONNECTED</span></div>
 <div class="rail-block"><div class="rail-kicker">KEYBOARD OUTPUT</div><div class="rail-value ${app.armed?'blue':'red'}">${app.armed?'ARMED':'DISARMED'}</div><div class="rail-small">${app.armed?'Star Citizen must be the foreground window.':'Commands cannot reach the game until enabled in Settings.'}</div><button class="small-action" id="rail-arm">${app.armed?'DISARM OUTPUT':'OPEN SETTINGS TO ARM'}</button></div>
 <div class="rail-block"><div class="rail-kicker">BINDING COVERAGE</div><div class="rail-value">${mapped} <span style="color:#577f9f">/ ${all}</span> ASSIGNED</div><div class="rail-progress"><span style="width:${Math.round(100*mapped/all)}%"></span></div><div class="rail-small">From effective game bindings and manual shortcuts. Unassigned MFD actions need in-game keys.</div></div>
 <div class="rail-block"><div class="rail-kicker">LAST PROFILE IMPORT</div><div class="rail-value">${esc(syncInfo)}</div><div class="rail-small">${esc(app.last_file?app.last_file.split(/[\\/]/).pop():'No XML selected')}</div></div>
 <div class="rail-block"><div class="rail-kicker">STATE REPORTING</div><div class="rail-value">COMMAND ONLY</div><div class="rail-small">Toggle indicators are local estimates, not live readings from your ship.</div></div>
 <div class="rail-ornament"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="65"/><circle cx="80" cy="80" r="49" stroke-dasharray="7 10"/><circle cx="80" cy="80" r="27"/><path d="M80 4v30M80 126v30M4 80h30M126 80h30M40 40l80 80M120 40l-80 80"/></svg></div>`;
 el('rail-arm').onclick=()=>{active='settings';settingsTab='connection';render();};
}
async function activate(id,direction){const ctl=app.controls.find(c=>c.id===id);if(!ctl)return;
  if(ctl.kind==='hold'){notify('Touch and hold '+ctl.label+' to activate; release to stop.',true);return;}
 if((!ctl.binding&&ctl.kind!=='slider')||(ctl.kind==='slider'&&!ctl['binding_'+direction])){
   notify('"'+ctl.label+'" has no keyboard shortcut assigned. Set its binding under Settings.',true);return;}
 if(!app.armed){notify('Output is disarmed. Open Settings → Connection to enable commands.',true);return;}
 if(ctl.confirm&&!window.confirm('Send '+ctl.label+' command to Star Citizen?'))return;
 try{await request('/api/action',{id,direction});
   // No ship-state telemetry: never latch a toggle LED after merely sending a command.
   if(ctl.kind==='slider')localSliders[id]=Math.max(0,Math.min(100,Number(localSliders[id]??35)+(direction==='up'?1:-1)));
   notify(ctl.label+' → command sent (ship state not verified)');renderContent();
 }catch(e){notify(e.message,true);}
}
// Pointer-held buttons: release on touch-up, focus loss or disconnection.
function stopTouchHold(id){
 const h=activeHoldTouches.get(id);
 if(!h || h.ended)return;
 h.ended=true;
 clearInterval(h.heartbeat);
 h.button.classList.remove('pulse');
 activeHoldTouches.delete(id);
 h.start.then(()=>request('/api/hold',{id,phase:'stop'})).catch(()=>{});
}
function beginTouchHold(id,button,event){
 if(activeHoldTouches.has(id))return;
 const ctl=app?.controls.find(x=>x.id===id);
 if(!ctl || ctl.kind!=='hold')return;
 if(!ctl.binding){notify(ctl.label+' has no keyboard or mouse-button binding.',true);return;}
 if(!app.armed){notify('Output is disarmed. Arm it in Settings → Connection.',true);return;}
 if(ctl.confirm){notify('Guarded controls cannot use continuous hold.',true);return;}
 if(event.button!==undefined && event.button!==0)return;
 event.preventDefault();
 try{button.setPointerCapture(event.pointerId);}catch(_){}
 const h={button,ended:false,heartbeat:null,start:null};
 activeHoldTouches.set(id,h);button.classList.add('pulse');
 h.start=request('/api/hold',{id,phase:'start'});
 h.start.then(()=>{
   if(h.ended)return;
   h.heartbeat=setInterval(()=>{
     if(h.ended)return;
     request('/api/hold',{id,phase:'heartbeat'}).catch(error=>{
       if(!h.ended){notify('Hold ended: '+error.message,true);stopTouchHold(id);}
     });
   },550);
   const line=el('cockpit-action-line');
   if(line)line.textContent=ctl.label.toUpperCase()+' / HELD UNTIL RELEASED';
 }).catch(error=>{if(!h.ended){notify(error.message,true);stopTouchHold(id);}});
}
window.addEventListener('blur',()=>{for(const id of [...activeHoldTouches.keys()])stopTouchHold(id);});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)for(const id of [...activeHoldTouches.keys()])stopTouchHold(id);
});
window.addEventListener('pagehide',()=>{
 for(const id of [...activeHoldTouches.keys()]){
   stopTouchHold(id);
   if(token)fetch('/api/hold',{method:'POST',keepalive:true,
     headers:{'X-Deck-Token':token,'Content-Type':'application/json'},
     body:JSON.stringify({id,phase:'stop'})}).catch(()=>{});
 }
});
function renderSettings(){
 el('main-area').innerHTML=`<div class="eyebrow">PREFERENCES / CONFIGURATION</div><div class="page-title"><div><h1>Deck Settings</h1><p>Configure keybindings, connection and interface behavior.</p></div><div class="page-index">SYSTEM / CFG</div></div>
 <div class="settings-tabs"><button data-tab="bindings" class="tab ${settingsTab==='bindings'?'active':''}">KEYBINDINGS</button><button data-tab="connection" class="tab ${settingsTab==='connection'?'active':''}">CONNECTION</button><button data-tab="updates" class="tab ${settingsTab==='updates'?'active':''}">UPDATES</button><button data-tab="about" class="tab ${settingsTab==='about'?'active':''}">ABOUT</button></div><div id="settings-body"></div>`;
 el('main-area').querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{settingsTab=btn.dataset.tab;renderSettings();});
 if(settingsTab==='bindings')renderBindingSettings();else if(settingsTab==='connection')renderConnectionSettings();else if(settingsTab==='updates')renderUpdateSettings();else renderAbout();
}
function bindingPeers(control){
  const report=app?.binding_report||{};
  const ids=report.shared_by_id?.[control.id]||[];
  return ids.map(id=>app.controls.find(c=>c.id===id)?.label||id);
}
function bindingConflictLabels(control){
  const ids=app?.binding_report?.conflicts_by_id?.[control.id]||[];
  return ids.map(id=>app.controls.find(c=>c.id===id)?.label||id);
}
function renderBindingSettings(){
 const choices=app.profiles.map(p=>`<option value="${esc(p.id)}" ${profileFilter===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
 el('settings-body').innerHTML=`<section class="settings-card"><div class="settings-heading">01 / XML PROFILE SYNCHRONIZATION</div><h3>Automatic keybinding import</h3><p>Combines custom bindings with an available local Star Citizen defaultProfile.xml and optionally monitors the live actionmaps.xml. The game's current files take precedence; default mappings are never guessed from external lists.</p>
 <div class="settings-row"><div class="field"><label for="xml-path">XML FILE OR MAPPINGS FOLDER ON SERENITY</label><input class="input" id="xml-path" value="${esc(app.source_path)}" placeholder="C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\USER\\Client\\0\\Controls\\Mappings"></div><button id="sync-btn" class="primary-btn">SYNC BINDINGS</button></div>
 <div class="settings-card defaults-import"><h3>Import current game bindings</h3><p>Merge your active Star Citizen <b>actionmaps.xml</b> customizations with a verified <b>4.10.2 LIVE default profile</b>, sourced from SC Keymap. No Data.p4k extraction or downloaded executable. Only the Deck's own mapping cache changes; your game settings and HOTAS are untouched. If Star Citizen updates beyond 4.10.2, review the baseline version before relying on new/changed game actions.</p><button id="get-game-defaults" class="primary-btn" type="button">IMPORT CURRENT BINDINGS</button><p id="defaults-import-status" class="hint" role="status">Currently ${app.defaults_count||0} game defaults available.</p></div>
 <div class="toggle-row"><div class="setting-meta"><strong>Automatically watch game bindings</strong><small>Checks selected profile, live actionmaps.xml and extracted defaultProfile.xml for changes every 3 seconds.</small></div><input id="auto-toggle" class="ios-switch" type="checkbox" ${app.auto_sync?'checked':''} aria-label="Automatic XML sync"></div>
 <div class="toggle-row"><div class="setting-meta"><strong>Prefer currently active game bindings</strong><small>Uses Star Citizen's live actionmaps.xml over saved exports when available.</small></div><input id="live-toggle" class="ios-switch" type="checkbox" ${app.prefer_live?'checked':''} aria-label="Use active game bindings"></div>
 <div class="warning-line">Last import: <b>${esc(app.last_import||'Never')}</b> · ${app.catalog.length} total actions · ${app.defaults_count||0} game defaults<br>Custom source: ${esc(app.sync_source||'None')} ${app.active_file?'<br>Active game file: '+esc(app.active_file):''}<br>Default source: ${app.defaults_file?esc(app.defaults_file)+(app.defaults_reference_version?' (reference '+esc(app.defaults_reference_version)+')':''):'Not found — optional extracted defaultProfile.xml needed for full defaults. Ship Lights L is included as your confirmed reference.'}${app.import_error?'<br><b>'+esc(app.import_error)+'</b>':''}</div></section>
 <section class="settings-card"><div class="settings-heading">02 / CONTROL MAPPING EDITOR</div><h3>Editable iPad controls</h3><p>Select an action to follow imported keyboard overrides and local game defaults. When defaults are unavailable, missing assignments stay unassigned instead of being guessed.</p><div class="binding-guidance">${app.binding_report?.shared_action_count||0} shared game actions · ${app.binding_report?.potential_conflict_count||0} potential shortcut overlaps. An overlap is only a warning: contexts may legitimately use the same key.</div>
 <div class="search-row"><input class="input" id="filter-text" placeholder="Search controls..." value="${esc(search)}"><select id="filter-profile" class="input" style="max-width:190px"><option value="all">All profiles</option>${choices}</select><button id="add-control-btn" class="primary-btn">+ ADD</button></div><div id="binding-results"></div></section>`;
 el('get-game-defaults').onclick=async()=>{
   if(!confirm('Import your effective keyboard bindings? This downloads a pinned 4.10.2 default XML (no executable), merges your live Star Citizen customizations and auto-links verified cockpit actions. Your game files and HOTAS settings will not change.'))return;
   const btn=el('get-game-defaults'),status=el('defaults-import-status');
   btn.disabled=true;btn.textContent='IMPORTING CURRENT BINDINGS…';status.textContent='Combining verified 4.10.2 defaults with your live game overrides. No game settings are being changed.';
   try{const result=await request('/api/defaults/extract',{confirm:'EXTRACT_DEFAULTS'});
       app=await request('/api/state');renderSettings();updateRail();
       notify('Imported '+result.defaults+' default actions and your active overrides. '+result.assigned+'/'+result.controls+' cockpit controls have keyboard inputs. Baseline: '+result.reference_version);
   }catch(e){btn.disabled=false;btn.textContent='RETRY IMPORT CURRENT BINDINGS';status.textContent='Could not import defaults: '+e.message;notify(e.message,true);}
 };
 el('sync-btn').onclick=async()=>{try{const p=el('xml-path').value.trim();const res=await request('/api/import',p?{path:p}:{});notify(`Synced ${res.total} actions (${res.defaults} game defaults) from ${res.source}`);app=await request('/api/state');renderSettings();updateRail();}catch(e){notify(e.message,true);}};
 el('auto-toggle').onchange=async ev=>{try{app=await request('/api/settings',{auto_sync:ev.target.checked});notify('Automatic sync '+(app.auto_sync?'enabled':'disabled'));}catch(e){notify(e.message,true);}};
 el('live-toggle').onchange=async ev=>{try{app=await request('/api/settings',{prefer_live:ev.target.checked});renderSettings();notify('Game binding source updated');}catch(e){notify(e.message,true);}};
 el('add-control-btn').onclick=()=>addControl();
 el('filter-text').oninput=e=>{search=e.target.value;renderBindingRows();};
 el('filter-profile').onchange=e=>{profileFilter=e.target.value;renderBindingRows();};
 renderBindingRows();
}
function renderBindingRows(){const term=search.toLowerCase().trim();const rows=app.controls.filter(c=>(profileFilter==='all'||c.profile===profileFilter)&&(!term||(c.label+' '+c.id+' '+c.section+' '+c.binding).toLowerCase().includes(term)));
 el('binding-results').innerHTML=`<div class="count-caption">${rows.length} CONTROLS</div><div class="binding-list">${rows.map(c=>`<div class="binding-row"><div><div class="binding-name">${esc(c.label)}</div><div class="binding-sub">${esc(c.profile.toUpperCase())} / ${esc(c.section)} · ${esc(c.manual?'MANUAL':c.action_ref?'XML LINKED':'NOT LINKED')}${bindingPeers(c).length?' · SHARED WITH '+esc(bindingPeers(c).join(', ')):''}${bindingConflictLabels(c).length?' · POSSIBLE SHORTCUT OVERLAP: '+esc(bindingConflictLabels(c).join(', ')):''}</div></div><div style="display:flex;align-items:center;gap:10px;min-width:0"><span class="binding-key ${c.binding?'':'empty'}" title="${esc(c.binding_source||'Not mapped')}">${esc(bindingLabel(c))}</span><button data-edit="${esc(c.id)}">EDIT</button></div></div>`).join('')}</div>`;
 el('binding-results').querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>editControl(btn.dataset.edit));
}
async function renderUpdateSettings(){
 el('settings-body').innerHTML=`<section class="settings-card"><div class="settings-heading">SOFTWARE / MAINTENANCE</div><h3>Companion updates</h3><p>Installed on Serenity: <strong>v${esc(app.version||'unknown')}</strong>. Existing controls, keyboard mappings, and pairing stay in your Windows user data folder.</p>
 <div class="update-console"><div class="update-indicator"><span class="update-led"></span><div><strong id="remote-update-title">Checking for releases…</strong><small id="remote-update-info">Public update mirror: GitHub Pages / star-citizen-deck.</small></div></div><button type="button" id="update-fetch" class="primary-btn" disabled>CHECKING…</button></div>
 <div class="modal-actions"><button id="update-check" type="button" class="secondary-btn">CHECK AGAIN</button></div>
 <details class="advanced-update"><summary>Advanced: install a trusted ZIP manually</summary><p>Use this only until the release channel is published or if Serenity cannot access GitHub. Keep the ZIP compressed.</p><div class="field"><label for="update-file">UPDATE PACKAGE (.ZIP)</label><input type="file" id="update-file" class="input" accept=".zip,application/zip"></div><div class="modal-actions"><button id="one-step-update" type="button" class="primary-btn">VERIFY ZIP, INSTALL &amp; RESTART</button></div></details>
 <div id="update-info" class="warning-line">Future updates use verified packages, persistent backups, and a Python import check. Keep START_DECK.bat open.</div></section>`;
 const info=el('remote-update-info'), title=el('remote-update-title'), fetchButton=el('update-fetch');
 async function check(){
  title.textContent='Checking release channel…'; fetchButton.disabled=true; fetchButton.textContent='CHECKING…';
  try {const r=await request('/api/update/check'); title.textContent=r.available?'UPDATE AVAILABLE: v'+r.latest:r.configured?'NO NEW RELEASE':'RELEASE CHANNEL NOT LIVE';
       info.textContent=r.note;fetchButton.disabled=!r.available;fetchButton.textContent=r.available?'INSTALL v'+r.latest:'UP TO DATE / OFFLINE';}
  catch(e){title.textContent='RELEASE CHECK FAILED';info.textContent=e.message;fetchButton.textContent='UNAVAILABLE';}
 }
 el('update-check').onclick=check;
 fetchButton.onclick=async()=>{
  if(!confirm('Install the verified published update and restart the Windows companion?'))return;
  fetchButton.disabled=true;fetchButton.textContent='VERIFYING RELEASE…';
  try{const r=await request('/api/update/fetch',{});await applyAndReconnect(r.version);}
  catch(e){info.textContent=e.message;notify(e.message,true);await check();}
 };
 el('one-step-update').onclick=async()=>{
  const file=el('update-file').files[0];if(!file)return notify('Select the trusted update ZIP first.',true);
  if(file.size>4_000_000)return notify('Update ZIP is larger than 4 MB.',true);
  if(!confirm('Verify this ZIP and install it on Serenity?'))return;
  const button=el('one-step-update');button.disabled=true;button.textContent='VERIFYING & INSTALLING…';
  try {
   const response=await fetch('/api/update/upload',{method:'POST',headers:{'X-Deck-Token':token,'Content-Type':'application/zip'},body:file,cache:'no-store'});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'ZIP upload failed');
   await applyAndReconnect(result.version);
  } catch(e){button.disabled=false;button.textContent='VERIFY ZIP, INSTALL & RESTART';el('update-info').textContent=e.message;notify(e.message,true);}
 };
 async function applyAndReconnect(version){
  await request('/api/update/apply',{confirm:'INSTALL'});
  el('update-info').textContent='Installing v'+version+' on Serenity. Waiting for the companion to reconnect…';
  const started=Date.now();
  while(Date.now()-started<40000){
   await new Promise(resolve=>setTimeout(resolve,1250));
   try{const response=await fetch('/api/hello',{cache:'no-store'});if(!response.ok)continue;
       const state=await response.json();if(state.version===version){window.location.reload();return;}}
   catch(_){ /* Installer momentarily stops the old server. */ }
  }
  el('update-info').textContent='The restart has not been confirmed. Check the companion window on Serenity before trying again.';
 }
 await check();
}
function renderConnectionSettings(){
 el('settings-body').innerHTML=`<section class="settings-card"><div class="settings-heading">01 / INPUT SAFETY</div><h3>Live keyboard output</h3><p>Every button sends one user-requested keyboard press to the foreground Star Citizen window only. The deck never reads game memory, modifies game files, or runs automatic command sequences.</p>
 <div class="toggle-row"><div class="setting-meta"><strong>Arm keyboard controls</strong><small>Resets to OFF whenever you restart the companion. Available on Windows only.</small></div><input id="arm-toggle" class="ios-switch" type="checkbox" ${app.armed?'checked':''} ${!app.can_send?'disabled':''} aria-label="Arm keyboard output"></div>
 <div class="warning-line">CURRENT INPUT METHOD: <b>${esc(app.input_mode==='scan'?'SCAN-CODE TEST':'VIRTUAL KEY')}</b>. Scan-code mode was selected automatically on the v0.2.4 upgrade, with no extra setting needed.</div>
 <div class="field"><label>GAME KEYBOARD DELIVERY</label><select id="input-mode" class="input" ${app.can_send?'':'disabled'}><option value="virtual" ${(app.input_mode||'virtual')==='virtual'?'selected':''}>Standard virtual-key (original)</option><option value="scan" ${app.input_mode==='scan'?'selected':''}>Physical scan-code (test)</option></select><p class="hint">Star Citizen may process scan codes differently from virtual-key events. Both use Windows SendInput; neither guarantees the game will accept a command. Notepad diagnostic remains unchanged.</p></div>
 <div class="warning-line">${app.can_send?'Input is supported by this Windows companion, but compatibility with the game and its anti-cheat is not guaranteed.':'This preview is running on '+esc(app.system)+'. Live key input requires running the companion on Windows.'}</div><div class="toggle-row"><div class="setting-meta"><strong>Start companion automatically when signing in to Windows</strong><small>One-time setup on Serenity. No administrator access required. The companion runs before Star Citizen opens, so you won't need the BAT file each session. You still arm controls manually.</small></div><input id="autostart-toggle" class="ios-switch" type="checkbox" ${app.start_at_login?'checked':''} ${!app.can_send?'disabled':''} aria-label="Start Windows companion when signing in"></div></section>
 <section class="settings-card"><div class="settings-heading">02 / SAFE WINDOWS DIAGNOSTIC</div><h3>Notepad keyboard test</h3><p>Open Notepad on Serenity, click into a blank document, and keep it in the foreground. This sends exactly one <b>L</b> keystroke only if Windows confirms the foreground process is Notepad. Normal ship controls remain Star Citizen-only.</p>
 <div class="modal-actions"><button id="notepad-test" type="button" class="secondary-btn" ${app.can_send?'':'disabled'}>SEND TEST L TO NOTEPAD</button></div>
 <div id="notepad-result" class="warning-line">Requires keyboard output ARMED. The diagnostic is never sent to Star Citizen.</div></section>
 <section class="settings-card"><div class="settings-heading">03 / LOCAL GAME LOG</div><h3>Read-only Session Intelligence</h3><p>The companion monitors your latest Game.log for game events. No memory access, game changes, or network uploads. Auto-detection usually finds the game next to your imported keybindings.</p><div class="field"><label>GAME.LOG PATH — OPTIONAL OVERRIDE</label><input id="game-log-path" class="input" type="text" value="${esc(app.game_log_path||'')}" placeholder="Auto-detect from installation" autocomplete="off"></div><div class="modal-actions"><button type="button" id="save-game-log-path" class="secondary-btn">SAVE LOG PATH</button></div><p class="hint">Leave empty for automatic detection. If no events appear, paste the full path to your Star Citizen LIVE/Game.log file.</p></section>
 <section class="settings-card"><div class="settings-heading">04 / DEVICE INFO</div><h3>Serenity companion</h3><div class="toggle-row"><div class="setting-meta"><strong>Platform</strong><small>${esc(app.system)} / Star Citizen Deck companion v${esc(app.version||"unknown")}</small></div><span class="pill">CONNECTED</span></div><div class="toggle-row"><div class="setting-meta"><strong>Game profile</strong><small>${esc(app.profile_label)}</small></div><span class="pill">LOCAL</span></div><div class="toggle-row"><div class="setting-meta"><strong>Saved configuration</strong><small>Persistent on your PC; independent from Mongrel HUD</small></div><span class="pill">LOCAL</span></div></section>`;
 el('save-game-log-path').onclick=async()=>{
  try{app=await request('/api/settings',{game_log_path:el('game-log-path').value});renderConnectionSettings();refreshSession();notify('Game.log path saved; event monitor will refresh.');}
  catch(e){notify(e.message,true);}
 };
 el('notepad-test').onclick=async()=>{
   const target=el('notepad-result');target.textContent='Checking Notepad foreground window and sending one L...';
   try{const result=await request('/api/diagnostic/notepad',{});
     target.textContent='Windows accepted test L. Check whether lowercase l appeared in Notepad. This does not verify Star Citizen input.';
     notify('Notepad diagnostic sent — check Notepad on Serenity');
   }catch(err){target.textContent=err.message;notify(err.message,true);}
 };
 el('input-mode').onchange=async e=>{
   try{app=await request('/api/settings',{input_mode:e.target.value});renderConnectionSettings();updateRail();notify('Input mode set to '+(app.input_mode==='scan'?'physical scan-code test':'standard virtual-key'));}
   catch(err){notify(err.message,true);renderConnectionSettings();}
 };
 el('autostart-toggle').onchange=async e=>{
   try{app=await request('/api/settings',{start_at_login:e.target.checked});renderConnectionSettings();notify(app.start_at_login?'Windows sign-in startup enabled. Companion stays available for Star Citizen.':'Windows sign-in startup disabled. Launch with BAT file when needed.');}
   catch(err){notify(err.message,true);renderConnectionSettings();}
 };
 el('arm-toggle').onchange=async e=>{if(e.target.checked&&!confirm('Arm the deck to send keyboard inputs to Star Citizen when it is in the foreground?')){e.target.checked=false;return;}
 try{app=await request('/api/settings',{armed:e.target.checked});renderConnectionSettings();updateRail();notify(app.armed?'Output ARMED — use caution':'Output safely DISARMED');}catch(err){notify(err.message,true);}};
}
function renderAbout(){el('settings-body').innerHTML=`<section class="settings-card"><div class="settings-heading">CONTROL DECK / BUILD 01</div><h3>Star Citizen Deck v${esc(app.version||"unknown")}</h3><p>Independent personal touchscreen companion for Star Citizen. Built with standard Python and browser technologies, no third-party dependencies, no installation or modification of game files.</p><div class="warning-line">Ship Lights has been confirmed working in Star Citizen on Serenity using scan-code keyboard input. Other commands remain unverified and may be ignored. Use only if allowed by the game's current rules. No macros or repeated unattended automation are implemented.</div></section><section class="settings-card"><h3>Known limits</h3><p>• No official live ship-state feed. Toggles are visual estimates.<br>• Defaults use a pinned 4.10.2 LIVE reference with your active overrides.<br>• Mouse buttons 1–5 and single vertical mouse-wheel steps supported; mouse movement, analog axes, joystick output are not.<br>• Keybinding importer does not change controls inside Star Citizen.<br>• Use on trusted LAN only: HTTP connection is not encrypted.</p></section>`;}
function editControl(id){const c=app.controls.find(x=>x.id===id);if(!c)return;
 const kindOptions=['button','toggle','hold','slider'].map(k=>`<option value="${k}" ${c.kind===k?'selected':''}>${k.toUpperCase()}</option>`).join('');
  const modal=`<div class="modal-wrap"><div class="modal" role="dialog" aria-modal="true" aria-label="Edit control"><div class="eyebrow">BINDING EDITOR / ${esc(c.profile.toUpperCase())}</div><h2>${esc(c.label)}</h2><p>Choose a linked XML action for automatic updates, or enter a keyboard shortcut manually.</p><form id="edit-form"><div class="modal-grid"><div class="field"><label>DISPLAY LABEL</label><input class="input" id="edit-label" value="${esc(c.label)}" required></div><div class="field"><label>CONTROL TYPE</label><select class="input" id="edit-kind">${kindOptions}</select></div></div>
 <div class="modal-grid"><div class="field"><label>PROFILE / PAGE</label><select class="input" id="edit-profile">${app.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===c.profile?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>CONTROL GROUP / SECTION</label><input class="input" id="edit-section" value="${esc(c.section)}" required></div></div>
 <div class="field"><label>BINDING SOURCE</label><select class="input" id="edit-source"><option value="xml" ${!c.manual?'selected':''}>Imported XML action (auto sync)</option><option value="manual" ${c.manual?'selected':''}>Manual keyboard mapping</option></select></div>
 <div class="field" id="action-field"><label>STAR CITIZEN ACTION ID</label><input class="input" id="edit-action" placeholder="Use Browse Imported Actions below" value="${esc(c.action_ref||'')}" autocapitalize="off" autocomplete="off" spellcheck="false"><div class="action-picker-tools"><button id="browse-actions" type="button" class="secondary-btn">BROWSE ${app.catalog.length} AVAILABLE ACTIONS</button><span class="hint" id="selected-action-status"></span></div><div id="action-picker" class="action-picker" hidden><label for="action-search">SEARCH GAME KEYBINDINGS</label><input class="input" id="action-search" type="search" placeholder="Search name, group or keyboard shortcut" autocomplete="off" autocapitalize="off" spellcheck="false"><div id="action-search-results" class="action-search-results"></div></div><div class="field"><label for="edit-share-action">USE THE SAME GAME ACTION AS ANOTHER CONTROL</label><select class="input" id="edit-share-action"><option value="">Choose a linked control...</option>${app.controls.filter(other=>other.id!==c.id&&!other.manual&&other.action_ref).map(other=>`<option value="${esc(other.id)}">${esc(other.label)} (${esc(other.profile.toUpperCase())})</option>`).join('')}</select></div><p class="hint">Linked controls inherit the same game action and binding. Choosing a manual shortcut affects only this control. Unknown game actions remain unassigned.</p></div>
 <div class="field" id="manual-field"><label>KEY OR MOUSE COMBINATION</label><input class="input" id="edit-manual" placeholder="e.g. LALT+R or F6" value="${esc(c.manual?c.binding:'')}"><p class="hint">Supports keyboard chords, MOUSE1–MOUSE5, MWHEEL_UP/MWHEEL_DOWN and modifier + mouse/wheel. No mouse movement, axes or macros.</p></div>
 <div class="field"><label>TAP DURATION (40–3000 MS) · HOLD CONTROLS RELEASE ON TOUCH-UP</label><input type="number" min="40" max="3000" class="input" id="edit-hold" value="${Number(c.hold_ms)||100}"></div>
 <div id="step-settings" class="modal-grid"><div class="field"><label>SLIDER STEP UP</label><input class="input" id="edit-up" placeholder="e.g. LALT+UP" value="${esc(c.binding_up||'')}"></div><div class="field"><label>SLIDER STEP DOWN</label><input class="input" id="edit-down" placeholder="e.g. LALT+DOWN" value="${esc(c.binding_down||'')}"></div></div>
 <div class="modal-actions">${c.id.startsWith("custom_")?'<button id="edit-delete" type="button" class="danger-btn">DELETE</button>':''}<button id="edit-cancel" type="button" class="secondary-btn">CANCEL</button><button type="submit" class="primary-btn">SAVE CONTROL</button></div></form></div></div>`;
 el('modal-root').innerHTML=modal;
 const updateVisible=()=>{
   const xml=el('edit-source').value==='xml';el('action-field').style.display=xml?'block':'none';el('manual-field').style.display=xml?'none':'block';el('step-settings').style.display=el('edit-kind').value==='slider'?'grid':'none';
 };
 el('edit-source').onchange=updateVisible;el('edit-kind').onchange=updateVisible;updateVisible();
 // iPad Safari does not reliably show HTML datalist suggestions. Use a real, filtered list.
 const picker=el('action-picker');
 const selectedStatus=el('selected-action-status');
 const describeSelected=()=>{
   const ref=el('edit-action').value.trim();
   const found=app.catalog.find(a=>a.ref===ref);
   const others=app.controls.filter(other=>other.id!==c.id&&!other.manual&&other.action_ref===ref).map(other=>other.label);
   const state=!ref?'No action chosen':found?(found.keyboard?'INPUT: '+found.keyboard.replace(/^(kb1_|mo1_)/i,'').toUpperCase()+' ('+(found.origin||'imported')+')':'No supported keyboard/mouse binding'):'Not in the imported game profile';
   selectedStatus.textContent=state+(others.length?' · Linked with '+others.join(', '):'');
 };
 const showImported=()=>{
   const q=el('action-search').value.trim().toLowerCase();
   const matching=app.catalog.map((a,i)=>({...a,idx:i})).filter(a=>(a.ref+' '+a.map+' '+a.name+' '+a.keyboard+' '+(a.raw||[]).join(' ')).toLowerCase().includes(q));
   const html=matching.map(a=>`<button type="button" class="action-option" data-action-index="${a.idx}"><span class="action-title">${esc(a.name.replace(/_/g,' '))}</span><span class="action-ref">${esc(a.ref)}</span><span class="action-binding ${a.keyboard?'':'action-unavailable'}">${esc(a.keyboard?a.keyboard.replace(/^(kb1_|mo1_)/i,'').toUpperCase():'NO SUPPORTED INPUT')} · ${esc(a.origin||'custom')}</span></button>`).join('');
   el('action-search-results').innerHTML=matching.length?html:`<div class="action-empty">No matching actions in your imported 4.10.2 game profile. Assign a game binding and sync, or enter a manual shortcut.</div>`;
   el('action-search-results').querySelectorAll('[data-action-index]').forEach(btn=>btn.onclick=()=>{
     const a=app.catalog[Number(btn.dataset.actionIndex)];
     if(!a)return;
     el('edit-action').value=a.ref;
     picker.hidden=true;
     el('browse-actions').textContent=`BROWSE ${app.catalog.length} AVAILABLE ACTIONS`;
     describeSelected();
   });
 };
 el('browse-actions').onclick=()=>{
   picker.hidden=!picker.hidden;
   el('browse-actions').textContent=picker.hidden?`BROWSE ${app.catalog.length} AVAILABLE ACTIONS`:'CLOSE ACTION LIST';
   if(!picker.hidden){showImported();el('action-search').focus();}
 };
 el('action-search').oninput=showImported;
 el('edit-action').oninput=describeSelected;
 el('edit-share-action').onchange=ev=>{
   const other=app.controls.find(x=>x.id===ev.target.value);
   if(other && !other.manual && other.action_ref){el('edit-action').value=other.action_ref;describeSelected();}
 };
 describeSelected();
 el('edit-cancel').onclick=()=>el('modal-root').innerHTML='';
 if(c.id.startsWith('custom_'))el('edit-delete').onclick=async()=>{if(confirm('Delete this custom control?')){try{await request('/api/control/delete',{id:c.id});app=await request('/api/state');el('modal-root').innerHTML='';render();}catch(e){notify(e.message,true);}}};
 el('edit-form').onsubmit=async e=>{e.preventDefault();const patch={id,label:el('edit-label').value,profile:el('edit-profile').value,section:el('edit-section').value,kind:el('edit-kind').value,hold_ms:Number(el('edit-hold').value)};
 if(el('edit-source').value==='xml')patch.action_ref=el('edit-action').value.trim();else patch.manual_binding=el('edit-manual').value.trim();
 if(patch.kind==='slider'){patch.binding_up=el('edit-up').value.trim();patch.binding_down=el('edit-down').value.trim();}
 try{await request('/api/control',patch);app=await request('/api/state');el('modal-root').innerHTML='';render();notify('Saved '+patch.label);}catch(err){notify(err.message,true);}};
}
/* Offline Layout Lab replaces the live companion startup. */

async function addControl(){
 const label=prompt('Name your new control:');if(!label)return;
 const profile=profileFilter==='all'?'home':profileFilter;
 try{const c=await request('/api/control/create',{label,profile});app=await request('/api/state');render();editControl(c.id);}catch(e){notify(e.message,true);}
}


/* Cockpit Concept 02 — integrated with the existing controller's validated actions.
   No synthetic ship telemetry. No change to Windows keyboard injection. */
const cockpitLayouts = {home:'Overview',nav:'Navigation',scm:'Combat',scan:'Scanning',mfd:'MFD Control',systems:'Ship systems',mining:'Mining',foot:'On foot',utility:'Utilities'};
const cockpitOrderKey='scdeck-cockpit-order-v1';
let cockpitArrange=false, cockpitSelected=null;
let cockpitOrder={};
try {
  const saved=JSON.parse(localStorage.getItem(cockpitOrderKey)||'{}');
  if(saved && typeof saved==='object' && !Array.isArray(saved))cockpitOrder=saved;
} catch(_){ cockpitOrder={}; }
function cockpitLookup(id){return app?.controls.find(c=>c.id===id&&c.profile===active);}
function cockpitMeta(c){
  if(!c)return '';
  const assign=c.kind==='slider' ? (c.binding_up||c.binding_down?'STEP MAPPED':'STEP UNMAPPED') : (c.binding?bindingLabel(c):'UNMAPPED');
  return esc(assign);
}
function cockpitPanel(title,num,tag,body,extra=''){
  return `<section class="module ${extra}"><i class="screw"></i><i class="screw right"></i><div class="module-head"><h2>${esc(title)}</h2><small>${esc(num)} &nbsp; / &nbsp; ${esc(tag)}</small></div><div class="module-body">${body}</div></section>`;
}
function cockpitControl(id,kind='pad',sym='✧',style=''){
  const c=cockpitLookup(id);if(!c)return '';
  const name=esc(c.label);const binding=cockpitMeta(c);
  const safety=c.confirm||style==='amber';
  const accessible=`data-control="${esc(c.id)}" title="${name} / ${binding} / ${esc(c.description||'')}" aria-label="${name}: ${binding}"`;
  const mapped=Boolean(c.binding)||Boolean(c.binding_up||c.binding_down);
  const unmap=mapped?'':' unmapped';
  if(c.kind==='slider')return `<div class="slider-control cockpit-slider" data-slider-control="${esc(c.id)}"><div class="slider-title">${name}</div><div class="ctl-mini">STEP COMMANDS ONLY / NO ANALOG AXIS</div><div class="range-steps"><button type="button" data-slider-step="-1" data-step-id="${esc(c.id)}">− STEP</button><button type="button" data-slider-step="1" data-step-id="${esc(c.id)}">+ STEP</button></div><small>${binding}</small></div>`;
  if(kind==='switch')return `<button type="button" class="switch-row ${safety?'amber':''}${unmap}" ${accessible}><span class="switch-label"><b>${name}</b><small>${safety?'CONFIRM · ':''}${binding}</small></span><span class="mechanism"><span class="lever"></span><i class="lamp"></i></span></button>`;
  if(kind==='choice')return `<button type="button" class="power-choice${unmap}" ${accessible}><span><b>${name}</b><small>${binding}</small></span><span class="chev">›</span></button>`;
  const decor=safety?'amber':style;
  return `<button type="button" class="pad ${decor}${unmap}" ${accessible}><i class="pad-led"></i><span class="pad-icon">${safety?'⛨':sym}</span><b>${name}</b><small>${safety?'CONFIRM · ':''}${c.kind==='hold'?(mapped?'TOUCH + HOLD':'UNMAPPED'):binding}</small></button>`;
}
function cockpitBig(id,caption,secondary=false){
  const c=cockpitLookup(id);if(!c)return '';
  return `<button type="button" class="big-button ${secondary?'secondary':''} ${c.binding?'':'unmapped'}" data-control="${esc(id)}" title="${esc(c.description||c.label)}"><b>${esc(c.label)}</b><span>${esc(c.binding?caption:'UNMAPPED / CONFIGURE IN SETTINGS')}</span></button>`;
}
function cockpitPair(ids,signs=[],style=''){return `<div class="control-grid">${ids.map((id,i)=>cockpitControl(id,'pad',signs[i]||'✧',style)).join('')}</div>`;}
function cockpitDisplay(kind='quantum'){
  const combat=kind==='target';
  return `<div class="display ${combat?'target':''}" aria-label="Schematic only; no live telemetry"><div class="readout-top"><span>${combat?'SENSORS / STANDBY':'NAV COMP / STANDBY'}</span><span>${combat?'NO LOCK DATA':'QUANTUM / UNKNOWN'}</span></div><div class="orbital"><i class="circle"></i><i class="circle two"></i><i class="circle three"></i><i class="sweep"></i><span class="symbol">${combat?'⊕':'⌾'}</span></div><div class="readout-label">${combat?'NO TARGET DATA':'NO ROUTE DATA'}</div><div class="readout-caption">${combat?'TARGET TELEMETRY NOT LINKED':'SHIP TELEMETRY NOT LINKED'}</div><div class="readout-bottom">SCHEMATIC DISPLAY ONLY &nbsp; / &nbsp; SCD-02</div></div>`;
}
function cockpitFooter(){return `<div class="bottom-strip"><div class="mini-module"><span class="mark">✦</span><div><b>INPUT PATH · WINDOWS SCAN-CODE</b><small>Game commands require a mapped control, armed output and Star Citizen in foreground.</small></div><span class="index">AUX 01</span></div><div class="mini-module"><span class="mark">⌁</span><div><b>ACTUAL SHIP STATE · UNKNOWN</b><small>Sending a command does not confirm a toggle, power level or system state.</small></div><span class="index">AUX 02</span></div></div>`;}
const panel=cockpitPanel,ctl=cockpitControl,pair=cockpitPair,display=cockpitDisplay,landingFooter=cockpitFooter;

function navScreen(){return `<div class="dashboard">
 ${panel('Flight control','01','MOBILITY',`<div class="microhead"><span>FLIGHT CONTROL MATRIX</span><span>SCM / NAV</span></div><div class="control-block">${['nav_cruise','nav_decouple','nav_vtol','nav_gear'].map(id=>ctl(id,'switch')).join('')}</div><div class="module-bottom">${pair(['nav_mode','nav_speed_reset'],['↔','↺'])}</div>`)}
 ${panel('Quantum operations','02','TRANSIT',`<div id="quantum-intelligence">${quantumIntelligenceHTML()}</div><div class="two-action">${cockpitBig('nav_spool','PREPARE QUANTUM',true)}${cockpitBig('nav_quantum','TOUCH + HOLD',false)}</div><div class="two-action">${cockpitBig('nav_cancel','SINGLE INPUT',true)}${cockpitBig('nav_request','LANDING SERVICES',true)}</div>`)}
 ${panel('Power distribution','03','ENERGY',`<div class="statlines"><div class="statline"><b>THRUSTER DISTRIBUTION</b><span>UNKNOWN</span></div><div class="statline"><b>SHIELD DISTRIBUTION</b><span>UNKNOWN</span></div><div class="statline"><b>WEAPON DISTRIBUTION</b><span>UNKNOWN</span></div></div><div class="microhead"><span>FOCUS COMMANDS</span><span>MANUAL</span></div><div class="control-block">${['nav_power_thrusters','nav_power_shields','nav_power_weapons','nav_power_reset'].map(id=>ctl(id,'choice')).join('')}</div><p class="subtle-note">Distribution percentages deliberately hidden: no live data source is connected.</p>`)}
 </div>${landingFooter()}`;}
function scmScreen(){return `<div class="dashboard">
 ${panel('Target acquisition','01','SENSORS',`<div class="microhead"><span>CONTACT / SELECTION</span><span>MANUAL</span></div>${pair(['scm_hostiles','scm_nearest'],['◎','◉'])}${pair(['scm_lock1','scm_lock2'],['①','②'])}<div class="module-bottom"><p class="subtle-note">The targeting reticle is a visual instrument. Target selections cannot be confirmed without game telemetry.</p></div>`)}
 ${panel('Combat operations','02','WEAPONS',`${display('target')}<div class="two-action">${cockpitBig('scm_aimmode','CYCLE',true)}${cockpitBig('scm_missiles','SINGLE INPUT',false)}</div>`)}
 ${panel('Defense matrix','03','PROTECTION',`<div class="microhead"><span>COUNTERMEASURES</span><span>CMD</span></div>${pair(['scm_decoy_less','scm_decoy','scm_decoy_more'],['−','✹','+'])}${pair(['scm_noise'],['◈'])}<div class="microhead"><span>POWER / DEFENSE</span><span>FOCUS</span></div>${['scm_shields','scm_weapons','scm_reset','scm_shield_reset'].map(id=>ctl(id,'choice')).join('')}<p class="subtle-note">These are command senders, not shield or weapon-state indicators.</p>`)}
 </div>${landingFooter()}`;}

function scanScreen(){return `<div class="dashboard scan-suite">
 ${panel('Scan operations','01','ACTIVE SCANNING',`<div class="microhead"><span>MODE / SCAN / PING</span><span>DIRECT INPUT</span></div>${pair(['scan_mode','scan_trigger','scan_ping'],['◈','◎','⌁'])}<p class="subtle-note">SCAN TARGET and RADAR PING use touch-and-hold. Ship telemetry and scan results are not available to this controller.</p>`)}
 ${panel('Scanning angle','02','ADJUST',`<div class="microhead"><span>SCAN CONE ANGLE</span><span>ONE STEP PER TAP</span></div>${pair(['scan_focus_less','scan_focus_more'],['−','+'])}<p class="subtle-note">Uses your current binding. Star Citizen defaults these actions to mouse wheel down/up; each tap sends one step.</p>`)}
 ${panel('Scan display navigation','03','CONTACT DATA',`<div class="microhead"><span>SCAN TABS</span><span>PREV / NEXT</span></div>${pair(['scan_tab_prev','scan_tab_next'],['◂','▸'])}<div class="microhead"><span>SCAN PAGES</span><span>PREV / NEXT</span></div>${pair(['scan_page_prev','scan_page_next'],['◂','▸'])}<div class="microhead"><span>CONTACTS</span><span>PREV / NEXT</span></div>${pair(['scan_contact_prev','scan_contact_next'],['◂','▸'])}<div class="microhead"><span>CONTACT PAGES</span><span>PREV / NEXT</span></div>${pair(['scan_contact_page_prev','scan_contact_page_next'],['◂','▸'])}`)}
 </div>${landingFooter()}`;}
function mfdScreen(){return `<div class="dashboard mfd-suite">
 ${panel('Select a cockpit display','01','FOCUS',`<div class="microhead"><span>FIRST SELECT AN MFD</span><span>STEP 1</span></div>${pair(['mfd_primary','mfd_cast_left','mfd_cast_right'],['▣','◂','▸'])}<div class="microhead"><span>NUMBERED SLOTS</span><span>1–10</span></div><div class="control-grid mfd-slots">${Array.from({length:10},(_,i)=>ctl('mfd_'+(i+1),'pad',String(i+1))).join('')}</div><p class="subtle-note">MFD focus shortcuts are unassigned in the 4.10.2 defaults. Configure only the displays you use, in the game keybindings.</p>`)}
 ${panel('Choose a screen','02','PAGE',`<div class="microhead"><span>THEN CHOOSE A VIEW</span><span>STEP 2</span></div><div class="control-grid mfd-pages">${['mfd_self','mfd_target','mfd_scanning','mfd_config','mfd_comms','mfd_ifcs','mfd_diagnostics','mfd_resources'].map(id=>ctl(id,'pad','▤')).join('')}</div><p class="subtle-note">Screen shortcuts are also unbound by default. Selecting a page sends one game action to the focused MFD; it does not detect or remember the ship's display state.</p>`)}
 ${panel('Cycle the focused display','03','ALTERNATIVE',`<div class="microhead"><span>PREVIOUS / NEXT PAGE</span><span>DEFAULT BINDINGS</span></div>${pair(['mfd_page_prev','mfd_page_next'],['◂','▸'])}<p class="subtle-note">LALT+Q / LALT+E are the 4.10.2 default cycle shortcuts. Your live game overrides still take precedence.</p>`)}
 </div>${landingFooter()}`;}
function sysScreen(){return `<div class="dashboard systems">
 ${panel('Electrical bus','01','CORE',`<div class="microhead"><span>HARDWARE COMMANDS</span><span>MANUAL</span></div><div class="control-block">${['ship_power','engine_power','sys_shields','sys_weapons','sys_lights'].map(id=>ctl(id,'switch')).join('')}</div><div class="module-bottom">${pair(['sys_flight_ready'],['ϟ'])}</div>`)}
 ${panel('Access & hatches','02','GUARDED',`<div class="guard-hardware"><div class="guard-symbol">⌑</div><div class="guard-desc">SAFETY COVER / CONFIRM BEFORE ACTION</div>${pair(['open_all_doors','close_all_doors'],['↟','↡'],'amber')}</div><div class="control-block">${['sys_lock','sys_ramp'].map(id=>ctl(id,'switch')).join('')}</div><p class="subtle-note">Guard confirmation will be required when the real controller is armed.</p>`)}
 ${panel('Landing config','03','GROUND',`<div class="microhead"><span>LANDING SUPPORT</span><span>CMD</span></div><div class="control-block">${['sys_gear','sys_vtol'].map(id=>ctl(id,'switch')).join('')}</div><div class="module-bottom">${pair(['sys_atc'],['⌂'],'accent')}</div><div class="statlines"><div class="statline"><b>LANDING GEAR</b><span>UNKNOWN</span></div><div class="statline"><b>VTOL STATE</b><span>UNKNOWN</span></div></div>`)}
 </div>${landingFooter()}`;}
function miningScreen(){return `<div class="dashboard mining">
 ${panel('Laser operations','01','EXTRACTION',`<div class="microhead"><span>INDUSTRIAL INPUT</span><span>CMD</span></div>${pair(['mine_mode','mine_laser'],['◆','⇧'])}${pair(['mine_switch','mine_ping'],['↻','⌁'])}${pair(['mine_gimbal'],['⊕'])}<p class="subtle-note">Controls send your assigned keyboard or mouse inputs only while armed.</p>`)}
 ${panel('Laser output','02','REFERENCE',`<div class="range-display"><span class="range-label">LOCAL VISUAL REFERENCE</span><span class="range-value" id="range-value">${localSliders['mining_power']??37}<span style="font-size:28px">%</span></span><span class="subtle-note">NOT A LIVE LASER POWER READING</span></div><input class="range-slider" type="range" min="0" max="100" value="${localSliders['mining_power']??37}" id="power-slider" data-source-control="mining_power" aria-label="Local example slider"><div class="range-steps"><button data-slider-step="-1">− STEP</button><button data-slider-step="1">+ STEP</button></div><p class="subtle-note">Dragging is preview-only. The real deck's ± step keys send a single mapped keystroke, if configured.</p>`)}
 ${panel('Consumables','03','UTILITY',`<div class="microhead"><span>ASSIGNABLE SLOTS</span><span>3 BANKS</span></div>${pair(['mine_slot1','mine_slot2'],['Ⅰ','Ⅱ'])}${pair(['mine_slot3'],['Ⅲ'])}<div class="module-bottom"><div class="statline"><b>LASER HEAT</b><span>UNKNOWN</span></div><div class="statline"><b>ROCK STABILITY</b><span>UNKNOWN</span></div><div class="statline"><b>RESOURCES</b><span>UNKNOWN</span></div></div>`)}
 </div>${landingFooter()}`;}
function genericScreen(){
 const mine=app.controls.filter(c=>c.profile===active);
 const groups=[...new Set(mine.map(c=>c.section))];
 const banks=groups.map((g,i)=>panel(g,String(i+1).padStart(2,'0'),'CONTROL BANK',`<div class="control-grid">${mine.filter(c=>c.section===g).map(c=>active==='home'&&g==='Quick actions'?ctl(c.id,'pad'):c.kind==='toggle'?ctl(c.id,'switch'):ctl(c.id)).join('')}</div>`)).join('');
 const session=panel('Session intelligence','03','GAME.LOG',`<div id="session-intelligence">${sessionIntelligenceHTML()}</div>`,active==='home'?'home-session-panel':'');
 // Home is a command surface first: ship specifications follow the control banks.
 const ship=active==='home'?'<section id="ship-intelligence" class="ship-banner" aria-label="Ship intelligence">'+shipIntelligenceHTML()+'</section>':'';
 return `<div class="dashboard generic ${active==='home'?'home-dashboard':''}">${banks}${ship}${session}</div>${landingFooter()}`;
}

function renderCockpitContent(){
  const main=el('main-area');
  const selected=app.profiles.find(p=>p.id===active); if(!selected)return;
  const title=cockpitLayouts[active]||selected.name;
  cockpitSelected=null;
  const layout=(active==='nav'?navScreen():active==='scm'?scmScreen():active==='systems'?sysScreen():active==='mining'?miningScreen():active==='scan'?scanScreen():active==='mfd'?mfdScreen():genericScreen());
  const homeCompact=active==='home';
  const heading=homeCompact?'<div class="eyebrow">HOME / FLIGHT CONTROLS</div>':`<div><div class="eyebrow">SERENITY / ${esc(selected.short||active.toUpperCase())} / LIVE COMMAND DECK</div><div class="title-row"><h1>${esc(title)}</h1><span>FLIGHT STATION · ${esc(app.version||'')}</span></div></div>`;
  main.innerHTML=`<section class="cockpit2">
    <div class="cockpit2-heading ${homeCompact?'home-compact-heading':''}">${heading}<button type="button" id="cockpit-arrange" class="secondary-btn" aria-pressed="${cockpitArrange}">${cockpitArrange?'✓ FINISH ARRANGING':'◈ ARRANGE CONTROLS'}</button></div>
    ${homeCompact?'':`<div class="cockpit-note" role="note"><span class="pilot-dot"></span><b>COMMAND CONSOLE</b><span>Buttons send inputs only when armed. Detected ship identity comes from Game.log; published ship specifications are reference data, not live readings.</span></div>`}
    <div id="cockpit-arrange-tools" class="arrange-toolbar ${cockpitArrange?'open':''}"><strong>ARRANGE MODE / THIS iPAD ONLY</strong><span class="hint" id="cockpit-selection">Select a control to move within its bank.</span><button type="button" data-shift="back">◀ MOVE</button><button type="button" data-shift="forward">MOVE ▶</button></div>
    <div id="cockpit-layout" class="cockpit-layout">${layout}</div><div class="cockpit-action-line" id="cockpit-action-line" aria-live="polite">${app.armed?'KEYBOARD OUTPUT ARMED':'OUTPUT DISARMED'} / SHIP STATE NOT VERIFIED</div>
   </section>`;
  const visible=new Set([...main.querySelectorAll('[data-control]')].map(b=>b.dataset.control));
  main.querySelectorAll('[data-source-control],[data-slider-control]').forEach(e=>visible.add(e.dataset.sourceControl||e.dataset.sliderControl));
  const extra=app.controls.filter(c=>c.profile===active && !visible.has(c.id));
  if(extra.length){
    const bank=document.createElement('section');bank.className='module cockpit-extra';
    bank.innerHTML=`<div class="module-head"><h2>Additional controls</h2><small>USER CONFIGURED / ${extra.length}</small></div><div class="module-body"><div class="control-grid">${extra.map(c=>cockpitControl(c.id,c.kind==='toggle'?'switch':'pad')).join('')}</div></div>`;
    main.querySelector('.dashboard').appendChild(bank);
  }
  applyCockpitOrder();
  main.querySelectorAll('[data-control]').forEach(btn=>{
    const id=btn.dataset.control;
    const model=app.controls.find(c=>c.id===id);
    if(model?.kind==='hold'){
      btn.style.touchAction='none';
      btn.onpointerdown=e=>{if(!cockpitArrange)beginTouchHold(id,btn,e);};
      btn.onpointerup=()=>stopTouchHold(id);
      btn.onpointercancel=()=>stopTouchHold(id);
      btn.onlostpointercapture=()=>stopTouchHold(id);
    }
    btn.onclick=()=>{
      if(cockpitArrange){cockpitSelected=id;
        main.querySelectorAll('.edit-selected').forEach(e=>e.classList.remove('edit-selected'));
        btn.classList.add('edit-selected');
        el('cockpit-selection').textContent=(cockpitLookup(cockpitSelected)?.label||'Control')+' selected';
        return;}
      if(model?.kind==='hold')return;
      activate(id);
    };
  });
  main.querySelectorAll('[data-slider-step]').forEach(b=>b.onclick=()=>{
    if(cockpitArrange)return;
    activate(b.dataset.stepId||'mining_power',Number(b.dataset.sliderStep)>0?'up':'down');
  });
  const slider=main.querySelector('#power-slider');
  if(slider){slider.oninput=()=>{
    localSliders['mining_power']=Number(slider.value);
    const label=el('range-value');if(label)label.innerHTML=esc(slider.value)+'<span style="font-size:28px">%</span>';
    el('cockpit-action-line').textContent='LOCAL VISUAL REFERENCE ONLY / DRAGGING DOES NOT SEND KEYS';
  };}
  main.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>shiftCockpitControl(b.dataset.shift));
  el('cockpit-arrange').onclick=()=>{cockpitArrange=!cockpitArrange;renderCockpitContent();};
}
function applyCockpitOrder(){
 const layout=el('cockpit-layout');if(!layout)return;
 const groups=cockpitOrder[active]||{};
 layout.querySelectorAll('.control-grid,.control-block').forEach((parent,index)=>{
  const saved=Array.isArray(groups[index])?groups[index]:[];
  for(const id of saved){const node=[...parent.children].find(child=>child.dataset.control===id);if(node)parent.appendChild(node);}
 });
}
function shiftCockpitControl(direction){
 if(!cockpitSelected)return;
 const layout=el('cockpit-layout');
 const node=[...layout.querySelectorAll('[data-control]')].find(e=>e.dataset.control===cockpitSelected);
 if(!node)return;
 const group=node.parentElement;
 const items=[...group.children].filter(e=>e.dataset.control);
 const index=items.indexOf(node);
 const target=direction==='back'?items[index-1]:items[index+1];
 if(!target)return;
 if(direction==='back')group.insertBefore(node,target);else group.insertBefore(target,node);
 const bank=[...layout.querySelectorAll('.control-grid,.control-block')].indexOf(group);
 if(bank>=0){cockpitOrder[active]??={};cockpitOrder[active][bank]=[...group.children].filter(e=>e.dataset.control).map(e=>e.dataset.control);
  try{localStorage.setItem(cockpitOrderKey,JSON.stringify(cockpitOrder));}catch(_){}
 }
 el('cockpit-selection').textContent='Saved on this iPad only. Game mappings unchanged.';
}

/*
 * OFFLINE LAYOUT LAB — public static preview of the v0.2.23 controller.
 * No auth, Star Citizen, Serenity, or network APIs are used.
 * Edits remain in this iPad's browser storage until the user exports a JSON file.
 */
const labFactory={"profiles":[{"id":"home","name":"Overview","short":"HOME","subtitle":"Command center","icon":"grid"},{"id":"nav","name":"Navigation","short":"NAV","subtitle":"Transit & maneuvering","icon":"compass"},{"id":"scm","name":"Combat","short":"SCM","subtitle":"Weapons & defense","icon":"target"},{"id":"scan","name":"Scanning","short":"SCAN","subtitle":"Scanning and contact management","icon":"radar"},{"id":"mfd","name":"MFD Control","short":"MFD","subtitle":"Display selection and MFD pages","icon":"grid"},{"id":"systems","name":"Ship Systems","short":"SYS","subtitle":"Power & access","icon":"cpu"},{"id":"mining","name":"Mining","short":"MINE","subtitle":"Extraction operations","icon":"pickaxe"},{"id":"foot","name":"On Foot","short":"FPS","subtitle":"Personal equipment","icon":"person"},{"id":"utility","name":"Utilities","short":"UTIL","subtitle":"Cargo, EVA & camera","icon":"sliders"}],"controls":[{"id":"home_master","label":"Master Modes","kind":"button","action_ref":null,"description":"Switch NAV / SCM; link your assigned shortcut","profile":"home","section":"Flight essentials","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_landing","label":"Landing Gear","kind":"toggle","action_ref":null,"description":"Local indication only; not aircraft telemetry","profile":"home","section":"Flight essentials","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_lights","label":"Exterior Lights","kind":"toggle","action_ref":null,"description":"Local indication only","profile":"home","section":"Flight essentials","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_hail","label":"Takeoff / Landing Request","kind":"button","action_ref":null,"description":"Request departure or arrival clearance","profile":"home","section":"Flight essentials","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_flight_ready","label":"Flight Ready","kind":"button","action_ref":null,"description":"Ship startup action","profile":"home","section":"Flight essentials","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_ping","label":"Radar Ping","kind":"hold","action_ref":"spaceship_radar/v_invoke_ping","description":"Hold and release to transmit one radar ping","profile":"home","section":"Quick actions","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"home_light_amp","label":"Light Amplification","kind":"toggle","action_ref":"seat_general/v_light_amplification_toggle","description":"Toggle ship light amplification; actual state is not available","profile":"home","section":"Quick actions","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_mode","label":"NAV / SCM","kind":"hold","action_ref":null,"description":"Master mode switch; configure a hold if required","profile":"nav","section":"Quantum & transit","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_quantum","label":"Quantum Engage","kind":"hold","action_ref":null,"description":"Touch and hold to engage a calibrated quantum jump; release to stop the input","profile":"nav","section":"Quantum & transit","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_spool","label":"Quantum Spool","kind":"button","action_ref":null,"description":"Only if separately bound in current version","profile":"nav","section":"Quantum & transit","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_cancel","label":"Cancel Quantum","kind":"button","action_ref":null,"description":"Only if supported by game mapping","profile":"nav","section":"Quantum & transit","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_cruise","label":"Cruise Control","kind":"toggle","action_ref":"spaceship_movement/v_ifcs_toggle_cruise_control","description":"Local state estimate","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_decouple","label":"Decoupled","kind":"toggle","action_ref":"spaceship_movement/v_ifcs_toggle_vector_decoupling","description":"Local state estimate","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_speed_reset","label":"Speed Limiter Reset","kind":"button","action_ref":"spaceship_movement/v_ifcs_speed_limiter_reset_scm","description":"Reset to SCM speed","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_vtol","label":"VTOL","kind":"toggle","action_ref":null,"description":"Toggle VTOL","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_gear","label":"Landing Gear","kind":"toggle","action_ref":null,"description":"Toggle landing gear","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_request","label":"Takeoff / Landing Request","kind":"button","action_ref":null,"description":"ATC departure or arrival request","profile":"nav","section":"Flight management","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_power_thrusters","label":"Focus Thrusters","kind":"button","action_ref":"spaceship_power/v_power_focus_thrusters","description":"Power focus","profile":"nav","section":"Power distribution","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_power_shields","label":"Focus Shields","kind":"button","action_ref":"spaceship_power/v_power_focus_shields","description":"Power focus","profile":"nav","section":"Power distribution","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_power_weapons","label":"Focus Weapons","kind":"button","action_ref":"spaceship_power/v_power_focus_weapons","description":"Power focus","profile":"nav","section":"Power distribution","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"nav_power_reset","label":"Reset Distribution","kind":"button","action_ref":"spaceship_power/v_power_reset_focus","description":"Return power focus","profile":"nav","section":"Power distribution","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_hostiles","label":"Cycle Hostiles","kind":"button","action_ref":"spaceship_targeting_advanced/v_target_cycle_hostile_fwd","description":"Next hostile","profile":"scm","section":"Targeting","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_nearest","label":"Nearest Hostile","kind":"button","action_ref":null,"description":"Find a hostile target","profile":"scm","section":"Targeting","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_lock1","label":"Target Pin 1","kind":"button","action_ref":"spaceship_targeting/v_target_toggle_lock_index_1","description":"Lock pinned target 1","profile":"scm","section":"Targeting","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_lock2","label":"Target Pin 2","kind":"button","action_ref":"spaceship_targeting/v_target_toggle_lock_index_2","description":"Lock pinned target 2","profile":"scm","section":"Targeting","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_aimmode","label":"Aim Mode","kind":"button","action_ref":"spaceship_weapons/v_weapon_cycle_aimmode","description":"Cycle aim settings","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_missiles","label":"Missile Launch","kind":"button","action_ref":"spaceship_missiles/v_weapon_launch_missile","description":"Send one launch input","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_decoy","label":"Deploy Decoy","kind":"button","action_ref":"spaceship_defensive/v_weapon_countermeasure_decoy_launch","description":"Launch selected decoy burst","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_decoy_less","label":"Decoy −","kind":"button","action_ref":"spaceship_defensive/v_weapon_countermeasure_decoy_burst_decrease","description":"Reduce decoys per burst","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_decoy_more","label":"Decoy +","kind":"button","action_ref":"spaceship_defensive/v_weapon_countermeasure_decoy_burst_increase","description":"Increase decoys per burst","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_noise","label":"Deploy Noise","kind":"button","action_ref":"spaceship_defensive/v_weapon_countermeasure_noise_launch","description":"Countermeasures","profile":"scm","section":"Weapons & defensive","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_shields","label":"Focus Shields","kind":"button","action_ref":"spaceship_power/v_power_focus_shields","description":"Power focus","profile":"scm","section":"Combat power","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_weapons","label":"Focus Weapons","kind":"button","action_ref":"spaceship_power/v_power_focus_weapons","description":"Power focus","profile":"scm","section":"Combat power","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_reset","label":"Reset Power","kind":"button","action_ref":"spaceship_power/v_power_reset_focus","description":"Reset focus","profile":"scm","section":"Combat power","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scm_shield_reset","label":"Reset Shield Faces","kind":"button","action_ref":"spaceship_defensive/v_shield_reset_level","description":"Shield equalization","profile":"scm","section":"Combat power","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_mode","label":"Scanning Mode","kind":"button","action_ref":"seat_general/v_toggle_scan_mode","description":"Toggle ship scanning mode","profile":"scan","section":"Scan operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_trigger","label":"Scan Target","kind":"hold","action_ref":"spaceship_scanning/v_scanning_trigger_scan","description":"Hold to scan target; no default keyboard shortcut","profile":"scan","section":"Scan operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_ping","label":"Radar Ping","kind":"hold","action_ref":"spaceship_radar/v_invoke_ping","description":"Hold and release to transmit a radar ping","profile":"scan","section":"Scan operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_focus_less","label":"Angle −","kind":"button","action_ref":"spaceship_scanning/v_dec_scan_focus_level","description":"Decrease scanning angle by one mouse-wheel step","profile":"scan","section":"Scanning angle","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_focus_more","label":"Angle +","kind":"button","action_ref":"spaceship_scanning/v_inc_scan_focus_level","description":"Increase scanning angle by one mouse-wheel step","profile":"scan","section":"Scanning angle","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_tab_prev","label":"Previous Tab","kind":"button","action_ref":"spaceship_scanning/v_ui_prev_scan_tab","description":"Previous scan tab","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_tab_next","label":"Next Tab","kind":"button","action_ref":"spaceship_scanning/v_ui_next_scan_tab","description":"Next scan tab","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_page_prev","label":"Previous Page","kind":"button","action_ref":"spaceship_scanning/v_ui_prev_scan_page","description":"Previous scan page","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_page_next","label":"Next Page","kind":"button","action_ref":"spaceship_scanning/v_ui_next_scan_page","description":"Next scan page","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_contact_prev","label":"Previous Contact","kind":"button","action_ref":"spaceship_scanning/v_ui_prev_contact","description":"Previous scanned contact","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_contact_next","label":"Next Contact","kind":"button","action_ref":"spaceship_scanning/v_ui_next_contact","description":"Next scanned contact","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_contact_page_prev","label":"Contact Page −","kind":"button","action_ref":"spaceship_scanning/v_ui_prev_contact_page","description":"Previous scanned contact page","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"scan_contact_page_next","label":"Contact Page +","kind":"button","action_ref":"spaceship_scanning/v_ui_next_contact_page","description":"Next scanned contact page","profile":"scan","section":"Scan display navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_primary","label":"Primary MFD","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_primary_short","description":"Focus primary MFD before choosing a page","profile":"mfd","section":"Select display","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_cast_left","label":"Left Cast","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_cast_left_short","description":"Select left MFD cast","profile":"mfd","section":"Select display","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_cast_right","label":"Right Cast","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_cast_right_short","description":"Select right MFD cast","profile":"mfd","section":"Select display","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_1","label":"MFD 1","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_1_short","description":"Focus numbered MFD 1 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_2","label":"MFD 2","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_2_short","description":"Focus numbered MFD 2 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_3","label":"MFD 3","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_3_short","description":"Focus numbered MFD 3 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_4","label":"MFD 4","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_4_short","description":"Focus numbered MFD 4 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_5","label":"MFD 5","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_5_short","description":"Focus numbered MFD 5 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_6","label":"MFD 6","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_6_short","description":"Focus numbered MFD 6 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_7","label":"MFD 7","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_7_short","description":"Focus numbered MFD 7 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_8","label":"MFD 8","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_8_short","description":"Focus numbered MFD 8 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_9","label":"MFD 9","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_9_short","description":"Focus numbered MFD 9 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_10","label":"MFD 10","kind":"button","action_ref":"vehicle_mfd/v_mfd_soft_select_mfd_10_short","description":"Focus numbered MFD 10 before changing view","profile":"mfd","section":"Select MFD slot","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_self","label":"Self Status","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_self_status_short","description":"Show own ship status on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_target","label":"Target Status","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_target_status_short","description":"Show target status on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_scanning","label":"Scanning","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_scanning_short","description":"Show scanning view on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_config","label":"Configuration","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_configuration_short","description":"Show configuration view on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_comms","label":"Comms","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_comms_short","description":"Show communications on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_ifcs","label":"IFCS","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_ifcs_short","description":"Show IFCS screen on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_diagnostics","label":"Diagnostics","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_diagnostics_short","description":"Show diagnostics on focused MFD","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_resources","label":"Resource Network","kind":"button","action_ref":"vehicle_mfd/v_mfd_select_view_resource_network_short","description":"Show engineering resource network","profile":"mfd","section":"Choose display page","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_page_prev","label":"Previous View","kind":"button","action_ref":"vehicle_mfd/v_mfd_interact_cycle_backwards_short","description":"Cycle selected MFD backward","profile":"mfd","section":"Cycle views","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mfd_page_next","label":"Next View","kind":"button","action_ref":"vehicle_mfd/v_mfd_interact_cycle_forwards_short","description":"Cycle selected MFD forward","profile":"mfd","section":"Cycle views","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"ship_power","label":"Ship Power","kind":"toggle","action_ref":null,"description":"Single keyboard shortcut; requires confirmation","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":true,"manual":false},{"id":"engine_power","label":"Thruster Power","kind":"toggle","action_ref":null,"description":"Single keyboard shortcut; requires confirmation","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":true,"manual":false},{"id":"sys_shields","label":"Shields","kind":"toggle","action_ref":null,"description":"Single shortcut","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_weapons","label":"Weapons","kind":"toggle","action_ref":null,"description":"Single shortcut","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_flight_ready","label":"Flight Ready","kind":"button","action_ref":null,"description":"Ship startup","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_lights","label":"Ship Lights","kind":"toggle","action_ref":null,"description":"Exterior lights","profile":"systems","section":"Primary systems","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"open_all_doors","label":"Open All Doors","kind":"button","action_ref":null,"description":"Single shortcut; requires confirmation","profile":"systems","section":"Hatches & access","binding":"","hold_ms":100,"confirm":true,"manual":false},{"id":"close_all_doors","label":"Close All Doors","kind":"button","action_ref":null,"description":"Single shortcut; requires confirmation","profile":"systems","section":"Hatches & access","binding":"","hold_ms":100,"confirm":true,"manual":false},{"id":"sys_lock","label":"Door Lock","kind":"toggle","action_ref":null,"description":"Lock/unlock doors","profile":"systems","section":"Hatches & access","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_ramp","label":"Exterior Access","kind":"toggle","action_ref":null,"description":"Ramp / access command","profile":"systems","section":"Hatches & access","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_gear","label":"Landing Gear","kind":"toggle","action_ref":null,"description":"Landing gear","profile":"systems","section":"Landing configuration","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_vtol","label":"VTOL","kind":"toggle","action_ref":null,"description":"VTOL mode","profile":"systems","section":"Landing configuration","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"sys_atc","label":"Takeoff / Landing Request","kind":"button","action_ref":null,"description":"Request ATC takeoff or landing","profile":"systems","section":"Landing configuration","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_mode","label":"Mining Mode","kind":"button","action_ref":null,"description":"Enter mining operator mode","profile":"mining","section":"Mining operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_laser","label":"Mining Laser","kind":"hold","action_ref":null,"description":"Hold to fire; needs binding","profile":"mining","section":"Mining operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_switch","label":"Switch Laser","kind":"button","action_ref":null,"description":"Swap mining heads","profile":"mining","section":"Mining operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_ping","label":"Scan Ping","kind":"button","action_ref":null,"description":"Scan area","profile":"mining","section":"Mining operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_gimbal","label":"Mining Gimbal","kind":"button","action_ref":null,"description":"Cycle gimbal","profile":"mining","section":"Mining operations","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mining_power","label":"Laser Power","kind":"slider","action_ref":null,"description":"Visualization only until increment/decrement keys are mapped","profile":"mining","section":"Laser output • step control","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_slot1","label":"Consumable 01","kind":"button","action_ref":null,"description":"Activate slot 1","profile":"mining","section":"Consumables","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_slot2","label":"Consumable 02","kind":"button","action_ref":null,"description":"Activate slot 2","profile":"mining","section":"Consumables","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"mine_slot3","label":"Consumable 03","kind":"button","action_ref":null,"description":"Activate slot 3","profile":"mining","section":"Consumables","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_weapon","label":"Draw / Holster","kind":"button","action_ref":null,"description":"Weapon quick access","profile":"foot","section":"Equipment","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_medpen","label":"Medical Item","kind":"button","action_ref":null,"description":"Use equipped med item","profile":"foot","section":"Equipment","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_grenade","label":"Grenade","kind":"button","action_ref":null,"description":"Quick throw/equip","profile":"foot","section":"Equipment","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_flash","label":"Flashlight","kind":"toggle","action_ref":null,"description":"Weapon / helmet light","profile":"foot","section":"Equipment","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_inventory","label":"Inventory","kind":"button","action_ref":null,"description":"Open inventory","profile":"foot","section":"Interaction & navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_mobiglas","label":"mobiGlas","kind":"button","action_ref":null,"description":"Open mobiGlas","profile":"foot","section":"Interaction & navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_interact","label":"Interaction","kind":"hold","action_ref":null,"description":"Hold interaction command","profile":"foot","section":"Interaction & navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"fps_map","label":"Map","kind":"button","action_ref":null,"description":"Navigation map","profile":"foot","section":"Interaction & navigation","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_tractor","label":"Tractor Beam","kind":"button","action_ref":null,"description":"Equipment control","profile":"utility","section":"Cargo & service","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_cargo","label":"Cargo Interface","kind":"button","action_ref":null,"description":"Open cargo / inventory","profile":"utility","section":"Cargo & service","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_salvage","label":"Salvage Mode","kind":"button","action_ref":null,"description":"Operator mode","profile":"utility","section":"Cargo & service","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_scan","label":"Scan Mode","kind":"button","action_ref":null,"description":"Scanner mode","profile":"utility","section":"Cargo & service","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_camera","label":"External Camera","kind":"button","action_ref":null,"description":"Camera mode","profile":"utility","section":"Camera & communication","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_screenshot","label":"Screenshot","kind":"button","action_ref":null,"description":"Capture frame","profile":"utility","section":"Camera & communication","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_comms","label":"Comms","kind":"hold","action_ref":null,"description":"Push to talk; hold behavior","profile":"utility","section":"Camera & communication","binding":"","hold_ms":100,"confirm":false,"manual":false},{"id":"util_eva","label":"EVA Utility","kind":"button","action_ref":null,"description":"Custom EVA mapping","profile":"utility","section":"Camera & communication","binding":"","hold_ms":100,"confirm":false,"manual":false}]};
const labKey='scdeck-layout-lab-v1';
const labFields=['label','profile','section','kind'];
const labProfiles=new Set(labFactory.profiles.map(p=>p.id));
const labKinds=new Set(['button','toggle','hold','slider']);
function labNormalizeOrder(saved){
 const ids=labFactory.profiles.map(p=>p.id);
 const chosen=Array.isArray(saved)?saved.filter(id=>typeof id==='string'&&labProfiles.has(id)):[];
 return [...new Set([...chosen,...ids])];
}
let labPage='home';

function labNormalize(value){
 if(!value || value.schema!=='scdeck-layout-lab-v1' || typeof value.controls!=='object' || Array.isArray(value.controls))
  throw new Error('This is not a Layout Lab export.');
 const edits={};
 for(const source of labFactory.controls){
  const entry=value.controls[source.id];
  if(!entry)continue;
  if(typeof entry!=='object'||Array.isArray(entry))continue;
  const next={};
  for(const key of labFields){
   if(key==='profile' && labProfiles.has(entry.profile))next.profile=entry.profile;
   else if(key==='kind' && labKinds.has(entry.kind))next.kind=entry.kind;
   else if((key==='label'||key==='section') && typeof entry[key]==='string' && entry[key].trim() && entry[key].length<=90)
    next[key]=entry[key].trim();
  }
  if(Object.keys(next).length)edits[source.id]=next;
 }
 const validIds=new Set(labFactory.controls.map(c=>c.id));
 const order={};
 if(value.order && typeof value.order==='object' && !Array.isArray(value.order)){
  for(const [page,groups] of Object.entries(value.order)){
   if(!labProfiles.has(page)||typeof groups!=='object'||Array.isArray(groups))continue;
   const safe={};
   for(const [bank,ids] of Object.entries(groups)){
    if(!/^\d{1,3}$/.test(bank)||!Array.isArray(ids))continue;
    safe[bank]=[...new Set(ids.filter(id=>typeof id==='string'&&validIds.has(id)))].slice(0,180);
   }
   order[page]=safe;
  }
 }
 return {schema:'scdeck-layout-lab-v1',controls:edits,order,profileOrder:labNormalizeOrder(value.profileOrder)};
}
function labRead(){
 try{
  const raw=localStorage.getItem(labKey);
  return raw?labNormalize(JSON.parse(raw)):labNormalize({schema:'scdeck-layout-lab-v1',controls:{},order:{}});
 }catch(_){return {schema:'scdeck-layout-lab-v1',controls:{},order:{}};}
}
function labSnapshot(){
 const edits={};
 for(const base of labFactory.controls){
  const c=app.controls.find(x=>x.id===base.id);
  if(!c)continue;
  const delta={};
  for(const field of labFields)if(c[field]!==base[field])delta[field]=c[field];
  if(Object.keys(delta).length)edits[base.id]=delta;
 }
 return {schema:'scdeck-layout-lab-v1',source_version:'0.2.23',lab_revision:2,controls:edits,order:cockpitOrder,profileOrder:app.profiles.map(p=>p.id)};
}
function labSave(){
 try{localStorage.setItem(labKey,JSON.stringify(labSnapshot()));}
 catch(_){notify('Browser storage is unavailable. Export this layout before closing Safari.',true);}
}
function labApply(snapshot){
 const cleaned=labNormalize(snapshot);
 app.controls=labFactory.controls.map(x=>({...x,...(cleaned.controls[x.id]||{})}));
 cockpitOrder=cleaned.order;
 app.profiles=cleaned.profileOrder.map(id=>labFactory.profiles.find(p=>p.id===id));
 try{localStorage.setItem(cockpitOrderKey,JSON.stringify(cockpitOrder));}catch(_){}
 labSave();
}
function labExport(){
 const raw=JSON.stringify(labSnapshot(),null,2);
 const blob=new Blob([raw],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='star-citizen-layout-lab-v0.2.23.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function labEditor(){
 const c=app.controls.find(x=>x.id===labPage);
 if(c)labEditControl(c.id);
}
function labEditControl(id){
 const c=app.controls.find(x=>x.id===id);
 if(!c)return;
 const opts=labFactory.profiles.map(p=>'<option value="'+esc(p.id)+'" '+(c.profile===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('');
 const kinds=['button','toggle','hold','slider'].map(k=>'<option value="'+k+'" '+(c.kind===k?'selected':'')+'>'+k.toUpperCase()+'</option>').join('');
 el('modal-root').innerHTML=`<div class="modal-wrap"><div class="modal" role="dialog" aria-modal="true" aria-label="Layout Lab editor">
   <div class="eyebrow">OFFLINE LAYOUT EDITOR</div><h2>${esc(c.label)}</h2>
   <p>Appearance only. Game bindings and companion settings are not available in this offline preview.</p>
   <form id="lab-edit-form">
    <div class="field"><label>BUTTON LABEL</label><input id="lab-edit-label" class="input" maxlength="90" required value="${esc(c.label)}"></div>
    <div class="modal-grid">
     <div class="field"><label>PROFILE / PAGE</label><select id="lab-edit-profile" class="input">${opts}</select></div>
     <div class="field"><label>CONTROL STYLE</label><select id="lab-edit-kind" class="input">${kinds}</select></div>
    </div>
    <div class="field"><label>GROUP / SECTION</label><input id="lab-edit-section" class="input" maxlength="90" required value="${esc(c.section)}"></div>
    <div class="settings-row"><button class="primary-btn" type="submit">SAVE LOCALLY</button><button class="secondary-btn" id="lab-edit-cancel" type="button">CANCEL</button></div>
   </form></div></div>`;
 el('lab-edit-cancel').onclick=()=>el('modal-root').innerHTML='';
 el('lab-edit-form').onsubmit=e=>{
  e.preventDefault();
  const label=el('lab-edit-label').value.trim(),section=el('lab-edit-section').value.trim();
  if(!label||!section)return;
  Object.assign(c,{label:label.slice(0,90),section:section.slice(0,90),profile:el('lab-edit-profile').value,kind:el('lab-edit-kind').value});
  labSave();el('modal-root').innerHTML='';render();notify('Saved on this iPad. Export to keep a transferable copy.');
 };
}
function labMoveProfile(id,delta){
 const index=app.profiles.findIndex(p=>p.id===id),target=index+delta;
 if(index<0||target<0||target>=app.profiles.length)return;
 [app.profiles[index],app.profiles[target]]=[app.profiles[target],app.profiles[index]];
 labSave();renderNav();labSettings();
}
function labSettings(){
 const current=app.controls.filter(c=>c.profile===labPage);
 const choices=app.profiles.map(p=>'<option value="'+esc(p.id)+'" '+(labPage===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('');
 const rows=current.map(c=>'<button type="button" class="lab-item" data-lab-edit="'+esc(c.id)+'"><span><b>'+esc(c.label)+'</b><small>'+esc(c.section)+' · '+esc(c.kind)+'</small></span><span>EDIT</span></button>').join('');
 const profiles=app.profiles.map((p,i)=>'<div class="lab-profile-row"><span><b>'+esc(p.name)+'</b><small>'+esc(p.short)+' · position '+(i+1)+'</small></span><div class="lab-profile-actions"><button type="button" data-lab-move="'+esc(p.id)+'" data-delta="-1" aria-label="Move '+esc(p.name)+' up" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-lab-move="'+esc(p.id)+'" data-delta="1" aria-label="Move '+esc(p.name)+' down" '+(i===app.profiles.length-1?'disabled':'')+'>↓</button></div></div>').join('');
 el('main-area').innerHTML=`<div class="lab-settings"><div class="eyebrow">OFFLINE / YOUR TRAVEL IPAD</div>
  <div class="page-title"><div><h1>Layout Lab</h1><p>Edit the display layout without connecting to Serenity.</p></div><div class="page-index">PREVIEW / 0.2.23 · LAB 2</div></div>
  <section class="settings-card"><h3>Layout editing</h3><p>These are the factory controls from v0.2.23, not Serenity's personalized labels or keybindings. Changes are saved only on this iPad. Open any profile to use ARRANGE CONTROLS for ordering.</p>
  <div class="field"><label>CHOOSE PAGE</label><select class="input" id="lab-profile">${choices}</select></div>
  <div class="lab-list">${rows}</div></section>
  <section class="settings-card"><h3>Sidebar profile order</h3><p>Use the large up/down buttons to change the order of profiles on the left. Changes take effect immediately and are saved with your exported layout.</p><div class="lab-profile-list">${profiles}</div></section>
  <section class="settings-card"><h3>Transfer your layout</h3><p>Export a JSON file to preserve your labels, profile assignments, control ordering, and sidebar profile order. Import it into Layout Lab on another device. Importing directly into the Serenity companion is not yet supported.</p>
  <div class="settings-row"><button id="lab-export" class="primary-btn" type="button">EXPORT LAYOUT JSON</button><label class="secondary-btn lab-import-label" for="lab-import">IMPORT LAYOUT JSON</label><input id="lab-import" type="file" accept=".json,application/json" hidden></div>
  <p class="hint">Keep your export in Files or iCloud. Do not enter account credentials or game files here.</p></section></div>`;
 el('lab-profile').onchange=e=>{labPage=e.target.value;labSettings();};
 el('main-area').querySelectorAll('[data-lab-edit]').forEach(b=>b.onclick=()=>labEditControl(b.dataset.labEdit));
 el('main-area').querySelectorAll('[data-lab-move]').forEach(b=>b.onclick=()=>labMoveProfile(b.dataset.labMove,Number(b.dataset.delta)));
 el('lab-export').onclick=labExport;
 el('lab-import').onchange=async e=>{
  const f=e.target.files?.[0];if(!f)return;
  if(f.size>100000) {notify('Layout file is too large.',true);return;}
  try{labApply(JSON.parse(await f.text()));render();notify('Layout imported to this iPad.');}
  catch(err){notify(err.message||'Import failed',true);}
 };
}
const liveRenderCockpit=renderCockpitContent;
renderCockpitContent=function(){
 liveRenderCockpit();
 const node=el('main-area').querySelector('.cockpit2');
 if(node)node.insertAdjacentHTML('afterbegin','<div class="lab-banner" role="status"><strong>OFFLINE PREVIEW · v0.2.23 / LAB 2</strong> No Serenity connection. Controls cannot affect the game; edits stay on this iPad.</div>');
};
const liveShiftCockpit=shiftCockpitControl;
shiftCockpitControl=function(dir){liveShiftCockpit(dir);labSave();};
renderSettings=labSettings;
request=async function(){throw new Error('This is an offline preview; no PC or game is connected.');};
activate=async function(){notify('PREVIEW ONLY — no game commands are sent.');};
beginTouchHold=function(){notify('PREVIEW ONLY — hold commands are disabled.');};
stopTouchHold=function(){};
function labStartup(){
 app={version:'0.2.23',profiles:labFactory.profiles,controls:labFactory.controls.map(x=>({...x})),catalog:[],armed:false,
 source_path:'',last_import:'',last_file:'',binding_report:{shared_by_id:{},conflicts_by_id:{}}};
 labApply(labRead());
 // This ship is only a size/layout example; no Game.log has been read.
 sessionData={status:'missing',vehicle_name:'Ares Star Fighter Ion (example)',vehicle_status:'Unconfirmed',
   events:[],location_activity:'Unavailable offline',jurisdiction:'Unavailable offline',quantum_target:'Unavailable offline'};
 shipReference={status:'snapshot',ship:{name:'Ares Star Fighter Ion (example)',crew:1,cargo_capacity:0,
   scm_speed:205,max_speed:1050,shield_hp:21120,hull_hp:38600,manufacturer:'Crusader Industries',
   role:'Heavy Fighter',version:'DEMO',equipment:[]}};
 el('settings-icon').innerHTML=svg('settings');
 el('top-link').className='connection-chip offline';
 el('top-link').innerHTML='<span class="dot"></span>OFFLINE PREVIEW';
 const serial=document.querySelector('.topbar .serial');
 if(serial)serial.textContent='TRAVEL EDITOR • NO PC REQUIRED';
 const footer=el('deck-footer-version');
 if(footer)footer.innerHTML='<b>STAR CITIZEN DECK</b> / LAYOUT LAB';
 clock();
 render();
}
window.addEventListener('DOMContentLoaded',labStartup);
