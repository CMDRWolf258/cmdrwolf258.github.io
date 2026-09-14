import {
  canReviewMining,
  json,
  readSession,
} from '../../../../../lib/auth.js';

function cleanText(value, maxLength = 1000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
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

export async function onRequestPost({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  const reportId = Number(params.id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return json({ ok: false, message: 'Invalid report ID.' }, { status: 400 });
  }

  let body = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const reviewNotes = cleanText(body.reviewNotes, 1000);

  const result = await env.DB.prepare(
    `UPDATE mining_reports
     SET status = 'rejected',
         reviewed_at = CURRENT_TIMESTAMP,
         review_notes = ?
     WHERE id = ? AND status = 'pending'`,
  ).bind(reviewNotes, reportId).run();

  if (!result.meta || result.meta.changes !== 1) {
    const report = await env.DB.prepare(
      `SELECT status FROM mining_reports WHERE id = ?`,
    ).bind(reportId).first();

    if (!report) {
      return json({ ok: false, message: 'Mining report not found.' }, { status: 404 });
    }

    return json(
      { ok: false, message: `Report is already ${report.status}.` },
      { status: 409 },
    );
  }

  return json({
    ok: true,
    reportId,
    status: 'rejected',
  });
}
