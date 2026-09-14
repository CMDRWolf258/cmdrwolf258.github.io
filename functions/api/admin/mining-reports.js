import {
  canReviewMining,
  json,
  readSession,
} from '../../../lib/auth.js';

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
    submittedBy: row.submitted_by || '',
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes || '',
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

  const url = new URL(request.url);
  const requestedStatus = (url.searchParams.get('status') || 'pending').toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'all']);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : 'pending';

  let result;

  if (status === 'all') {
    result = await env.DB.prepare(
      `SELECT *
       FROM mining_reports
       ORDER BY submitted_at DESC, id DESC`,
    ).all();
  } else {
    result = await env.DB.prepare(
      `SELECT *
       FROM mining_reports
       WHERE status = ?
       ORDER BY submitted_at DESC, id DESC`,
    ).bind(status).all();
  }

  const reports = (result.results || []).map(mapReport);

  return json({
    ok: true,
    count: reports.length,
    reports,
  });
}
