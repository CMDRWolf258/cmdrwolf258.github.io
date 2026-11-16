/* Vessel reference and editable build seeds. Verified against Star Citizen 4.10.2-4.10.3
   ship files and reported market listings in November 2026. Prices are estimates. */
const shipLibrary={
 ion:{name:"Ares Star Fighter Ion",short:"Ares Ion",manufacturer:"Crusader Industries",
  role:"Heavy anti-capital fighter",focus:"PvE · occasional PvP",crew:"1",cargo:"Personal storage",
  image:"https://media.starcitizen.tools/9/99/Ares_Ion_in_space_-_Front.jpg",
  source:"https://starcitizen.tools/Ares_Star_Fighter_Ion",
  description:"Single-seat heavy fighter centered on its exclusive Size 7 SF7E laser cannon. This shop-focused plan emphasizes shield recovery, robust power, cooling and sensors.",
  specs:[["PILOT WEAPON","1 × S7 SF7E cannon"],["SHIELDS","2 × S2"],["POWER","2 × S2"],["COOLERS","3 × S2"],["QUANTUM","1 × S2"],["MISSILES","20 × S3 stock capacity"]],
  pros:["Heavy cannon delivers excellent punch against large targets","Signature energy weapon avoids ballistic ammunition costs","Compact one-pilot combat ship"],
  cons:["Not ideal for close dogfights against agile fighters","Bespoke primary weapon limits build flexibility","Requires deliberate positioning in PvP"],
  stock:"Keep the unique SF7E cannon. Retain the two MSD-543 racks and the integrated missile launcher until deciding on a missile strategy."},
 andromeda:{name:"Constellation Mk IV Andromeda",short:"Constellation Andromeda",manufacturer:"Roberts Space Industries",
  role:"Multi-crew gunship / cargo",focus:"PvE · crew combat",crew:"4",cargo:"96 SCU",
  image:"https://cdn.star-citizen.wiki/images/f/f6/RSI_Constellation_Andromeda_Frontansicht_links.jpg",
  source:"https://starcitizen.tools/Andromeda",
  description:"Versatile RSI gunship with four Size 5 pilot weapons, two manned turrets, missile racks, 96 SCU cargo and the P-52 Merlin. This starter plan emphasizes defenses while retaining the stock gun setup.",
  specs:[["PILOT GUNS","4 × S5 CF-557 Galdereen"],["TURRETS","2 × dual S3"],["SHIELD","1 × S3"],["POWER","2 × S2"],["COOLERS","2 × S2"],["CARGO","96 SCU"]],
  pros:["Four strong pilot-operated Size 5 repeaters","Two turrets and docked Merlin support multicrew play","Cargo hold broadens mission options"],
  cons:["Large silhouette and slower handling than fighters","Turrets require crew for best results","Power, cooling and shield choices interact"],
  stock:"Keep the four stock CF-557 pilot repeaters and stock turret guns initially. Baseline shield: 5CA Akura; power: DayBreak pair; coolers: Frost-Star EX pair; quantum: Bolon."}
};
const shipSeed={
 ion:[
 {id:"i-shield",cat:"Shields",name:"7MA 'Lorica'",size:"S2 · Civilian A",qty:2,price:120000,shop:"Cousin Crow's — Orison",alt:"Omega Pro — New Babbage",image:"https://media.starcitizen.tools/5/5b/7MA_Lorica_SG_in-game_cutout_-_Mesh_BG_SCT_logo.jpg",source:"https://starcitizen.tools/7MA_%27Lorica%27",pro:"Strong S2 civilian shield regeneration and reset timing.",con:"Does not maximize raw shield HP; value is in recovery.",verify:"Shop reports 4.10.2"},
 {id:"i-plant",cat:"Power plants",name:"Genoa",size:"S2 · Industrial A",qty:2,price:451440,shop:"Platinum Bay — Everus Harbor",alt:"Omega Pro — New Babbage (costs more)",image:"https://cdn.star-citizen.wiki/images/e/eb/Genoa.jpg",source:"https://starcitizen.tools/Genoa",pro:"Durable industrial-grade power plant for a systems-heavy loadout.",con:"Expensive and potentially more detectable than quiet alternatives.",verify:"Shop reports 4.10.2"},
 {id:"i-cool",cat:"Coolers",name:"Snowpack",size:"S2 · Industrial A",qty:3,price:172800,shop:"Omega Pro — New Babbage",alt:"Area18 Dumper's Depot (reported)",source:"https://starcitizen.tools/Snowpack",pro:"Strong cooling and durability.",con:"Higher IR/EM signature and draw than low-profile coolers.",verify:"Price 4.10.3; shop reports 2026"},
 {id:"i-qt",cat:"Quantum",name:"Hemera",size:"S2 · Civilian A",qty:1,price:168000,shop:"Cousin Crow's — Orison (earlier listing)",source:"https://starcitizen.tools/Hemera",pro:"High-tier civilian travel drive to compare with the Crossfield.",con:"Current 4.10.3 shop availability unconfirmed; fuel/range may trade off.",verify:"Earlier price / shop; verify"},
 {id:"i-radar",cat:"Radar",name:"V801-12",size:"S2 · Military A",qty:1,price:352000,shop:"Omega Pro — New Babbage",source:"https://starcitizen.tools/V801-12",pro:"Higher-tier radar option for sensor-focused engagements.",con:"Costly; practical sensor benefits vary with mechanics.",verify:"Shop reports 4.10.2"},
 {id:"i-rack",cat:"Missiles",name:"MSD-515 rack",size:"S5 missile rack",qty:1,price:48913,shop:"Crusader Showroom ship weapons — Orison",source:"https://starcitizen.tools/MSD-515_Missile_Rack",pro:"Fits one Size 5 missile on a compatible hardpoint.",con:"Fewer total missiles than the stock multi-missile rack; verify fitment.",verify:"Optional, 4.10.1 price"},
 {id:"i-stalker",cat:"Missiles",name:"Stalker V",size:"S5 missile",qty:1,price:2474,shop:"Orison ship weapons (earlier plan)",source:"https://starcitizen.tools/Stalker_V",pro:"Optional single heavy missile strike.",con:"Limited ammo and current listing not verified.",verify:"Earlier shopping-plan estimate"},
 {id:"i-thunder",cat:"Missiles",name:"Thunderbolt III",size:"S3 missile",qty:4,price:2712,shop:"Orison ship weapons (earlier plan)",source:"https://starcitizen.tools/Thunderbolt_III",pro:"Size 3 alternative for a compatible stock rack.",con:"Pricing and missile balancing may have changed.",verify:"Earlier shopping-plan estimate"}
 ],
 andromeda:[
 {id:"a-shield",cat:"Shields",name:"7CA 'Nargun'",size:"S3 · Civilian A",qty:1,price:240000,shop:"Cousin Crow's — Orison (earlier listing)",alt:"Omega Pro — New Babbage (earlier listing)",source:"https://starcitizen.tools/7CA_%27Nargun%27",pro:"Faster shield regeneration than stock Akura while remaining in the 100,000 HP class.",con:"Current 4.10.3 terminal stock unconfirmed.",verify:"Historical shop price; verify"},
 {id:"a-plant",cat:"Power plants",name:"Genoa",size:"S2 · Industrial A",qty:2,price:451440,shop:"Platinum Bay — Everus Harbor",alt:"Omega Pro — New Babbage",image:"https://cdn.star-citizen.wiki/images/e/eb/Genoa.jpg",source:"https://starcitizen.tools/Genoa",pro:"Durable replacement candidate for the DayBreak pair.",con:"Expensive; evaluate power and emissions versus actual demand.",verify:"Shop reports 4.10.2"},
 {id:"a-cool",cat:"Coolers",name:"Snowpack",size:"S2 · Industrial A",qty:2,price:172800,shop:"Omega Pro — New Babbage",alt:"Area18 Dumper's Depot (reported)",source:"https://starcitizen.tools/Snowpack",pro:"Greater cooling capability than Frost-Star EX.",con:"Higher signature and cooling power use.",verify:"Price 4.10.3"},
 {id:"a-qt",cat:"Quantum",name:"Hemera",size:"S2 · Civilian A",qty:1,price:168000,shop:"Cousin Crow's — Orison (earlier listing)",source:"https://starcitizen.tools/Hemera",pro:"Higher-tier alternative to compare against stock Bolon.",con:"Unconfirmed shop listing in latest patch; compare fuel, range and speed first.",verify:"Earlier price / shop; verify"}
 ]
};
const shipCategories=["Shields","Power plants","Coolers","Quantum","Radar","Weapons","Missiles","Other"];
