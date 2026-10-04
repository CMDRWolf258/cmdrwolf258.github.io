import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { onRequestGet as readDeposits } from '../functions/api/mining.js';
import { onRequestGet as readCenters } from '../functions/api/mining-centers.js';
import { onRequestPost as saveCenter } from '../functions/api/hud/mining-center.js';
import { onRequestPost as saveDeposit } from '../functions/api/hud/mining-report.js';

// This is a legacy-schema test fixture, never a production database migration.
const legacySchema = `
  CREATE TABLE mining_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT, commodity TEXT NOT NULL,
    body TEXT NOT NULL, body_type TEXT NOT NULL, signal INTEGER NOT NULL,
    latitude REAL, longitude REAL, rigs INTEGER, preferred INTEGER,
    notes TEXT, source TEXT, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE mining_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, report_type TEXT, target_site_id INTEGER,
    commodity TEXT, body TEXT, body_type TEXT, signal INTEGER,
    latitude REAL, longitude REAL, rigs INTEGER, preferred INTEGER, notes TEXT,
    submitted_by TEXT, status TEXT, submitted_at TEXT, reviewed_at TEXT, review_notes TEXT
  );
  INSERT INTO mining_sites (commodity,body,body_type,signal,latitude,longitude,rigs,preferred,notes,source)
  VALUES ('Gold','7b','moon',10,-22.7,-98.8,2,1,'Existing deposit','fixture');
`;

function sqliteEnv(db, fail = () => false) {
  return { DB: {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        execute() {
          if (fail(sql)) throw new Error('D1_ERROR: internal failure; SELECT private-test-data');
          return db.prepare(sql);
        },
        async all() { return { results: this.execute().all(...this.args) }; },
        async first() { return this.execute().get(...this.args) ?? null; },
        async run() {
          const result = this.execute().run(...this.args);
          return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
        },
      };
      return statement;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  } };
}

