import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/mining.js';
import { miningRowsToPoiProvider } from '../lib/curated-poi.js';
import { loadCuratedMiningData, poiProviderToMiningSites } from '../curated-mining.js';

const rows = [
  {
    id: 42, commodity: 'Bertrandite', body: '9a', body_type: 'moon', signal: 13,
    latitude: -17.012345, longitude: 138.987654, rigs: 4, preferred: 1,
    notes: '  Exact survey note.\nKeep the second line.  ',
    source: 'approved-report', updated_at: '2026-10-01 12:00:00',
    material_amount: 'high', material_updated_at: '2026-10-01 13:00:00',
    material_updated_by: 'Private member identity',
    submitted_by: 'Private submitter', review_notes: 'Private review',
  },
  {
    id: 43, commodity: 'Silver', body: '12', body_type: 'planet', signal: 2,
    latitude: null, longitude: null, rigs: null, preferred: 0, notes: '',
    source: 'seed', updated_at: null,
    material_amount: null, material_updated_at: null, material_updated_by: null,
  },
  {
    id: 44, commodity: 'Gold', body: '8b', body_type: 'moon', signal: 1,
    latitude: 0, longitude: 0, rigs: 0, preferred: 0, notes: null,
  },
];

function legacy(row) {
  return {
    id: row.id,
    systemName: row.system_name || 'NGC 2546 Sector UZ-G d10-16',
    systemAddress: row.system_address || '560820275507',
    commodity: row.commodity, body: row.body, bodyType: row.body_type,
    signal: row.signal, latitude: row.latitude, longitude: row.longitude, rigs: row.rigs,
    preferred: Boolean(row.preferred), notes: row.notes || '',
    materialAmount: row.material_amount || null,
    materialUpdatedAt: row.material_updated_at || null,
    materialUpdatedBy: row.material_updated_by || '',
  };
}

function mockEnv() {
  const queries = [];
  return {
    queries,
    env: {
      DB: {
        prepare(sql) {
          queries.push(sql);
          return {
            bind() { return this; },
            async run() { return {}; },
            async all() {
              return { results: sql.includes('PRAGMA') ? [{ name: 'material_amount' }] : rows };
            },
          };
        },
        async batch(statements) {
          return statements.map(() => ({ meta: { changes: 0 } }));
        },
      },
    },
  };
}

test('default and unknown API formats include explicit 10-16 system identity and preserve mining fields', async () => {
  for (const query of ['', '?format=other']) {
    const { env, queries } = mockEnv();
    const response = await onRequestGet({ env, request: new Request(`https://archive.example/api/mining${query}`) });
    assert.deepEqual(await response.json(), rows.map(legacy));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const siteQuery = queries.find(sql => sql.includes('FROM mining_sites s'));
    assert.ok(siteQuery.includes('mining_site_context'));
    assert.ok(siteQuery.includes('resolved.latitude IS NOT NULL'));
    assert.ok(!siteQuery.includes('s.source'));
    assert.ok(!siteQuery.includes('s.updated_at'));
    assert.ok(queries.every(sql => !/ALTER TABLE/.test(sql)));
  }
});

test('POI GET is a public read representation of approved locations only', async () => {
  const { env, queries } = mockEnv();
  const response = await onRequestGet({ env, request: new Request('https://archive.example/api/mining?format=poi') });
  const provider = await response.json();
  assert.equal(provider.schemaVersion, 1);
  assert.equal(provider.systemId64, '560820275507');
  assert.equal(provider.systemName, 'NGC 2546 Sector UZ-G d10-16');
  assert.equal(provider.locations.length, rows.length);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(queries.some(sql => sql.includes('s.source, s.updated_at')));
  assert.ok(queries.every(sql => !/mining_reports.*(SELECT|INSERT|UPDATE|DELETE)/s.test(sql)));
  assert.deepEqual(Object.keys(provider).sort(), ['locations', 'schemaVersion', 'systemId64', 'systemName']);
});

test('coordinates, zero values, nulls, unlocated signals and notes are preserved exactly', () => {
  const { locations } = miningRowsToPoiProvider(rows);
  for (let i = 0; i < rows.length; i++) {
    assert.equal(locations[i].latitude, rows[i].latitude);
    assert.equal(locations[i].longitude, rows[i].longitude);
    assert.equal(locations[i].notes, rows[i].notes || '');
    assert.equal(locations[i].surfaceMining.rigs, rows[i].rigs);
    assert.equal(locations[i].bodyName, rows[i].body);
    assert.equal(locations[i].bodyJournalId, null);
  }
  assert.equal(locations[1].kind, 'surface-deposit');
  assert.equal(locations[1].surfaceMining.signal, 2);
});

test('stable namespaced IDs survive edited coordinates, changed labels and reordered rows', () => {
  const original = miningRowsToPoiProvider(rows).locations;
  const edited = miningRowsToPoiProvider(rows.slice().reverse().map(row => ({
    ...row, latitude: null, longitude: null, commodity: 'Changed commodity', body: 'Changed body',
  }))).locations;
  for (const before of original) {
    assert.equal(before.id, `ten16-mining:560820275507:${before.legacySiteId}`);
    assert.equal(edited.find(after => after.legacySiteId === before.legacySiteId).id, before.id);
  }
  assert.equal(new Set(original.map(location => location.id)).size, rows.length);
});

