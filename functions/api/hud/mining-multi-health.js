// On-demand, read-only deployment diagnostic. No CREATE TABLE, migrations or
// multi-system writes; intended for the owner's paired HUD controls.
const AUTH_URL='https://mongrels-squadron.pages.dev/api/hud/auth';
const reply=(body,status=200)=>Response.json(body,{status,headers:{
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
}});
export async function onRequestGet({request,env}){
  const token=request.headers.get('Authorization')||'';
  if(!/^Bearer\\s+[^\\s]+$/i.test(token))return reply({ok:false,error:'scout_auth_required'},401);
  let auth;
  try{
    const result=await fetch(AUTH_URL,{method:'GET',
      headers:{Authorization:token,Accept:'application/json'},cache:'no-store'});
    if(!result.ok)return reply({ok:false,error:'invalid_scout_token'},401);
    auth=await result.json();
  }catch{return reply({ok:false,error:'scout_auth_unavailable'},503);}
  if(auth?.ok!==true || auth?.access!=='site_admin')return reply({ok:false,error:'site_admin_required'},403);
  if(!env?.DB?.prepare)return reply({ok:false,error:'archive_db_not_bound'},503);
  try{
    const result=await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('mining_sites','mining_location_centers','mining_multi_sites','mining_multi_centers')"
    ).all();
    const found=new Set((result.results||[]).map(row=>row.name));
    const legacyReady=found.has('mining_sites')&&found.has('mining_location_centers');
    const multiReady=found.has('mining_multi_sites')&&found.has('mining_multi_centers');
    return reply({
      ok:true,dbBound:true,legacyReady,multiSchemaReady:multiReady,
      sharedOffSystemReady:legacyReady&&multiReady,
      backupVerified:null, // Cannot attest to an external Cloudflare D1 backup.
      checkedAt:new Date().toISOString(),
    });
  }catch(error){
    console.error('Read-only mining archive health query failed',error);
    return reply({ok:false,error:'archive_db_query_failed'},503);
  }
}
