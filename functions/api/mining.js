export async function onRequestGet({ env }) {
  const result = await env.DB
    .prepare(`
      SELECT
        id,
        commodity,
        body,
        body_type,
        signal,
        latitude,
        longitude,
        rigs,
        preferred,
        notes
      FROM mining_sites
      ORDER BY
        commodity COLLATE NOCASE,
        body COLLATE NOCASE,
        signal,
        preferred DESC,
        rigs DESC
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
  }));

  return Response.json(miningData, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