const position = {
  system: 'NGC 2546 Sector UZ-G d10-16', systemAddress: '560820275507',
  body: '7b', signal: 10, latitude: -22.77, longitude: -98.81,
};
function post(path, body = position) {
  return new Request(`https://archive.test/api/hud/${path}`, {
    method: 'POST', headers: { Authorization: 'Bearer private-test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function mockAuth(t, access = 'site_admin') {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, access, commander: 'Private fixture CMDR' }));
}
function captureLog(t) {
  const entries = [];
  t.mock.method(console, 'error', (...entry) => { entries.push(entry); });
  return entries;
}
async function assertDiagnostic(response, expected, logs) {
  assert.equal(response.status, expected.status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error, expected.error);
  assert.equal(payload.diagnostics.phase, expected.phase);
  assert.equal(payload.diagnostics.operation, expected.operation);
  assert.equal(payload.diagnostics.storage, 'D1');
  assert.match(payload.diagnostics.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers.get('x-mining-diagnostic-id'), payload.diagnostics.requestId);
  assert.ok(logs.some(entry => entry[1].requestId === payload.diagnostics.requestId));
  assert.ok(!/SELECT|private-test|Private fixture|Bearer|CREATE TABLE/i.test(JSON.stringify(payload)));
  return payload;
}

test('all mining routes report an absent D1 binding after existing auth and validation', async t => {
  const logs = captureLog(t);
  mockAuth(t);
  const cases = [
    [readDeposits, { request: new Request('https://archive.test/api/mining'), env: {} }, 'read-deposits'],
    [readCenters, { env: {} }, 'read-centers'],
    [saveCenter, { request: post('mining-center'), env: {} }, 'save-center'],
    [saveDeposit, { request: post('mining-report', { ...position, commodity: 'Gold' }), env: {} }, 'save-deposit'],
  ];
  for (const [route, context, operation] of cases) {
    await assertDiagnostic(await route(context), {
      status: 503, error: 'mining_database_binding_missing', phase: 'binding', operation,
    }, logs);
  }
  const poi = await readDeposits({ request: new Request('https://archive.test/api/mining?format=poi'), env: {} });
  assert.equal(poi.headers.get('access-control-allow-origin'), '*');
  const denied = await saveCenter({ request: new Request('https://archive.test/api/hud/mining-center', { method: 'POST' }), env: {} });
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { ok: false, error: 'invalid_scout_token' });
});

test('missing legacy tables return schema diagnostics without inventing or seeding deposits', async t => {
  const logs = captureLog(t);
  mockAuth(t);
  const cases = [
    [readDeposits, { request: new Request('https://archive.test/api/mining') }, 'read-deposits', 'schema.material'],
    [readCenters, {}, 'read-centers', 'schema.navigation'],
    [saveCenter, { request: post('mining-center') }, 'save-center', 'schema.navigation'],
    [saveDeposit, { request: post('mining-report', { ...position, commodity: 'Gold' }) }, 'save-deposit', 'schema.navigation'],
  ];
  for (const [route, context, operation, phase] of cases) {
    const db = new DatabaseSync(':memory:');
    try {
      await assertDiagnostic(await route({ ...context, env: sqliteEnv(db) }), {
        status: 503, error: 'mining_database_schema_missing', operation, phase,
      }, logs);
      assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='mining_sites'").get(), undefined);
    } finally { db.close(); }
  }
});

test('schema and query failures identify their phase and keep SQL out of public responses', async t => {
  const logs = captureLog(t);
  for (const [route, operation, phase, fail] of [
    [readDeposits, 'read-deposits', 'schema.material', sql => sql.includes('CREATE TABLE')],
    [readCenters, 'read-centers', 'query.centers', sql => sql.includes('SELECT c.id, c.body')],
  ]) {
    const db = new DatabaseSync(':memory:');
    db.exec(legacySchema);
    try {
      await assertDiagnostic(await route({ request: new Request('https://archive.test/api/mining'), env: sqliteEnv(db, fail) }), {
        status: 500,
        error: phase.startsWith('schema.') ? 'mining_database_schema_failed' : 'mining_database_query_failed',
        operation, phase,
      }, logs);
    } finally { db.close(); }
  }
});

test('a legacy center table missing required columns is identified at the center query', async t => {
  const logs = captureLog(t);
  const db = new DatabaseSync(':memory:');
  db.exec(legacySchema);
  db.exec('CREATE TABLE mining_location_centers (id INTEGER PRIMARY KEY, body TEXT, signal INTEGER)');
  try {
    await assertDiagnostic(await readCenters({ env: sqliteEnv(db) }), {
      status: 503, error: 'mining_database_schema_missing',
      operation: 'read-centers', phase: 'query.centers',
    }, logs);
    assert.deepEqual(db.prepare('PRAGMA table_info(mining_location_centers)').all().map(row => row.name), ['id', 'body', 'signal']);
  } finally { db.close(); }
});

test('a fresh database client reads the shared center and keeps existing deposits unchanged', async t => {
  mockAuth(t);
  const directory = mkdtempSync(join(tmpdir(), 'ten16-shared-center-'));
  const path = join(directory, 'fixture.sqlite');
  let db = new DatabaseSync(path);
  try {
    db.exec(legacySchema);
    const request = new Request('https://archive.test/api/mining');
    const before = await (await readDeposits({ request, env: sqliteEnv(db) })).json();
    const savedResponse = await saveCenter({ request: post('mining-center'), env: sqliteEnv(db) });
    assert.equal(savedResponse.status, 201);
    const saved = await savedResponse.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.center.systemAddress, position.systemAddress);
    db.close();
    db = new DatabaseSync(path);
    const freshResponse = await readCenters({ env: sqliteEnv(db) });
    assert.equal(freshResponse.status, 200);
    const freshCenters = await freshResponse.json();
    assert.deepEqual(freshCenters, [saved.center]);
    assert.ok(!JSON.stringify(freshCenters).includes('Private fixture CMDR'));
    const after = await (await readDeposits({ request, env: sqliteEnv(db) })).json();
    assert.deepEqual(after, before);
    const updated = await (await saveCenter({ request: post('mining-center', { ...position, longitude: -98.82 }), env: sqliteEnv(db) })).json();
    assert.equal(updated.center.id, saved.center.id);
    assert.equal((await (await readCenters({ env: sqliteEnv(db) })).json()).length, 1);
  } finally {
    db.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('ten16-shared-center-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
