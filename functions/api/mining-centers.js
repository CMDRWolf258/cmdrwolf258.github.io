import { ensureMiningNavigationSchema, mapCenter } from '../../lib/mining-navigation.js';

export async function onRequestGet({ env }) {
  await ensureMiningNavigationSchema(env);
  const result = await env.DB.prepare(`
    SELECT id, body, body_type, signal, latitude, longitude, source, updated_at
    FROM mining_location_centers
    ORDER BY body COLLATE NOCASE, signal
  `).all();
  return Response.json((result.results || []).map(mapCenter), {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
