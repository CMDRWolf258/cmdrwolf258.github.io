/* Andromeda selectable, individually trackable weapon configurations (4.10.3).
 * Common ship upgrades are shared across every configuration. Alternate guns stay
 * in inventory even when the pilot switches the displayed configuration.
 */
const shipLoadouts={
 ion:[{id:"standard",name:"Heavy Fighter",tag:"SF7E + missile systems",summary:"Standard Ares Ion heavy fighter configuration.",pilot:"Fixed 1 × SF7E S7 laser cannon",turrets:"None",practical:"Built for large targets; its unique gun is not interchangeable.",pro:"High single-weapon impact, no ballistic restocks.",con:"Limited options against agile opponents."}],
 andromeda:[
  {id:"balanced",name:"Balanced PvE",tag:"Stock repeaters · everyday",summary:"Retain the stock pilot guns and turrets; a dependable starting point for PvE contracts and occasional defensive PvP.",
   pilot:"4 × CF-557 Galdereen S5 laser repeaters (already fitted)",
   turrets:"4 × CF-337 Panther S3 laser repeaters (already fitted)",
   practical:"No gun purchases needed. Maintain the original four S5 pilot mounts and both S3 manned turrets.",
   pro:"Good sustained laser fire and projectile velocity. No ballistic ammunition cost. Zero gun-upgrade cost.",
   con:"Not the strongest single-volley impact and no dedicated disabling damage."},
  {id:"disable",name:"Disabling / Capture",tag:"2 distortion cannons · crew",summary:"Keep the four stock S5 pilot guns. Swap both guns on one manned turret for S3 Suckerpunch-XL distortion cannons.",
   pilot:"4 × CF-557 Galdereen S5 laser repeaters (stock)",
   turrets:"Upper manned turret: 2 × Suckerpunch-XL S3 distortion cannons; lower turret: 2 × CF-337 Panthers (stock)",
   practical:"Requires a turret gunner to aim and fire the distortion cannons. Suckerpunch-XL effective range is about 1.8 km; it drains systems rather than hull. Disabling effectiveness depends on target and current tuning.",
   pro:"Adds non-lethal subsystem-disruption capability while preserving all four pilot laser repeaters.",
   con:"Not usable as a dedicated distortion setup when flying solo. More coordination and short-range accuracy required."},
  {id:"ballistic",name:"Ballistic Brawler",tag:"4 × AD5B · pressure",summary:"Swap the four S5 pilot guns for AD5B ballistic gatlings for hard-hitting, sustained physical damage.",
   pilot:"4 × AD5B Size 5 ballistic gatlings",
   turrets:"4 × CF-337 Panther S3 laser repeaters (stock)",
   practical:"One AD5B per pilot S5 mount. Shop-reported Orison price: 121,735 aUEC each. Inventory counts persist when you change loadouts.",
   pro:"Excellent direct damage and low weapons power draw; rewarding for close-to-midrange PvE combat.",
   con:"Requires ammunition and restocking; gun choice makes long uninterrupted sessions less convenient."},
  {id:"precision",name:"Heavy-Target Precision",tag:"4 × M7A · alpha",summary:"Use four Size 5 Behring M7A laser cannons for deliberate, higher-impact volleys against larger PvE targets.",
   pilot:"4 × Behring M7A S5 energy cannons",
   turrets:"4 × CF-337 Panther S3 laser repeaters (stock)",
   practical:"Four matching cannons avoid mixed projectile leads; plan for lower projectile velocity than the stock repeaters.",
   pro:"Powerful single-shot damage, no ballistic ammunition expense, and strong focused-fire potential.",
   con:"Slower follow-up shots and less forgiving aim against fast fighters; higher acquisition cost."}
 ]
};
const validShipLoadout=(ship,id)=>shipLoadouts[ship]?.some(x=>x.id===id);
shipLibrary.ion.image="https://media.starcitizen.tools/7/79/Ares_ION_Firing_Concept.jpg";
shipLibrary.andromeda.image="https://media.starcitizen.tools/thumb/d/d7/Andromeda_flying_from_Station_-_Front_Starboard.jpg/1200px-Andromeda_flying_from_Station_-_Front_Starboard.jpg";
shipLibrary.andromeda.specs.push(["MISSILES","52 stock · 24 × S2 + 28 × S1"]);
shipLibrary.andromeda.stock+=" Stock missile capacity is 52 (24 Size 2 and 28 Size 1).";
shipLibrary.ion.stock+=" Stock missile capacity is 20 Size 3 across three racks (12 internal, 8 on replaceable racks).";
shipSeed.andromeda.push(
 {id:"a-suckerxl",cat:"Weapons",loadout:"disable",name:"Suckerpunch-XL Cannon",size:"S3 · Distortion cannon · manned turret",qty:2,price:94920,
  shop:"Cousin Crow's — Orison",alt:"New Babbage, MIC-L2 and Grim HEX also reported",image:"https://cdn.star-citizen.wiki/images/8/8e/Suckerpunch-XL_Cannon.jpg",
  source:"https://starcitizen.tools/Suckerpunch-XL_Cannon",
  pro:"Drains target ship systems without relying on hull damage; useful to help disable a vessel.",
  con:"Requires a manned turret gunner. About 1,801 m listed range, slower 1,066 m/s projectiles; cannot deliver this distortion damage from the solo pilot seat in this configuration.",
  verify:"4.10.3 game data; shop price/location reported via EverArk/Citadel"},
 {id:"a-ad5b",cat:"Weapons",loadout:"ballistic",name:"AD5B Ballistic Gatling",size:"S5 · Pilot gun",qty:4,price:121735,
  shop:"Ship Weapons — Crusader Showroom, Orison",alt:"CenterMass — Area18 (reported)",source:"https://everark-sc.com/en/components/BEHR_BallisticGatling_S5",
  pro:"Strong ballistic output, low power draw and large per-gun ammunition supply (reported 5,004).",
  con:"Needs rearming, and kinetic performance against armor may differ from laser setup.",
  verify:"4.10.3 game data; Orison market report"},
 {id:"a-m7a",cat:"Weapons",loadout:"precision",name:"Behring M7A Cannon",size:"S5 · Pilot energy cannon",qty:4,price:380430,
  shop:"Ship Weapons — Crusader Showroom, Orison",alt:"Other sellers may be cheaper; verify terminal",source:"https://starcitizen.tools/M7A_Cannon",
  pro:"High alpha per hit (reported ~922); focused energy fire, no physical ammunition.",
  con:"~1,112 m/s projectiles are slower than stock repeaters (~1,390 m/s); requires better lead and tracking.",
  verify:"4.10.3 game stats; Orison market report"}
);
