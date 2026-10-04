export const TEN16_SYSTEM='NGC 2546 Sector UZ-G d10-16';

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
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS mining_site_context (
        site_id INTEGER PRIMARY KEY,
        system_name TEXT NOT NULL,
        system_address TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS mining_center_context (
        center_id INTEGER PRIMARY KEY,
        system_name TEXT NOT NULL,
        system_address TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
  ]);

  // This archive historically contained only 10-16 mining data. Backfill the
  // explicit system name so old rows remain usable once navigation becomes
  // system-aware.
  await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO mining_site_context (site_id,system_name,system_address)
      SELECT id, ?, NULL FROM mining_sites
    `).bind(TEN16_SYSTEM),
    env.DB.prepare(`
      INSERT OR IGNORE INTO mining_center_context (center_id,system_name,system_address)
      SELECT id, ?, NULL FROM mining_location_centers
    `).bind(TEN16_SYSTEM),
  ]);
}

export async function saveMiningSiteContext(env,siteId,systemName,systemAddress=null){
  if(!siteId)return;
  await env.DB.prepare(`
    INSERT INTO mining_site_context (site_id,system_name,system_address,updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(site_id) DO UPDATE SET
      system_name=excluded.system_name,
      system_address=COALESCE(excluded.system_address,mining_site_context.system_address),
      updated_at=CURRENT_TIMESTAMP
  `).bind(siteId,String(systemName||'').trim(),systemAddress?String(systemAddress):null).run();
}

export async function saveMiningCenterContext(env,centerId,systemName,systemAddress=null){
  if(!centerId)return;
  await env.DB.prepare(`
    INSERT INTO mining_center_context (center_id,system_name,system_address,updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(center_id) DO UPDATE SET
      system_name=excluded.system_name,
      system_address=COALESCE(excluded.system_address,mining_center_context.system_address),
      updated_at=CURRENT_TIMESTAMP
  `).bind(centerId,String(systemName||'').trim(),systemAddress?String(systemAddress):null).run();
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
  systemName,
  body,
  commodity,
  signal,
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
    SELECT s.id, s.commodity, s.body, s.body_type, s.signal, s.latitude, s.longitude, s.rigs, s.preferred, s.notes,
           c.system_name, c.system_address
    FROM mining_sites s
    LEFT JOIN mining_site_context c ON c.site_id = s.id
    WHERE lower(COALESCE(c.system_name, ?)) = lower(?)
      AND lower(s.body) = lower(?)
      AND lower(s.commodity) = lower(?)
      AND s.signal = ?
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
      AND ABS(s.latitude - ?) <= ?
      AND ABS(s.longitude - ?) <= ?
    ORDER BY s.id
  `).bind(TEN16_SYSTEM, systemName || TEN16_SYSTEM, body, commodity, signal, latitude, angularDegrees, longitude, angularDegrees).all();

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
    systemName: row.system_name || TEN16_SYSTEM,
    systemAddress: row.system_address || null,
    body: row.body,
    bodyType: row.body_type,
    signal: row.signal,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source || '',
    updatedAt: row.updated_at || null,
  };
}
