const TEN16_SYSTEM='NGC 2546 Sector UZ-G d10-16';
const TEN16_ID64='560820275507';
const SCOUT_AUTH_URL='https://mongrels-squadron.pages.dev/api/hud/auth';

function cleanText(value,max=1000){return String(value??'').trim().replace(/\s+/g,' ').slice(0,max);}
function numberOrNull(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function normalizeBody(value){
  const raw=cleanText(value,140); if(!raw)return''; let short=raw;
  const prefix=TEN16_SYSTEM.toLowerCase()+' ';
  if(short.toLowerCase().startsWith(prefix))short=short.slice(TEN16_SYSTEM.length).trim();
  const match=short.match(/(\d+)\s*([a-z]+)?$/i);
  return match?(match[1]+(match[2]||'').toLowerCase()):short;
}
function inferBodyType(body){return /^\d+$/.test(body)?'planet':/^\d+[a-z]+$/i.test(body)?'moon':'';}
function sameSystem(name,address){return cleanText(name,160).toLowerCase()===TEN16_SYSTEM.toLowerCase()||cleanText(address,40)===TEN16_ID64;}
async function validateScout(request){
  const authorization=request.headers.get('Authorization')||'';
  if(!/^Bearer\s+/i.test(authorization))return null;
  try{
    const response=await fetch(SCOUT_AUTH_URL,{method:'GET',headers:{Authorization:authorization,Accept:'application/json'},cache:'no-store'});
    if(!response.ok)return null;
    const result=await response.json();
    return result?.ok===true?result:null;
  }catch{return null;}
}

export async function onRequestPost({request,env}){
  const auth=await validateScout(request);
  if(!auth)return Response.json({ok:false,error:'invalid_scout_token'},{status:401,headers:{'Cache-Control':'no-store'}});
  let body; try{body=await request.json();}catch{return Response.json({ok:false,error:'invalid_json'},{status:400,headers:{'Cache-Control':'no-store'}});}
  if(!sameSystem(body?.system,body?.systemAddress))return Response.json({ok:false,error:'unsupported_system'},{status:400,headers:{'Cache-Control':'no-store'}});
  const commodity=cleanText(body?.commodity,100);
  const bodyName=normalizeBody(body?.body);
  const bodyType=cleanText(body?.bodyType,20).toLowerCase()||inferBodyType(bodyName);
  const signal=numberOrNull(body?.signal), latitude=numberOrNull(body?.latitude), longitude=numberOrNull(body?.longitude), rigs=numberOrNull(body?.rigs);
  const notes=cleanText(body?.notes,1000);
  if(!commodity)return bad('commodity_required');
  if(!bodyName)return bad('body_required');
  if(!['planet','moon'].includes(bodyType))return bad('invalid_body_type');
  if(!Number.isInteger(signal)||signal<1||signal>999)return bad('invalid_signal');
  if(latitude===null||latitude<-90||latitude>90)return bad('invalid_latitude');
  if(longitude===null||longitude<-180||longitude>180)return bad('invalid_longitude');
  if(rigs!==null&&(!Number.isInteger(rigs)||rigs<0||rigs>100))return bad('invalid_rig_count');
  const submittedBy=cleanText(auth.commander||'Mongrel HUD',100);

  if(auth.access!=='site_admin'){
    const sql="INSERT INTO mining_reports (report_type,target_site_id,commodity,body,body_type,signal,latitude,longitude,rigs,preferred,notes,submitted_by,status) VALUES ('add',NULL,?,?,?,?,?,?,?,0,?,?,'pending')";
    const result=await env.DB.prepare(sql).bind(commodity,bodyName,bodyType,signal,latitude,longitude,rigs,notes,submittedBy).run();
    return Response.json({ok:true,status:'pending',reportId:result.meta?.last_row_id??null,message:'Mining deposit submitted for review.'},{status:201,headers:{'Cache-Control':'no-store'}});
  }

  const duplicateSql="SELECT id,commodity,body,body_type,signal,latitude,longitude,rigs,preferred,notes FROM mining_sites WHERE lower(commodity)=lower(?) AND lower(body)=lower(?) AND signal=? AND latitude IS NOT NULL AND longitude IS NOT NULL AND ABS(latitude-?)<0.00008 AND ABS(longitude-?)<0.00008 ORDER BY id LIMIT 1";
  const duplicate=await env.DB.prepare(duplicateSql).bind(commodity,bodyName,signal,latitude,longitude).first();
  if(duplicate)return Response.json({ok:true,status:'existing',site:sitePayload(duplicate),message:'This deposit is already in the mining database.'},{headers:{'Cache-Control':'no-store'}});

  const placeholderSql="SELECT id FROM mining_sites WHERE lower(commodity)=lower(?) AND lower(body)=lower(?) AND signal=? AND latitude IS NULL AND longitude IS NULL ORDER BY id LIMIT 1";
  const placeholder=await env.DB.prepare(placeholderSql).bind(commodity,bodyName,signal).first();
  let siteId;
  if(placeholder?.id){
    const updateSql="UPDATE mining_sites SET body_type=?,latitude=?,longitude=?,rigs=?,notes=CASE WHEN ?<>'' THEN ? ELSE notes END,source='hud-report',updated_at=CURRENT_TIMESTAMP WHERE id=?";
    await env.DB.prepare(updateSql).bind(bodyType,latitude,longitude,rigs,notes,notes,placeholder.id).run();
    siteId=placeholder.id;
  }else{
    const insertSql="INSERT INTO mining_sites (commodity,body,body_type,signal,latitude,longitude,rigs,preferred,notes,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,'hud-report',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)";
    const result=await env.DB.prepare(insertSql).bind(commodity,bodyName,bodyType,signal,latitude,longitude,rigs,notes).run();
    siteId=result.meta?.last_row_id??null;
  }
  const site=siteId?await env.DB.prepare('SELECT id,commodity,body,body_type,signal,latitude,longitude,rigs,preferred,notes FROM mining_sites WHERE id=?').bind(siteId).first():null;
  return Response.json({ok:true,status:placeholder?.id?'updated':'added',site:sitePayload(site),message:'Mining deposit saved to the curated 10-16 database.'},{status:201,headers:{'Cache-Control':'no-store'}});
}

function bad(error){return Response.json({ok:false,error},{status:400,headers:{'Cache-Control':'no-store'}});}
function sitePayload(site){
  if(!site)return null;
  return{id:site.id,commodity:site.commodity,body:site.body,bodyType:site.body_type,signal:site.signal,latitude:site.latitude,longitude:site.longitude,rigs:site.rigs,preferred:Boolean(site.preferred),notes:site.notes||''};
}