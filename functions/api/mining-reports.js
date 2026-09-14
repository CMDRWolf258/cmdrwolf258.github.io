import {
  canSubmitMining,
  json,
  readSession,
} from '../../lib/auth.js';

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
      { ok: false, message: 'Sign in with Discord to submit mining reports.' },
      { status: 401 },
    );
  }

  if (!canSubmitMining(session)) {
    return json(
      { ok: false, message: 'The Mongrel member role is required to submit mining reports.' },
      { status: 403 },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: 'Invalid JSON.' }, { status: 400 });
  }

  const reportType = cleanText(body.reportType || 'add', 20).toLowerCase();
  const allowedReportTypes = new Set(['add', 'update', 'delete']);

  if (!allowedReportTypes.has(reportType)) {
    return json({ ok: false, message: 'Invalid report type.' }, { status: 400 });
  }

  const commodity = cleanText(body.commodity, 100);
  const bodyName = cleanText(body.body, 30);
  const bodyType = cleanText(body.bodyType, 20).toLowerCase();
  const signal = numberOrNull(body.signal);
  const latitude = numberOrNull(body.latitude);
  const longitude = numberOrNull(body.longitude);
  const rigs = numberOrNull(body.rigs);
  const targetSiteId = numberOrNull(body.targetSiteId);
  const preferred = body.preferred ? 1 : 0;
  const notes = cleanText(body.notes, 1000);

  if (!commodity) {
    return json({ ok: false, message: 'Commodity is required.' }, { status: 400 });
  }

  if (!bodyName) {
    return json({ ok: false, message: 'Body is required.' }, { status: 400 });
  }

  if (bodyType !== 'planet' && bodyType !== 'moon') {
    return json(
      { ok: false, message: 'Body type must be planet or moon.' },
      { status: 400 },
    );
  }

  if (signal === null || !Number.isInteger(signal) || signal < 1) {
    return json(
      { ok: false, message: 'Signal must be a positive whole number.' },
      { status: 400 },
    );
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return json(
      { ok: false, message: 'Latitude must be between -90 and 90.' },
      { status: 400 },
    );
  }

  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return json(
      { ok: false, message: 'Longitude must be between -180 and 180.' },
      { status: 400 },
    );
  }

  if (
    rigs !== null &&
    (!Number.isInteger(rigs) || rigs < 0 || rigs > 100)
  ) {
    return json(
      { ok: false, message: 'Rig count must be a whole number from 0 to 100.' },
      { status: 400 },
    );
  }

  if (
    (reportType === 'update' || reportType === 'delete') &&
    (targetSiteId === null || !Number.isInteger(targetSiteId) || targetSiteId < 1)
  ) {
    return json(
      { ok: false, message: 'A target site ID is required for updates or deletions.' },
      { status: 400 },
    );
  }

  const submittedBy = cleanText(
    session.displayName || session.username || `Discord ${session.sub}`,
    100,
  );

  const result = await env.DB
    .prepare(`
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
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `)
    .bind(
      reportType,
      targetSiteId,
      commodity,
      bodyName,
      bodyType,
      signal,
      latitude,
      longitude,
      rigs,
      preferred,
      notes,
      submittedBy,
    )
    .run();

  return json(
    {
      ok: true,
      message: 'Mining report submitted for review.',
      reportId: result.meta?.last_row_id ?? null,
      submittedBy,
      status: 'pending',
    },
    { status: 201 },
  );
}
