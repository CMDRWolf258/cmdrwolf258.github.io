import { ensureMiningNavigationSchema, mapCenter, saveMiningCenterContext, TEN16_SYSTEM } from '../../../lib/mining-navigation.js';
import { withMiningDatabase } from '../../../lib/mining-diagnostics.js';

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
  if(auth.access!=='site_admin')return Response.json({ok:false,error:'site_admin_required'},{status:403,headers:{'Cache-Control':'no-store'}});

  let body;
  try{body=await request.json();}catch{return bad('invalid_json');}
  if(!sameSystem(body?.system,body?.systemAddress))return bad('unsupported_system');

  const bodyName=normalizeBody(body?.body);
  const bodyType=cleanText(body?.bodyType,20).toLowerCase()||inferBodyType(bodyName);
  const signal=numberOrNull(body?.signal);
  const latitude=numberOrNull(body?.latitude);
  const longitude=numberOrNull(body?.longitude);
  if(!bodyName)return bad('body_required');
  if(!['planet','moon'].includes(bodyType))return bad('invalid_body_type');
  if(!Number.isInteger(signal)||signal<1||signal>999)return bad('invalid_signal');
  if(latitude===null||latitude<-90||latitude>90)return bad('invalid_latitude');
  if(longitude===null||longitude<-180||longitude>180)return bad('invalid_longitude');

  return withMiningDatabase(env, 'save-center', async phase => {
    phase('schema.navigation');
    await ensureMiningNavigationSchema(env);
    phase('write.center');
    await env.DB.prepare(`
      INSERT INTO mining_location_centers (
        body,body_type,signal,latitude,longitude,source,updated_by,created_at,updated_at
      ) VALUES (?,?,?,?,?,'hud-center',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(body,signal) DO UPDATE SET
        body_type=excluded.body_type,
        latitude=excluded.latitude,
        longitude=excluded.longitude,
        source='hud-center',
        updated_by=excluded.updated_by,
        updated_at=CURRENT_TIMESTAMP
    `).bind(
      bodyName,bodyType,signal,latitude,longitude,
      cleanText(auth.commander||'Mongrel HUD',100),
    ).run();

    phase('query.saved-center');
    let row=await env.DB.prepare(`
      SELECT id,body,body_type,signal,latitude,longitude,source,updated_at
      FROM mining_location_centers
      WHERE lower(body)=lower(?) AND signal=?
    `).bind(bodyName,signal).first();
    if(row?.id){
      phase('write.center-context');
      await saveMiningCenterContext(
        env,
        row.id,
        TEN16_SYSTEM,
        TEN16_ID64,
      );
      phase('query.saved-center-context');
      row=await env.DB.prepare(`
        SELECT c.id,c.body,c.body_type,c.signal,c.latitude,c.longitude,c.source,c.updated_at,
               x.system_name,x.system_address
        FROM mining_location_centers c
        LEFT JOIN mining_center_context x ON x.center_id=c.id
        WHERE c.id=?
      `).bind(row.id).first();
    }

    return Response.json({
      ok:true,
      status:'saved',
      center:mapCenter(row),
      message:'Mining location center saved.',
    },{status:201,headers:{'Cache-Control':'no-store'}});
  });
}

function bad(error){return Response.json({ok:false,error},{status:400,headers:{'Cache-Control':'no-store'}});}
