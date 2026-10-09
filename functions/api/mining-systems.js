// Lightweight directory for the HUD's local combobox. No commander identifiers,
// pending reports, coordinates or site details are sent to the directory.
import { ensureMultiMiningSchema } from '../../lib/mining-multisystem.js';
import { TEN16_SYSTEM,TEN16_ID64 } from '../../lib/mining-navigation.js';
import { withMiningDatabase } from '../../lib/mining-diagnostics.js';

export async function onRequestGet({env}){
  return withMiningDatabase(env,'read-mining-system-directory',async phase=>{
    phase('schema.multi-directory');
    await ensureMultiMiningSchema(env);
    phase('query.multi-directory');
    // The catalogue changes only when new approved reports or shared centers
    // appear. HUD caches the response and NEVER calls it per keystroke.
    const rows=await env.DB.prepare(`
      SELECT system_address,MAX(system_name) AS system_name FROM (
        SELECT system_address,system_name FROM mining_multi_sites WHERE status='approved'
        UNION ALL
        SELECT system_address,system_name FROM mining_multi_centers
      ) GROUP BY system_address ORDER BY system_name COLLATE NOCASE LIMIT 1000
    `).all();
    const systems=[{systemName:TEN16_SYSTEM,systemAddress:TEN16_ID64},
      ...(rows.results||[]).filter(r=>r.system_address!==TEN16_ID64)
        .map(r=>({systemName:r.system_name,systemAddress:r.system_address}))];
    return Response.json({ok:true,systems},{
      headers:{'Cache-Control':'private, max-age=3600','Access-Control-Allow-Origin':'*'},
    });
  },{publicCors:true});
}
