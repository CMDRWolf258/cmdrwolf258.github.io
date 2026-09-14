import { ensureMaterialSchema } from '../../lib/mining-material.js';

export async function onRequestGet({ env }) {
  await ensureMaterialSchema(env);

  const result = await env.DB
    .prepare(`
      SELECT
        s.id,
        s.commodity,
        s.body,
        s.body_type,
        s.signal,
        s.latitude,
        s.longitude,
        s.rigs,
        s.preferred,
        s.notes,
        m.amount AS material_amount,
        m.updated_at AS material_updated_at,
        m.updated_by AS material_updated_by
      FROM mining_sites s
      LEFT JOIN mining_material_status m
        ON m.site_id = s.id
      ORDER BY
        s.commodity COLLATE NOCASE,
        s.body COLLATE NOCASE,
        s.signal,
        s.preferred DESC,
        s.rigs DESC
    `)
    .all();

  const miningData = (result.results || []).map(site => ({
    id: site.id,
    commodity: site.commodity,
    body: site.body,
    bodyType: site.body_type,
    signal: site.signal,
    latitude: site.latitude,
    longitude: site.longitude,
    rigs: site.rigs,
    preferred: Boolean(site.preferred),
    notes: site.notes || '',
    materialAmount: site.material_amount || null,
    materialUpdatedAt: site.material_updated_at || null,
    materialUpdatedBy: site.material_updated_by || '',
  }));

  return Response.json(miningData, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
