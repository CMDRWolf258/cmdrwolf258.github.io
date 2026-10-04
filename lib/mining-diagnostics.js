// Keep D1 failures useful to Scout/HUD without exposing SQL or member data.
export async function withMiningDatabase(env, operation, run, { publicCors = false } = {}) {
  const requestId = crypto.randomUUID();
  let phase = 'binding';
  try {
    if (typeof env?.DB?.prepare !== 'function' || typeof env?.DB?.batch !== 'function') {
      throw new Error('The Pages DB binding is missing or is not a D1 database.');
    }
    return await run(nextPhase => { phase = nextPhase; });
  } catch (error) {
    const detail = String(error?.message || error);
    const quotaExceeded = /(?:exceeded|daily).*?rows?[\s_-]+read.*?limit/i.test(detail);
    const schemaMissing = /no such table|no such column|has no column named/i.test(detail);
    const code = phase === 'binding' ? 'mining_database_binding_missing'
      : quotaExceeded ? 'mining_database_read_quota_exceeded'
      : schemaMissing ? 'mining_database_schema_missing'
      : phase.startsWith('schema.') ? 'mining_database_schema_failed'
      : 'mining_database_query_failed';
    const status = phase === 'binding' || schemaMissing || quotaExceeded ? 503 : 500;
    // Preserve lazy recovery if schema disappears or D1 becomes unavailable
    // after initialization, without retaining a rejected readiness promise.
    invalidateDatabaseSchemas(env?.DB);
    // The correlation ID connects the public response to the private server log.
    // Request headers, payloads and credentials are never logged here.
    console.error('Mining D1 request failed', {
      requestId, operation, phase, error: detail.slice(0, 2000),
    });
    return Response.json({
      ok: false,
      error: code,
      diagnostics: { service: 'ten16-archive', storage: 'D1', operation, phase, requestId },
    }, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Mining-Diagnostic-Id': requestId,
        ...(publicCors ? { 'Access-Control-Allow-Origin': '*' } : {}),
      },
    });
  }
}
import { invalidateDatabaseSchemas } from './mining-schema.js';

