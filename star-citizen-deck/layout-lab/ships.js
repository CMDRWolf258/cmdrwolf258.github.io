/* Ship Information — saved locally as part of Layout Lab exports. */
'use strict';
let shipSelected="ion",shipTab="overview";
let shipTracker={ion:{owned:{},notes:{},shipNotes:"",loadout:"standard",loadoutNotes:{},custom:[]},andromeda:{owned:{},notes:{},shipNotes:"",loadout:"balanced",loadoutNotes:{},custom:[]}};
const shipExpandedParts=new Set(),shipExpandedGroups=new Set(["ion:Shields","andromeda:Shields"]);
const shipURL=x=>typeof x==="string"&&/^https:\/\/[^ "'<>]+$/i.test(x)&&x.length<650?x:"";
const shipText=(x,max=500)=>String(x||"").slice(0,max);
const shipMoney=n=>n>0?Number(n).toLocaleString("en-US")+" aUEC":"Price TBD";
function shipStateNormalize(input){
 const out={};
 for(const ship of ["ion","andromeda"]){
  const raw=input&&typeof input==="object"&&input[ship]&&typeof input[ship]==="object"?input[ship]:{};
  const custom=[];
  if(Array.isArray(raw.custom))for(const item of raw.custom.slice(0,40)){
   if(!item||!/^c-[a-z0-9-]{4,40}$/.test(item.id||""))continue;
   if(custom.some(i=>i.id===item.id)||!String(item.name||"").trim())continue;
   custom.push({id:item.id,name:shipText(item.name,90),cat:shipCategories.includes(item.cat)?item.cat:"Other",
    size:shipText(item.size,70),qty:Math.max(1,Math.min(24,Number(item.qty)||1)),
    price:Math.max(0,Math.min(50000000,Math.round(Number(item.price)||0))),
    shop:shipText(item.shop,180),alt:shipText(item.alt,180),image:shipURL(item.image),source:shipURL(item.source),
    loadout:validShipLoadout(ship,item.loadout)?item.loadout:"shared",
    pro:shipText(item.pro),con:shipText(item.con),verify:"My added part"});
  }
  const owned={},notes={};
  for(const item of [...shipSeed[ship],...custom]){
   if(Array.isArray(raw.owned?.[item.id]))
    owned[item.id]=Array.from({length:item.qty},(_,index)=>raw.owned[item.id][index]===true);
   if(typeof raw.notes?.[item.id]==="string")notes[item.id]=raw.notes[item.id].slice(0,3000);
  }
  const loadout=validShipLoadout(ship,raw.loadout)?raw.loadout:shipLoadouts[ship][0].id;
  const loadoutNotes={};
  if(raw.loadoutNotes&&typeof raw.loadoutNotes==="object")for(const preset of shipLoadouts[ship]){
   if(typeof raw.loadoutNotes[preset.id]==="string")loadoutNotes[preset.id]=raw.loadoutNotes[preset.id].slice(0,5000);
  }
  out[ship]={owned,notes,shipNotes:shipText(raw.shipNotes,8000),custom,loadout,loadoutNotes};
 }
 return out;
}
const shipItems=id=>[...shipSeed[id],...shipTracker[id].custom].filter(p=>!p.loadout||p.loadout==="shared"||p.loadout===shipTracker[id].loadout);
const shipFlags=(id,item)=>Array.from({length:item.qty},(_,i)=>shipTracker[id].owned[item.id]?.[i]===true);
function shipTotals(id){
 let all=0,done=0,cost=0,left=0;
 for(const item of shipItems(id)){
  const bought=shipFlags(id,item).filter(Boolean).length;
  all+=item.qty;done+=bought;cost+=item.price*item.qty;left+=item.price*(item.qty-bought);
 }
 return {all,done,cost,left};
}
function shipPartCard(id,item){
 const flags=shipFlags(id,item),done=flags.filter(Boolean).length;
 const photo=shipURL(item.image)?'<img class="ship-part-image" src="'+esc(item.image)+'" alt="'+esc(item.name)+' component" loading="lazy">':"";
 const source=shipURL(item.source)?'<a href="'+esc(item.source)+'" target="_blank" rel="noopener noreferrer">COMPONENT REFERENCE</a>':"";
 const boxes=flags.map((checked,i)=>'<label class="ship-unit '+(checked?"checked":"")+'"><input type="checkbox" data-ship-unit="'+esc(item.id)+'" data-index="'+i+'" '+(checked?"checked":"")+' aria-label="'+esc(item.name)+' unit '+(i+1)+'"><span>'+(i+1)+'</span></label>').join("");
 const remove=item.id.startsWith("c-")?'<button type="button" class="ship-remove" data-ship-remove="'+esc(item.id)+'">REMOVE CUSTOM PART</button>':"";
 return '<details class="ship-part" data-ship-detail="'+esc(item.id)+'" '+(shipExpandedParts.has(id+":"+item.id)?"open":"")+'>'
  +'<summary><span class="ship-part-name"><b>'+esc(item.name)+'</b><small>'+esc(item.size)+'</small></span>'
  +'<span class="ship-part-price">'+shipMoney(item.price)+' <small>each</small></span>'
  +'<span class="ship-part-progress '+(done===item.qty?"complete":"")+'">'+done+' / '+item.qty+' purchased</span></summary>'
  +'<div class="ship-part-detail"><div class="ship-item-identity">'+photo+'<div><div class="ship-detail-row"><small>WHERE TO BUY</small><b>'+esc(item.shop||"Not entered")+'</b></div>'
  +(item.alt?'<p>'+esc(item.alt)+'</p>':"")+'<div class="ship-detail-row"><small>PRICE PER UNIT</small><b>'+shipMoney(item.price)+'</b></div>'
  +'<small>'+esc(item.verify||"Estimate")+'</small><div class="ship-link">'+source+'</div></div></div>'
  +'<div class="ship-procons"><div><h4>PROS</h4><p>'+esc(item.pro||"Add advantages to your notes.")+'</p></div><div><h4>CONS / TRADEOFFS</h4><p>'+esc(item.con||"Add tradeoffs to your notes.")+'</p></div></div>'
  +'<div class="ship-purchased"><b>PURCHASED · '+done+' OF '+item.qty+'</b><div class="ship-unit-list">'+boxes+'</div></div>'
  +'<label class="ship-note-label">MY NOTES<textarea rows="2" data-ship-part-note="'+esc(item.id)+'" placeholder="Build and installation notes…">'+esc(shipTracker[id].notes[item.id]||"")+'</textarea></label>'+remove+'</div></details>';
}
function renderShipInfo(){
 const id=shipSelected,ship=shipLibrary[id],parts=shipItems(id),tot=shipTotals(id);
 const shipTabs=Object.keys(shipLibrary).map(k=>'<button type="button" data-ship-choice="'+k+'" class="'+(k===id?"active":"")+'">'+esc(shipLibrary[k].short)+'</button>').join("");
 const specs='<div class="ship-specs">'+ship.specs.map(([label,value])=>'<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>').join("")+'</div>';
 const prose=(title,lines)=>'<section class="ship-prose"><h3>'+title+'</h3>'+lines.map(x=>'<p>• '+esc(x)+'</p>').join("")+'</section>';
 const presets=shipLoadouts[id];
 const activePreset=presets.find(x=>x.id===shipTracker[id].loadout)||presets[0];
 const loadoutButtons=presets.length>1?'<div class="ship-loadout-picker"><div class="ship-loadout-title"><b>SELECT WEAPON LOADOUT</b><small>Shared component upgrades carry across all builds</small></div><div class="ship-loadout-grid">'
 +presets.map(x=>'<button type="button" data-ship-loadout="'+x.id+'" class="'+(x.id===activePreset.id?'active':'')+'"><b>'+esc(x.name)+'</b><small>'+esc(x.tag)+'</small></button>').join("")
 +'</div></div>':'';
 const loadoutOverview='<div class="ship-loadout-overview"><h3>'+esc(activePreset.name)+' · WEAPON CONFIGURATION</h3>'
  +'<p>'+esc(activePreset.summary)+'</p><div class="ship-loadout-specs"><div><small>PILOT-OPERATED</small><b>'+esc(activePreset.pilot)+'</b></div><div><small>MANNED TURRETS</small><b>'+esc(activePreset.turrets)+'</b></div></div>'
  +'<p>'+esc(activePreset.practical)+'</p><div class="ship-procons"><div><h4>ADVANTAGES</h4><p>'+esc(activePreset.pro)+'</p></div><div><h4>TRADEOFFS</h4><p>'+esc(activePreset.con)+'</p></div></div></div>';
 const loadoutNotes='<div class="ship-note-card"><h3>'+esc(activePreset.name.toUpperCase())+' · MY LOADOUT NOTES</h3><textarea id="ship-loadout-notes" rows="3" placeholder="Testing, target types, fitting order…">'+esc(shipTracker[id].loadoutNotes?.[activePreset.id]||"")+'</textarea></div>';
 const overview=specs+'<div class="ship-procons">'+prose("STRENGTHS",ship.pros)+prose("TRADEOFFS",ship.cons)+'</div>'
  +'<div class="ship-note-card"><h3>STOCK LOADOUT / BUILD STARTING POINT</h3><p>'+esc(ship.stock)+'</p><a href="'+esc(ship.source)+'" target="_blank" rel="noopener noreferrer">SHIP REFERENCE</a></div>';
 let categories="";
 for(const category of shipCategories){
  const group=parts.filter(p=>p.cat===category);if(!group.length)continue;
  const bought=group.reduce((n,item)=>n+shipFlags(id,item).filter(Boolean).length,0),total=group.reduce((n,item)=>n+item.qty,0);
  const key=id+":"+category;
  categories+='<details class="ship-category" data-ship-category="'+esc(category)+'" '+(shipExpandedGroups.has(key)?"open":"")+'>'
  +'<summary><b>'+esc(category)+'</b><span>'+bought+" / "+total+' units</span></summary><div class="ship-part-list">'
  +group.map(item=>shipPartCard(id,item)).join("")+'</div></details>';
 }
 const build='<div class="ship-budget"><div><small>PURCHASED</small><b>'+tot.done+' / '+tot.all+' units</b></div>'
 +'<div><small>BUILD ESTIMATE</small><b>'+shipMoney(tot.cost)+'</b></div>'
 +'<div><small>EST. REMAINING</small><b>'+shipMoney(tot.left)+'</b></div></div>'
 +'<p class="ship-market-note">Prices are aUEC estimates from 4.10.2–4.10.3 market reports; older or unconfirmed sellers are identified in the part details. Only parts for the selected loadout are counted. Missile options represent purchases, not the ship’s entire missile capacity.</p>'
 +'<div class="ship-build-heading"><h2>PARTS CHECKLIST</h2><button id="ship-add-part" class="primary-btn" type="button">+ ADD PART</button></div>'
 +categories+loadoutNotes+'<div class="ship-note-card"><h3>MY SHIP BUILD NOTES</h3><textarea id="ship-global-notes" rows="4" placeholder="Overall strategy, remaining tasks, flight test observations…">'+esc(shipTracker[id].shipNotes)+'</textarea></div>';
 const main=el("main-area");
 main.innerHTML='<section class="ship-workspace"><div class="ship-title-line"><div class="eyebrow">SHIP INFORMATION / MY HANGAR</div></div>'
  +'<div class="ship-switch">'+shipTabs+'</div>'
  +'<div class="ship-hero"><img src="'+esc(ship.image)+'" alt="'+esc(ship.name)+' ship photograph" loading="eager">'
  +'<div class="ship-hero-info"><small>'+esc(ship.manufacturer)+'</small><h1>'+esc(ship.name)+'</h1><p>'+esc(ship.description)+'</p>'
  +'<div class="ship-chips"><span>'+esc(ship.role)+'</span><span>CREW '+esc(ship.crew)+'</span><span>'+esc(ship.focus)+'</span></div></div></div>'
  +'<div class="ship-tabs"><button data-ship-tab="overview" class="'+(shipTab==="overview"?"active":"")+'">SHIP OVERVIEW</button>'
  +'<button data-ship-tab="build" class="'+(shipTab==="build"?"active":"")+'">BUILD & PURCHASE TRACKER</button></div>'
  +(shipTab==="overview"?overview:loadoutButtons+loadoutOverview+build)+'</section>';
 main.querySelectorAll("[data-ship-choice]").forEach(btn=>btn.onclick=()=>{shipSelected=btn.dataset.shipChoice;shipTab="overview";renderShipInfo();});
 main.querySelectorAll("[data-ship-tab]").forEach(btn=>btn.onclick=()=>{shipTab=btn.dataset.shipTab;renderShipInfo();});
 main.querySelectorAll("[data-ship-loadout]").forEach(btn=>btn.onclick=()=>{
  if(!validShipLoadout(id,btn.dataset.shipLoadout))return;
  shipTracker[id].loadout=btn.dataset.shipLoadout;labSave();renderShipInfo();
 });
 if(shipTab==="build"){
  main.querySelectorAll("[data-ship-category]").forEach(d=>d.ontoggle=()=>{const key=id+":"+d.dataset.shipCategory;if(d.open)shipExpandedGroups.add(key);else shipExpandedGroups.delete(key);});
  main.querySelectorAll("[data-ship-detail]").forEach(d=>d.ontoggle=()=>{const key=id+":"+d.dataset.shipDetail;if(d.open)shipExpandedParts.add(key);else shipExpandedParts.delete(key);});
  main.querySelectorAll("[data-ship-unit]").forEach(box=>box.onchange=()=>{
   const item=shipItems(id).find(p=>p.id===box.dataset.shipUnit);if(!item)return;
   const flags=shipFlags(id,item);flags[Number(box.dataset.index)]=box.checked;
   shipTracker[id].owned[item.id]=flags;labSave();
   shipExpandedGroups.add(id+":"+item.cat);shipExpandedParts.add(id+":"+item.id);renderShipInfo();
  });
  main.querySelectorAll("[data-ship-part-note]").forEach(box=>box.oninput=()=>{shipTracker[id].notes[box.dataset.shipPartNote]=box.value.slice(0,3000);labSave();});
  main.querySelectorAll("[data-ship-remove]").forEach(btn=>btn.onclick=()=>{
   if(!window.confirm("Remove this custom part?"))return;
   const key=btn.dataset.shipRemove;
   shipTracker[id].custom=shipTracker[id].custom.filter(p=>p.id!==key);
   delete shipTracker[id].owned[key];delete shipTracker[id].notes[key];labSave();renderShipInfo();
  });
  const loadoutNote=el("ship-loadout-notes");
  if(loadoutNote)loadoutNote.oninput=e=>{
   shipTracker[id].loadoutNotes??={};
   shipTracker[id].loadoutNotes[shipTracker[id].loadout]=e.target.value.slice(0,5000);labSave();
  };
  el("ship-global-notes").oninput=e=>{shipTracker[id].shipNotes=e.target.value.slice(0,8000);labSave();};
  el("ship-add-part").onclick=shipAddPart;
 }
}
