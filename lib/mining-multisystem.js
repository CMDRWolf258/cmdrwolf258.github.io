// Additive ID64-based storage. No existing 10-16 table is modified.
import { oncePerDatabase } from './mining-schema.js';
import { greatCircleDistanceMeters, TEN16_ID64 } from './mining-navigation.js';
export const ensureMultiMiningSchema=oncePerDatabase(async env=>{
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mining_multi_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_address TEXT NOT NULL, system_name TEXT NOT NULL,
      body_name TEXT NOT NULL COLLATE NOCASE, body_type TEXT NOT NULL,
      signal INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(system_address,body_name,signal))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS mining_multi_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_address TEXT NOT NULL, system_name TEXT NOT NULL,
      body_name TEXT NOT NULL COLLATE NOCASE, body_type TEXT NOT NULL,
      signal INTEGER NOT NULL, commodity TEXT NOT NULL COLLATE NOCASE,
      latitude REAL NOT NULL, longitude REAL NOT NULL, planet_radius REAL,
      rigs INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '',
      submitted_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('approved','pending','duplicate_review')),
      duplicate_site_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(system_address,body_name,signal,commodity,latitude,longitude))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_multi_sites_system_status ON mining_multi_sites(system_address,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_multi_sites_duplicate ON mining_multi_sites(system_address,body_name,signal,commodity,status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_multi_centers_system ON mining_multi_centers(system_address,body_name)'),
  ]);
});
function clean(value,max=180){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
function validId64(value){
  if(!/^[0-9]{1,20}$/.test(value))return false;
  try{return BigInt(value)>0n&&BigInt(value)<=18446744073709551615n;}
  catch{return false;}
}
export function normalizedMultiScope(body){
  const systemName=clean(body?.system,160),systemAddress=clean(body?.systemAddress,24);
  const bodyName=clean(body?.body,220);
  if(!systemName||!validId64(systemAddress)||systemAddress===TEN16_ID64
     ||!bodyName.toLowerCase().startsWith((systemName+' ').toLowerCase())
     ||bodyName.length<=systemName.length+1||!/\d(?:\s*[a-z])*$/i.test(bodyName))return null;
  const declared=clean(body?.bodyType,20).toLowerCase();
  if(declared&&!['planet','moon'].includes(declared))return null;
  return{systemName,systemAddress,bodyName,bodyType:declared||(/\d\s*[a-z]+$/i.test(bodyName)?'moon':'planet')};
}
export function numericPosition(body){
  const signal=Number(body?.signal),latitude=Number(body?.latitude),longitude=Number(body?.longitude);
  const radius=body?.planetRadius==null?null:Number(body.planetRadius);
  if(!Number.isInteger(signal)||signal<1||signal>999)return{error:'invalid_signal'};
  if(body?.latitude==null||!Number.isFinite(latitude)||Math.abs(latitude)>90)return{error:'invalid_latitude'};
  if(body?.longitude==null||!Number.isFinite(longitude)||Math.abs(longitude)>180)return{error:'invalid_longitude'};
  if(radius!==null&&(!Number.isFinite(radius)||radius<=0))return{error:'invalid_planet_radius'};
  return{signal,latitude,longitude,radius};
}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const badMulti=error=>json({ok:false,error},400);
const publicId=id=>2000000000+Number(id);
const mapCenter=row=>({id:publicId(row.id),systemName:row.system_name,systemAddress:row.system_address,
  body:row.body_name,bodyType:row.body_type,signal:row.signal,latitude:row.latitude,
  longitude:row.longitude,source:'multisystem',updatedAt:row.updated_at});
const mapSite=row=>({id:publicId(row.id),systemName:row.system_name,systemAddress:row.system_address,
  body:row.body_name,bodyType:row.body_type,signal:row.signal,commodity:row.commodity,
  latitude:row.latitude,longitude:row.longitude,rigs:row.rigs,preferred:false,
  notes:row.notes||'',source:'multisystem'});
export async function saveMultiCenter(body,auth,env){
  const scope=normalizedMultiScope(body);if(!scope)return badMulti('invalid_system_body_identity');
  const pos=numericPosition(body);if(pos.error)return badMulti(pos.error);
  if(auth.access!=='site_admin')return json({ok:false,error:'site_admin_required'},403);
  await ensureMultiMiningSchema(env);
  const {systemAddress,systemName,bodyName,bodyType}=scope;
  const {signal,latitude,longitude}=pos;
  await env.DB.prepare(`INSERT INTO mining_multi_centers
   (system_address,system_name,body_name,body_type,signal,latitude,longitude,updated_by)
   VALUES (?,?,?,?,?,?,?,?)
   ON CONFLICT(system_address,body_name,signal) DO UPDATE SET
   system_name=excluded.system_name,body_type=excluded.body_type,
   latitude=excluded.latitude,longitude=excluded.longitude,
   updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
   .bind(systemAddress,systemName,bodyName,bodyType,signal,latitude,longitude,clean(auth.commander,100)).run();
  const row=await env.DB.prepare(`SELECT * FROM mining_multi_centers WHERE system_address=?
    AND body_name=? COLLATE NOCASE AND signal=?`).bind(systemAddress,bodyName,signal).first();
  return json({ok:true,status:'saved',center:mapCenter(row),
    message:'Mining location center saved to shared multi-system database.'},201);
}
export async function saveMultiDeposit(body,auth,env){
  const scope=normalizedMultiScope(body);if(!scope)return badMulti('invalid_system_body_identity');
  const pos=numericPosition(body);if(pos.error)return badMulti(pos.error);
  const commodity=clean(body?.commodity,100),notes=clean(body?.notes,1000),rigs=Number(body?.rigs);
  if(!commodity)return badMulti('commodity_required');
  if(!Number.isInteger(rigs)||rigs<1||rigs>7)return badMulti('invalid_rig_count');
  await ensureMultiMiningSchema(env);
  const {systemAddress,systemName,bodyName,bodyType}=scope;
  const {signal,latitude,longitude,radius}=pos;
  const exactSql=`SELECT * FROM mining_multi_sites WHERE system_address=?
    AND body_name=? COLLATE NOCASE AND signal=? AND commodity=? COLLATE NOCASE
    AND latitude=? AND longitude=? LIMIT 1`;
  const params=[systemAddress,bodyName,signal,commodity,latitude,longitude];
  const existing=await env.DB.prepare(exactSql).bind(...params).first();
  if(existing)return json({ok:true,status:existing.status==='approved'?'existing':existing.status,
    site:existing.status==='approved'?mapSite(existing):null,
    reportId:existing.status==='approved'?null:existing.id,
    message:'Identical deposit already recorded; not counted twice.'});
  const peers=await env.DB.prepare(`SELECT id,latitude,longitude FROM mining_multi_sites
    WHERE system_address=? AND body_name=? COLLATE NOCASE AND signal=?
    AND commodity=? COLLATE NOCASE AND status='approved'`)
    .bind(systemAddress,bodyName,signal,commodity).all();
  let duplicate=null,nearest=Infinity;
  if(radius!==null)for(const peer of peers.results||[]){
    const dist=greatCircleDistanceMeters(latitude,longitude,peer.latitude,peer.longitude,radius);
    if(dist!==null&&dist<=1000&&dist<nearest){duplicate=peer;nearest=dist;}
  }
  const state=duplicate?'duplicate_review':auth.access==='site_admin'?'approved':'pending';
  await env.DB.prepare(`INSERT OR IGNORE INTO mining_multi_sites
    (system_address,system_name,body_name,body_type,signal,commodity,latitude,longitude,
     planet_radius,rigs,notes,submitted_by,status,duplicate_site_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(systemAddress,systemName,bodyName,bodyType,signal,commodity,latitude,longitude,
      radius,rigs,notes,clean(auth.commander,100),state,duplicate?.id||null).run();
  const row=await env.DB.prepare(exactSql).bind(...params).first();
  const status=row?.status||state;
  return json({ok:true,status,site:status==='approved'?mapSite(row):null,
    reportId:status==='approved'?null:row.id,
    duplicate:duplicate?{siteId:publicId(duplicate.id),distanceMeters:nearest}:null,
    message:status==='approved'?'Shared multi-system deposit saved.':
      status==='duplicate_review'?'Possible duplicate queued for review.':'Deposit queued for approval.'},
    status==='duplicate_review'?202:201);
}
export async function readMultiCenters(env,systemAddress){
  if(!validId64(String(systemAddress||''))||String(systemAddress)===TEN16_ID64)return [];
  await ensureMultiMiningSchema(env);
  const r=await env.DB.prepare(`SELECT * FROM mining_multi_centers WHERE system_address=?
    ORDER BY body_name COLLATE NOCASE,signal`).bind(String(systemAddress)).all();
  return(r.results||[]).map(mapCenter);
}
export async function readMultiDeposits(env,systemAddress){
  if(!validId64(String(systemAddress||''))||String(systemAddress)===TEN16_ID64)return [];
  await ensureMultiMiningSchema(env);
  const r=await env.DB.prepare(`SELECT * FROM mining_multi_sites WHERE system_address=?
    AND status='approved' ORDER BY body_name COLLATE NOCASE,signal,commodity COLLATE NOCASE`)
    .bind(String(systemAddress)).all();
  return(r.results||[]).map(mapSite);
}
