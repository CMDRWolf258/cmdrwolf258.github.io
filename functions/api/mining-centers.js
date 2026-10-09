import { readMultiCenters } from '../../lib/mining-multisystem.js';
import { ensureMiningNavigationSchema, mapCenter } from '../../lib/mining-navigation.js';
import { withMiningDatabase } from '../../lib/mining-diagnostics.js';

export async function onRequestGet({ request, env }) {
  const systemAddress=request?new URL(request.url).searchParams.get('systemAddress'):null;
  if(systemAddress && systemAddress!=='560820275507'){
    return withMiningDatabase(env,'read-multi-centers',async phase=>{
      phase('query.multi-centers');
      return Response.json(await readMultiCenters(env,systemAddress),
        {headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    },{publicCors:true});
  }
  return withMiningDatabase(env, 'read-centers', async phase => {
    phase('schema.navigation');
    await ensureMiningNavigationSchema(env);
    phase('query.centers');
    const result = await env.DB.prepare(`
      SELECT c.id, c.body, c.body_type, c.signal, c.latitude, c.longitude, c.source, c.updated_at,
             x.system_name, x.system_address
      FROM mining_location_centers c
      LEFT JOIN mining_center_context x ON x.center_id=c.id
      ORDER BY x.system_name COLLATE NOCASE, c.body COLLATE NOCASE, c.signal
    `).all();
    return Response.json((result.results || []).map(mapCenter), {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }, { publicCors: true });
}
