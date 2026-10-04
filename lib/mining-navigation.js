export async function ensureMiningNavigationSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS mining_location_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL,
        body_type TEXT NOT NULL,
        signal INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        source TEXT NOT NULL DEFAULT 'hud-center',
        updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(body, signal)
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS mining_duplicate_reviews (
        report_id INTEGER PRIMARY KEY,
        existing_site_id INTEGER NOT NULL,
        distance_m REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        resolution TEXT
      )
    `),
  ]);
}

export function greatCircleDistanceMeters(lat1, lon1, lat2, lon2, radiusMeters) {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  for (const value of [lat1, lon1, lat2, lon2]) {
    if (!Number.isFinite(Number(value))) return null;
  }
  const toRad = value => Number(value) * Math.PI / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLat = p2 - p1;
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const central = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return radius * central;
}

export async function findClosestDepositDuplicate(env, {
  body,
  commodity,
  latitude,
  longitude,
  radiusMeters,
  thresholdMeters = 1000,
}) {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius <= 0) return null;

  // A cheap angular prefilter keeps the full great-circle calculation small.
  const angularDegrees = Math.max(0.01, Math.min(2, (thresholdMeters / radius) * (180 / Math.PI) * 1.25));
  const rows = await env.DB.prepare(`
    SELECT id, commodity, body, body_type, signal, latitude, longitude, rigs, preferred, notes
    FROM mining_sites
    WHERE lower(body) = lower(?)
      AND lower(commodity) = lower(?)
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ABS(latitude - ?) <= ?
      AND ABS(longitude - ?) <= ?
    ORDER BY id
  `).bind(body, commodity, latitude, angularDegrees, longitude, angularDegrees).all();

  let best = null;
  for (const row of rows.results || []) {
    const distanceMeters = greatCircleDistanceMeters(
      latitude,
      longitude,
      row.latitude,
      row.longitude,
      radius,
    );
    if (distanceMeters === null || distanceMeters > thresholdMeters) continue;
    if (!best || distanceMeters < best.distanceMeters) {
      best = { site: row, distanceMeters };
    }
  }
  return best;
}

export function mapCenter(row) {
  if (!row) return null;
  return {
    id: row.id,
    body: row.body,
    bodyType: row.body_type,
    signal: row.signal,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source || '',
    updatedAt: row.updated_at || null,
  };
}
