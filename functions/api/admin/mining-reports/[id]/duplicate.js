import { canReviewMining, json, readSession } from '../../../../../lib/auth.js';
import { ensureMiningNavigationSchema } from '../../../../../lib/mining-navigation.js';

function cleanText(value,maxLength=1000){
  if(value===null||value===undefined)return'';
  return String(value).trim().slice(0,maxLength);
}

async function requireAdmin(request,env){
  const session=await readSession(request,env);
  if(!session)return{error:json({ok:false,message:'Sign in with Discord to review mining reports.'},{status:401})};
  if(!canReviewMining(session))return{error:json({ok:false,message:'Site Admin access is required.'},{status:403})};
  return{session};
}

export async function onRequestPost({request,env,params}){
  const auth=await requireAdmin(request,env);
  if(auth.error)return auth.error;
  await ensureMiningNavigationSchema(env);

  const reportId=Number(params.id);
  if(!Number.isInteger(reportId)||reportId<=0)return json({ok:false,message:'Invalid report ID.'},{status:400});

  let body={};
  try{body=await request.json();}catch{}
  const choice=cleanText(body.choice,20).toLowerCase();
  const reviewNotes=cleanText(body.reviewNotes,1000);
  if(!['existing','new'].includes(choice))return json({ok:false,message:'Choose which entry to keep.'},{status:400});

  const report=await env.DB.prepare(`
    SELECT r.*,d.existing_site_id,d.distance_m
    FROM mining_reports r
    LEFT JOIN mining_duplicate_reviews d ON d.report_id=r.id
    WHERE r.id=?
  `).bind(reportId).first();

  if(!report)return json({ok:false,message:'Duplicate review not found.'},{status:404});
  if(report.report_type!=='duplicate')return json({ok:false,message:'This is not a duplicate review.'},{status:400});
  if(report.status!=='pending')return json({ok:false,message:`Report is already ${report.status}.`},{status:409});
  if(!report.existing_site_id)return json({ok:false,message:'Existing mining entry is missing.'},{status:409});

  const existing=await env.DB.prepare('SELECT id FROM mining_sites WHERE id=?').bind(report.existing_site_id).first();
  if(!existing)return json({ok:false,message:'Existing mining entry was not found.'},{status:404});

  const claim=await env.DB.prepare(
    "UPDATE mining_reports SET status='processing' WHERE id=? AND status='pending'"
  ).bind(reportId).run();
  if(!claim.meta||claim.meta.changes!==1)return json({ok:false,message:'This duplicate is already being reviewed.'},{status:409});

  try{
    if(choice==='new'){
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE mining_sites
          SET commodity=?,body=?,body_type=?,signal=?,latitude=?,longitude=?,rigs=?,preferred=?,notes=?,
              source='duplicate-review',updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(
          report.commodity,report.body,report.body_type,report.signal,report.latitude,report.longitude,
          report.rigs,report.preferred,report.notes||'',report.existing_site_id,
        ),
        env.DB.prepare(`
          UPDATE mining_reports
          SET status='approved',reviewed_at=CURRENT_TIMESTAMP,review_notes=?
          WHERE id=? AND status='processing'
        `).bind(reviewNotes||'Kept new deposit and replaced the nearby existing entry.',reportId),
        env.DB.prepare(`
          UPDATE mining_duplicate_reviews
          SET resolved_at=CURRENT_TIMESTAMP,resolution='new'
          WHERE report_id=?
        `).bind(reportId),
      ]);
    }else{
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE mining_reports
          SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,review_notes=?
          WHERE id=? AND status='processing'
        `).bind(reviewNotes||'Kept existing deposit; discarded the nearby new report.',reportId),
        env.DB.prepare(`
          UPDATE mining_duplicate_reviews
          SET resolved_at=CURRENT_TIMESTAMP,resolution='existing'
          WHERE report_id=?
        `).bind(reportId),
      ]);
    }

    return json({
      ok:true,
      reportId,
      resolution:choice,
      keptSiteId:report.existing_site_id,
      distanceMeters:report.distance_m,
    });
  }catch(error){
    console.error('Duplicate mining review failed',error);
    await env.DB.prepare("UPDATE mining_reports SET status='pending' WHERE id=? AND status='processing'").bind(reportId).run();
    return json({ok:false,message:'Unable to resolve duplicate mining entries.'},{status:500});
  }
}
