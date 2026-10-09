// Review-only API for non-10-16 reports. Existing 10-16 Mining Admin
// workflow and mining_reports table remain completely unchanged.
import { canReviewMining, json, readSession } from '../../../lib/auth.js';
import { ensureMultiMiningSchema } from '../../../lib/mining-multisystem.js';
import { withMiningDatabase } from '../../../lib/mining-diagnostics.js';

async function requireAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return {error:json({ok:false,error:'login_required'},{status:401})};
  if(!canReviewMining(session))return {error:json({ok:false,error:'site_admin_required'},{status:403})};
  return {session};
}
export async function onRequestGet({request,env}){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;
  return withMiningDatabase(env,'list-multi-reviews',async phase=>{
    phase('schema.multi-review');await ensureMultiMiningSchema(env);
    phase('query.multi-review');
    const rows=await env.DB.prepare("SELECT id,system_address,system_name,body_name,body_type,signal,commodity,latitude,longitude,rigs,notes,status,duplicate_site_id,submitted_by,created_at FROM mining_multi_sites WHERE status IN ('pending','duplicate_review') ORDER BY created_at DESC,id DESC LIMIT 200").all();
    return json({ok:true,reports:(rows.results||[]).map(row=>({
      id:row.id,systemAddress:row.system_address,systemName:row.system_name,
      body:row.body_name,bodyType:row.body_type,signal:row.signal,
      commodity:row.commodity,latitude:row.latitude,longitude:row.longitude,
      rigs:row.rigs,notes:row.notes||'',submittedBy:row.submitted_by||'',
      status:row.status,duplicateSiteId:row.duplicate_site_id?2000000000+row.duplicate_site_id:null,
      submittedAt:row.created_at,
    }))});
  });
}
export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;
  let body;try{body=await request.json();}catch{return json({ok:false,error:'invalid_json'},{status:400});}
  const id=Number(body?.reportId),action=String(body?.action||'');
  if(!Number.isSafeInteger(id)||id<1||!['approve','reject','keep-new','keep-existing'].includes(action)){
    return json({ok:false,error:'invalid_review_action'},{status:400});
  }
  return withMiningDatabase(env,'review-multi-report',async phase=>{
    phase('schema.multi-review');await ensureMultiMiningSchema(env);
    phase('query.multi-review');
    const report=await env.DB.prepare('SELECT id,status,duplicate_site_id FROM mining_multi_sites WHERE id=?').bind(id).first();
    if(!report)return json({ok:false,error:'report_not_found'},{status:404});
    if(!['pending','duplicate_review'].includes(report.status))return json({ok:false,error:'already_reviewed'},{status:409});
    if(report.status==='duplicate_review' && !['keep-new','keep-existing'].includes(action)){
      return json({ok:false,error:'duplicate_resolution_required'},{status:409});
    }
    if(report.status==='pending' && !['approve','reject'].includes(action)){
      return json({ok:false,error:'invalid_review_action'},{status:400});
    }
    if(action==='keep-new'){
      phase('query.multi-duplicate');
      const original=await env.DB.prepare('SELECT id,status FROM mining_multi_sites WHERE id=?')
        .bind(report.duplicate_site_id).first();
      if(!original||original.status!=='approved'){
        return json({ok:false,error:'original_deposit_not_approved'},{status:409});
      }
    }
    phase('write.multi-review');
    // D1 batch ensures replacement of a known close duplicate is atomic.
    if(action==='keep-new'){
      const outcome=await env.DB.batch([
        env.DB.prepare("UPDATE mining_multi_sites SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM mining_multi_sites WHERE id=? AND status='duplicate_review')").bind(report.duplicate_site_id,id),
        env.DB.prepare("UPDATE mining_multi_sites SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='duplicate_review' AND EXISTS(SELECT 1 FROM mining_multi_sites WHERE id=? AND status='rejected')").bind(id,report.duplicate_site_id),
      ]);
      if(outcome.some(row=>row.meta?.changes!==1)){
        return json({ok:false,error:'review_conflict_retry'},{status:409});
      }
    }else{
      const outcome=await env.DB.prepare('UPDATE mining_multi_sites SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?')
        .bind(action==='approve'?'approved':'rejected',id,report.status).run();
      if(outcome.meta?.changes!==1){
        return json({ok:false,error:'already_reviewed'},{status:409});
      }
    }
    return json({ok:true,id,action,status:action==='approve'||action==='keep-new'?'approved':'rejected'});
  });
}
