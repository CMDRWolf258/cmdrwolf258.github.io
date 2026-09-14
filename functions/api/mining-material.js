import {
  canReviewMining,
  canSubmitMining,
  json,
  readSession,
} from '../../lib/auth.js';
import {
  ensureMaterialSchema,
  materialAmountLabel,
  materialStatusStatement,
  normalizeMaterialAmount,
} from '../../lib/mining-material.js';

function cleanText(value, maxLength = 200) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  if (origin && origin !== url.origin) {
    return json({ ok: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  const session = await readSession(request, env);

  if (!session) {
    return json(
      { ok: false, message: 'Sign in with Discord to report material amount.' },
      { status: 401 },
    );
  }

  if (!canSubmitMining(session)) {
    return json(
      { ok: false, message: 'The Mongrel member role is required to report material amount.' },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: 'Invalid JSON.' }, { status: 400 });
  }

  const siteId = Number(body.siteId);
  const amount = normalizeMaterialAmount(body.amount);

  if (!Number.isInteger(siteId) || siteId < 1) {
    return json({ ok: false, message: 'A valid mining site is required.' }, { status: 400 });
  }

  if (!amount) {
    return json(
      { ok: false, message: 'Material amount must be High, Medium, Low, or Depleted.' },
      { status: 400 },
    );
  }

  await ensureMaterialSchema(env);

  const site = await env.DB.prepare(`
    SELECT id, commodity, body, body_type, signal
    FROM mining_sites
    WHERE id = ?
  `).bind(siteId).first();

  if (!site) {
    return json({ ok: false, message: 'Mining site not found.' }, { status: 404 });
  }

  const submittedBy = cleanText(
    session.displayName || session.username || `Discord ${session.sub}`,
    100,
  );
  const label = materialAmountLabel(amount);
  const notes = `Material Amount: ${label}`;

  if (canReviewMining(session)) {
    const results = await env.DB.batch([
      materialStatusStatement(env, siteId, amount, submittedBy),
      env.DB.prepare(`
        INSERT INTO mining_reports (
          report_type,
          target_site_id,
          commodity,
          body,
          body_type,
          signal,
          latitude,
          longitude,
          rigs,
          preferred,
          notes,
          submitted_by,
          status,
          reviewed_at,
          review_notes,
          material_amount
        )
        VALUES (
          'material', ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?,
          'approved', CURRENT_TIMESTAMP, 'Applied directly by Site Admin.', ?
        )
      `).bind(
        siteId,
        site.commodity,
        site.body,
        site.body_type,
        site.signal,
        notes,
        submittedBy,
        amount,
      ),
    ]);

    const status = await env.DB.prepare(`
      SELECT amount, updated_at, updated_by
      FROM mining_material_status
      WHERE site_id = ?
    `).bind(siteId).first();

    return json({
      ok: true,
      status: 'applied',
      message: `Material amount updated to ${label}.`,
      reportId: results?.[1]?.meta?.last_row_id ?? null,
      siteId,
      amount,
      updatedAt: status?.updated_at || null,
      updatedBy: status?.updated_by || submittedBy,
    }, { status: 201 });
  }

  const result = await env.DB.prepare(`
    INSERT INTO mining_reports (
      report_type,
      target_site_id,
      commodity,
      body,
      body_type,
      signal,
      latitude,
      longitude,
      rigs,
      preferred,
      notes,
      submitted_by,
      status,
      material_amount
    )
    VALUES ('material', ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?, 'pending', ?)
  `).bind(
    siteId,
    site.commodity,
    site.body,
    site.body_type,
    site.signal,
    notes,
    submittedBy,
    amount,
  ).run();

  return json({
    ok: true,
    status: 'pending',
    message: `${label} material amount submitted for review.`,
    reportId: result.meta?.last_row_id ?? null,
    siteId,
    amount,
  }, { status: 201 });
}
