import { ensureMiningNavigationSchema, mapCenter } from '../../lib/mining-navigation.js';

export async function onRequestGet({ env }) {
  await ensureMiningNavigationSchema(env);
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
}
