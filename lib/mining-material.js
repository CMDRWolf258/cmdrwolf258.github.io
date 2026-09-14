export const MATERIAL_AMOUNTS = new Set([
  'high',
  'medium',
  'low',
  'depleted',
]);

export function normalizeMaterialAmount(value) {
  const amount = String(value || '').trim().toLowerCase();
  return MATERIAL_AMOUNTS.has(amount) ? amount : null;
}

export function materialAmountLabel(value) {
  const amount = normalizeMaterialAmount(value);
  if (!amount) return 'Unknown';
  return amount.charAt(0).toUpperCase() + amount.slice(1);
}

export async function ensureMaterialSchema(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS mining_material_status (
      site_id INTEGER PRIMARY KEY,
      amount TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL DEFAULT ''
    )
  `).run();

  const columns = await env.DB
    .prepare(`PRAGMA table_info(mining_reports)`)
    .all();

  const hasMaterialAmount = (columns.results || [])
    .some(column => column.name === 'material_amount');

  if (!hasMaterialAmount) {
    try {
      await env.DB.prepare(
        `ALTER TABLE mining_reports ADD COLUMN material_amount TEXT`,
      ).run();
    } catch (error) {
      const message = String(error?.message || error).toLowerCase();
      if (!message.includes('duplicate column')) {
        throw error;
      }
    }
  }
}

export function materialStatusStatement(env, siteId, amount, updatedBy) {
  return env.DB.prepare(`
    INSERT INTO mining_material_status (
      site_id,
      amount,
      updated_at,
      updated_by
    )
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(site_id) DO UPDATE SET
      amount = excluded.amount,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `).bind(siteId, amount, updatedBy || '');
}
