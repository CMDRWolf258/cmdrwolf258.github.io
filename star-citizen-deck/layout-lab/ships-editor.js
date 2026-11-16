/* Personal build additions. Never sends to the game. */
'use strict';
function shipAddPart(){
 const cats=shipCategories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join("");
 const loadoutChoices='<option value="shared">ALL LOADOUTS (SHARED)</option>'+shipLoadouts[shipSelected].map(item=>
  '<option value="'+item.id+'" '+(item.id===shipTracker[shipSelected].loadout?'selected':'')+'>'+esc(item.name)+'</option>').join("");

 el("modal-root").innerHTML='<div class="modal-wrap"><div class="modal ship-add-modal" role="dialog" aria-modal="true"><div class="eyebrow">MY SHIP BUILD</div><h2>Add a part</h2>'
  +'<form id="ship-add-form"><label class="field">PART NAME<input id="ship-new-name" class="input" required maxlength="90" placeholder="Component name"></label>'
  +'<label class="field">APPLIES TO<select id="ship-new-loadout" class="input">'+loadoutChoices+'</select></label>'
  +'<div class="modal-grid"><label class="field">CATEGORY<select id="ship-new-cat" class="input">'+cats+'</select></label>'
  +'<label class="field">QUANTITY<input id="ship-new-qty" class="input" type="number" min="1" max="24" value="1"></label></div>'
  +'<div class="modal-grid"><label class="field">PRICE EACH (aUEC)<input id="ship-new-price" class="input" type="number" min="0" placeholder="Optional"></label>'
  +'<label class="field">SIZE / GRADE<input id="ship-new-size" class="input" maxlength="70" placeholder="S2 · Grade A"></label></div>'
  +'<label class="field">PURCHASE LOCATION<input id="ship-new-shop" class="input" maxlength="180" placeholder="Store / station"></label>'
  +'<label class="field">PROS<textarea id="ship-new-pro" class="input" rows="2" maxlength="500"></textarea></label>'
  +'<label class="field">CONS / TRADEOFFS<textarea id="ship-new-con" class="input" rows="2" maxlength="500"></textarea></label>'
  +'<label class="field">COMPONENT PHOTO URL (OPTIONAL)<input id="ship-new-image" class="input" type="url" placeholder="https://..."></label>'
  +'<label class="field">SOURCE / REFERENCE URL (OPTIONAL)<input id="ship-new-source" class="input" type="url" placeholder="https://..."></label>'
  +'<div class="settings-row"><button class="primary-btn" type="submit">SAVE PART</button>'
  +'<button id="ship-add-cancel" class="secondary-btn" type="button">CANCEL</button></div></form></div></div>';
 el("ship-add-cancel").onclick=()=>el("modal-root").innerHTML="";
 el("ship-add-form").onsubmit=e=>{
  e.preventDefault();
  const get=id=>el(id).value.trim();
  const name=get("ship-new-name"),image=get("ship-new-image"),source=get("ship-new-source");
  if(!name)return;
  if((image&&!shipURL(image))||(source&&!shipURL(source))){notify("Photo and reference links must use HTTPS.",true);return;}
  const id="c-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
  shipTracker[shipSelected].custom.push({
   id,name:shipText(name,90),cat:get("ship-new-cat"),loadout:get("ship-new-loadout"),size:shipText(get("ship-new-size"),70),
   qty:Math.max(1,Math.min(24,Number(get("ship-new-qty"))||1)),
   price:Math.max(0,Math.min(50000000,Math.round(Number(get("ship-new-price"))||0))),
   shop:shipText(get("ship-new-shop"),180),alt:"",image,source,
   pro:shipText(get("ship-new-pro")),con:shipText(get("ship-new-con")),verify:"My added part"
  });
  shipExpandedGroups.add(shipSelected+":"+get("ship-new-cat"));
  shipExpandedParts.add(shipSelected+":"+id);
  labSave();el("modal-root").innerHTML="";renderShipInfo();notify("Part added to build.");
 };
}
