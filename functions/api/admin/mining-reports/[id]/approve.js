import {
  canReviewMining,
  json,
  readSession,
} from '../../../../../lib/auth.js';
import {
  ensureMaterialSchema,
  materialStatusStatement,
  normalizeMaterialAmount,
} from '../../../../../lib/mining-material.js';

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

  await ensureMaterialSchema(env);

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

  const report = await env.DB.prepare(
    `SELECT * FROM mining_reports WHERE id = ?`,
  ).bind(reportId).first();

  if (!report) {
    return json({ ok: false, message: 'Mining report not found.' }, { status: 404 });
  }

  if (report.status !== 'pending') {
    return json(
      { ok: false, message: `Report is already ${report.status}.` },
      { status: 409 },
    );
  }

  const reportType = String(report.report_type || '').toLowerCase();

  if (!['add', 'update', 'delete', 'material'].includes(reportType)) {
    return json({ ok: false, message: 'Unsupported report type.' }, { status: 400 });
  }

  if (
    (reportType === 'update' || reportType === 'delete' || reportType === 'material') &&
    !report.target_site_id
  ) {
    return json({ ok: false, message: 'This report has no target site.' }, { status: 400 });
  }

  let materialAmount = null;
  if (reportType === 'material') {
    materialAmount = normalizeMaterialAmount(report.material_amount);
    if (!materialAmount) {
      return json({ ok: false, message: 'This material report has an invalid amount.' }, { status: 400 });
    }
  }

  if (reportType === 'update' || reportType === 'delete' || reportType === 'material') {
    const site = await env.DB.prepare(
      `SELECT id FROM mining_sites WHERE id = ?`,
    ).bind(report.target_site_id).first();

    if (!site) {
      return json({ ok: false, message: 'Target mining site was not found.' }, { status: 404 });
    }
  }

  const claim = await env.DB.prepare(
    `UPDATE mining_reports
     SET status = 'processing'
     WHERE id = ? AND status = 'pending'`,
  ).bind(reportId).run();

  if (!claim.meta || claim.meta.changes !== 1) {
    return json(
      { ok: false, message: 'This report is already being reviewed.' },
      { status: 409 },
    );
  }

  try {
    let siteId = report.target_site_id || null;

    if (reportType === 'add') {
      const results = await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO mining_sites (
             commodity,
             body,
             body_type,
             signal,
             latitude,
             longitude,
             rigs,
             preferred,
             notes,
             source,
             created_at,
             updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved-report', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ).bind(
          report.commodity,
          report.body,
          report.body_type,
          report.signal,
          report.latitude,
          report.longitude,
          report.rigs,
          report.preferred,
          report.notes || '',
        ),
        env.DB.prepare(
          `UPDATE mining_reports
           SET status = 'approved',
               target_site_id = last_insert_rowid(),
               reviewed_at = CURRENT_TIMESTAMP,
               review_notes = ?
           WHERE id = ? AND status = 'processing'`,
        ).bind(reviewNotes, reportId),
      ]);

      siteId = results?.[0]?.meta?.last_row_id || null;
    } else if (reportType === 'update') {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE mining_sites
           SET commodity = ?,
               body = ?,
               body_type = ?,
               signal = ?,
               latitude = ?,
               longitude = ?,
               rigs = ?,
               preferred = ?,
               notes = ?,
               source = 'approved-report',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(
          report.commodity,
          report.body,
          report.body_type,
          report.signal,
          report.latitude,
          report.longitude,
          report.rigs,
          report.preferred,
          report.notes || '',
          report.target_site_id,
        ),
        env.DB.prepare(
          `UPDATE mining_reports
           SET status = 'approved',
               reviewed_at = CURRENT_TIMESTAMP,
               review_notes = ?
           WHERE id = ? AND status = 'processing'`,
        ).bind(reviewNotes, reportId),
      ]);
    } else if (reportType === 'material') {
      await env.DB.batch([
        materialStatusStatement(
          env,
          report.target_site_id,
          materialAmount,
          report.submitted_by || '',
        ),
        env.DB.prepare(
          `UPDATE mining_reports
           SET status = 'approved',
               reviewed_at = CURRENT_TIMESTAMP,
               review_notes = ?
           WHERE id = ? AND status = 'processing'`,
        ).bind(reviewNotes, reportId),
      ]);
    } else {
      await env.DB.batch([
        env.DB.prepare(
          `DELETE FROM mining_material_status WHERE site_id = ?`,
        ).bind(report.target_site_id),
        env.DB.prepare(
          `DELETE FROM mining_sites WHERE id = ?`,
        ).bind(report.target_site_id),
        env.DB.prepare(
          `UPDATE mining_reports
           SET status = 'approved',
               reviewed_at = CURRENT_TIMESTAMP,
               review_notes = ?
           WHERE id = ? AND status = 'processing'`,
        ).bind(reviewNotes, reportId),
      ]);
    }

    return json({
      ok: true,
      reportId,
      status: 'approved',
      reportType,
      siteId,
      materialAmount,
    });
  } catch (error) {
    console.error('Mining approval failed', error);

    await env.DB.prepare(
      `UPDATE mining_reports
       SET status = 'pending'
       WHERE id = ? AND status = 'processing'`,
    ).bind(reportId).run();

    return json(
      { ok: false, message: 'Unable to approve mining report.' },
      { status: 500 },
    );
  }
}