test('public provenance excludes report and Discord identities', () => {
  const provider = miningRowsToPoiProvider(rows);
  const first = provider.locations[0];
  assert.deepEqual(first.source, {
    name: '10-16 curated mining archive',
    url: 'https://ten16-archive.pages.dev/mining.html',
    reference: 'mining_sites:42',
    type: 'approved-report',
  });
  assert.equal(first.sourceUpdatedAt, rows[0].updated_at);
  assert.equal(first.materialAmount, 'high');
  assert.equal(first.materialUpdatedAt, rows[0].material_updated_at);
  assert.ok(!JSON.stringify(provider).includes('Private'));
  assert.ok(!Object.hasOwn(first, 'materialUpdatedBy'));
  assert.ok(!Object.hasOwn(first, 'submittedBy'));
  assert.ok(!Object.hasOwn(first, 'reviewNotes'));
});

test('personal-site adapter retains all card and report compatibility fields', () => {
  const provider = miningRowsToPoiProvider(rows);
  provider.locations.push({ id: 'mongrel:custom', kind: 'custom-poi', notes: 'Custom note' });
  const actual = poiProviderToMiningSites(provider);
  assert.deepEqual(actual, rows.map(row => ({ ...legacy(row), materialUpdatedBy: '' })));
});

test('personal-site adapter rejects mismatched systems and incompatible surface records', () => {
  const provider = miningRowsToPoiProvider(rows);
  assert.throws(() => poiProviderToMiningSites({ ...provider, systemId64: '123' }));
  assert.throws(() => poiProviderToMiningSites({ ...provider, schemaVersion: 2 }));
  assert.throws(() => poiProviderToMiningSites({ ...provider, locations: [{ ...provider.locations[0], legacySiteId: undefined }] }));
});

function mockFetch(reply) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const data = reply(url);
      if (data instanceof Error) throw data;
      return new Response(JSON.stringify(data), { status: data === undefined ? 404 : 200 });
    },
  };
}

test('successful same-origin POI read uses the shared source without fallback requests', async () => {
  const fixture = mockFetch(() => miningRowsToPoiProvider(rows));
  const actual = await loadCuratedMiningData({ ...fixture, warn() {} });
  assert.deepEqual(actual, rows.map(row => ({ ...legacy(row), materialUpdatedBy: '' })));
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, '/api/mining?format=poi');
  assert.equal(fixture.calls[0].options.cache, 'no-store');
  assert.ok(fixture.calls[0].options.signal instanceof AbortSignal);
});

test('static hosting tries the canonical POI read before stale local fallback', async () => {
  const fixture = mockFetch(url => url.startsWith('https://') ? miningRowsToPoiProvider(rows) : undefined);
  const actual = await loadCuratedMiningData({ ...fixture, warn() {} });
  assert.equal(actual.length, rows.length);
  assert.deepEqual(fixture.calls.map(call => call.url), [
    '/api/mining?format=poi', 'https://ten16-archive.pages.dev/api/mining?format=poi',
  ]);
});

test('pre-deployment legacy endpoint remains usable when POI responses are unavailable', async () => {
  const legacyRows = rows.map(legacy);
  const fixture = mockFetch(url => url === '/api/mining' ? legacyRows : legacyRows);
  assert.deepEqual(await loadCuratedMiningData({ ...fixture, warn() {} }), legacyRows);
  assert.deepEqual(fixture.calls.map(call => call.url), [
    '/api/mining?format=poi', 'https://ten16-archive.pages.dev/api/mining?format=poi', '/api/mining',
  ]);
});

test('network/API failures retain the existing JSON fallback and never invent coordinates', async () => {
  const snapshot = [{ commodity: 'Silver', body: '12', bodyType: 'planet', signal: 2,
    latitude: null, longitude: null, rigs: null, preferred: false, notes: '' }];
  const fixture = mockFetch(url => url.startsWith('data/') ? snapshot : new Error('Network failure'));
  assert.deepEqual(await loadCuratedMiningData({ ...fixture, now: () => 12345, warn() {} }), snapshot);
  assert.equal(fixture.calls.at(-1).url, 'data/mining.json?ts=12345');
  assert.ok(fixture.calls.every(call => call.options.cache === 'no-store'));
});

test('total source failure produces a useful error instead of fake or empty data', async () => {
  const fixture = mockFetch(() => undefined);
  await assert.rejects(loadCuratedMiningData({ ...fixture, warn() {} }), /Unable to load mining database/);
});

test('canonical-origin pages do not retry the same POI URL as a remote source', async () => {
  const legacyRows = rows.map(legacy);
  const fixture = mockFetch(url => url === '/api/mining' ? legacyRows : undefined);
  assert.deepEqual(await loadCuratedMiningData({
    ...fixture, origin: 'https://ten16-archive.pages.dev', warn() {},
  }), legacyRows);
  assert.deepEqual(fixture.calls.map(call => call.url), ['/api/mining?format=poi', '/api/mining']);
});

test('slow new POI reads time out before returning through the existing legacy fallback', async () => {
  const signals = [];
  const legacyRows = rows.map(legacy);
  const fetchImpl = async (url, options) => {
    if (!url.includes('format=poi')) return Response.json(legacyRows);
    signals.push(options.signal);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('POI request did not abort')), 100);
      options.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(options.signal.reason);
      }, { once: true });
    });
  };
  assert.deepEqual(await loadCuratedMiningData({ fetchImpl, timeoutMs: 5, warn() {} }), legacyRows);
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted && signal.reason.name === 'TimeoutError'));
});
