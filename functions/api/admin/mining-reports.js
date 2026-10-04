import {
  canReviewMining,
  json,
  readSession,
} from '../../../lib/auth.js';
import { ensureMaterialSchema } from '../../../lib/mining-material.js';
import { ensureMiningNavigationSchema } from '../../../lib/mining-navigation.js';

function mapReport(row) {
  return {
    id: row.id,
    reportType: row.report_type,
    targetSiteId: row.target_site_id,
    commodity: row.commodity,
    body: row.body,
    bodyType: row.body_type,
    signal: row.signal,
    latitude: row.latitude,
    longitude: row.longitude,
    rigs: row.rigs,
    preferred: Boolean(row.preferred),
    notes: row.notes || '',
    materialAmount: row.material_amount || null,
    submittedBy: row.submitted_by || '',
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes || '',
    duplicateDistanceMeters: row.duplicate_distance_m ?? null,
    duplicateExisting: row.duplicate_existing_id ? {
      id: row.duplicate_existing_id,
      commodity: row.duplicate_existing_commodity,
      body: row.duplicate_existing_body,
      bodyType: row.duplicate_existing_body_type,
      signal: row.duplicate_existing_signal,
      latitude: row.duplicate_existing_latitude,
      longitude: row.duplicate_existing_longitude,
      rigs: row.duplicate_existing_rigs,
      preferred: Boolean(row.duplicate_existing_preferred),
      notes: row.duplicate_existing_notes || '',
    } : null,
  };
}

async function requireAdmin(request, env) {
  const session = await readSession(request, env);

  if (!session) {
    return {
      error: json(
        { ok: false, message: 'Sign in with Discord to review mining reports.' },
        { status: 401 },
      ),
    };
  }

  if (!canReviewMining(session)) {
    return {
      error: json(
        { ok: false, message: 'Site Admin access is required.' },
        { status: 403 },
      ),
    };
  }

  return { session };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  await ensureMaterialSchema(env);
  await ensureMiningNavigationSchema(env);

  const url = new URL(request.url);
  const requestedStatus = (url.searchParams.get('status') || 'pending').toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'all']);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'pending';

  let result;

  if (status === 'all') {
    result = await env.DB.prepare(
      `SELECT r.*,
              d.distance_m AS duplicate_distance_m,
              s.id AS duplicate_existing_id,
              s.commodity AS duplicate_existing_commodity,
              s.body AS duplicate_existing_body,
              s.body_type AS duplicate_existing_body_type,
              s.signal AS duplicate_existing_signal,
              s.latitude AS duplicate_existing_latitude,
              s.longitude AS duplicate_existing_longitude,
              s.rigs AS duplicate_existing_rigs,
              s.preferred AS duplicate_existing_preferred,
              s.notes AS duplicate_existing_notes
       FROM mining_reports r
       LEFT JOIN mining_duplicate_reviews d ON d.report_id = r.id
       LEFT JOIN mining_sites s ON s.id = d.existing_site_id
       ORDER BY r.submitted_at DESC, r.id DESC`,
    ).all();
  } else {
    result = await env.DB.prepare(
      `SELECT r.*,
              d.distance_m AS duplicate_distance_m,
              s.id AS duplicate_existing_id,
              s.commodity AS duplicate_existing_commodity,
              s.body AS duplicate_existing_body,
              s.body_type AS duplicate_existing_body_type,
              s.signal AS duplicate_existing_signal,
              s.latitude AS duplicate_existing_latitude,
              s.longitude AS duplicate_existing_longitude,
              s.rigs AS duplicate_existing_rigs,
              s.preferred AS duplicate_existing_preferred,
              s.notes AS duplicate_existing_notes
       FROM mining_reports r
       LEFT JOIN mining_duplicate_reviews d ON d.report_id = r.id
       LEFT JOIN mining_sites s ON s.id = d.existing_site_id
       WHERE r.status = ?
       ORDER BY r.submitted_at DESC, r.id DESC`,
    ).bind(status).all();
  }

  const reports = (result.results || []).map(mapReport);

  return json({
    ok: true,
    count: reports.length,
    reports,
  });
}
