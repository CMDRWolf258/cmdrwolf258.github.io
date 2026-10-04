import { ensureMaterialSchema } from '../../lib/mining-material.js';
import { miningRowsToPoiProvider } from '../../lib/curated-poi.js';
import { ensureMiningNavigationSchema, TEN16_ID64, TEN16_SYSTEM } from '../../lib/mining-navigation.js';
import { withMiningDatabase } from '../../lib/mining-diagnostics.js';

export async function onRequestGet({ request, env }) {
  const poiFormat = request && new URL(request.url).searchParams.get('format') === 'poi';
  return withMiningDatabase(env, 'read-deposits', async phase => {
    phase('schema.material');
    await ensureMaterialSchema(env);
    phase('schema.navigation');
    await ensureMiningNavigationSchema(env);

    phase('query.deposits');
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
          c.system_name,
          c.system_address,
          ${poiFormat ? 's.source, s.updated_at,' : ''}
          m.amount AS material_amount,
          m.updated_at AS material_updated_at,
          m.updated_by AS material_updated_by
        FROM mining_sites s
        LEFT JOIN mining_material_status m
          ON m.site_id = s.id
        LEFT JOIN mining_site_context c
          ON c.site_id = s.id
        WHERE NOT (
          s.latitude IS NULL
          AND s.longitude IS NULL
          AND EXISTS (
            SELECT 1
            FROM mining_sites resolved
            LEFT JOIN mining_site_context rc ON rc.site_id = resolved.id
            WHERE resolved.id <> s.id
              AND lower(resolved.commodity)=lower(s.commodity)
              AND lower(resolved.body)=lower(s.body)
              AND resolved.signal=s.signal
              AND resolved.latitude IS NOT NULL
              AND resolved.longitude IS NOT NULL
              AND lower(COALESCE(rc.system_name, ?))=lower(COALESCE(c.system_name, ?))
          )
        )
        ORDER BY
          s.commodity COLLATE NOCASE,
          s.body COLLATE NOCASE,
          s.signal,
          s.preferred DESC,
          s.rigs DESC
      `)
      .bind(TEN16_SYSTEM, TEN16_SYSTEM)
      .all();

    if (poiFormat) {
      return Response.json(miningRowsToPoiProvider(result.results || []), {
        headers: {
          'Cache-Control': 'no-store',
          // Curated locations are public; authenticated writer routes stay unchanged.
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const miningData = (result.results || []).map(site => ({
      id: site.id,
      systemName: site.system_name || TEN16_SYSTEM,
      systemAddress: site.system_address || TEN16_ID64,
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
  }, { publicCors: poiFormat });
}

