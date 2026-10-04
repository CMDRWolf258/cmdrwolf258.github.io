"""Compare ordered query output and SQLite VM work, not Cloudflare billed rows.

Use --input <public mining JSON> for a local live-data reproduction. CI uses
synthetic records; neither mode writes a production database or caches its data.
"""
import argparse
import json
from pathlib import Path
import re
import sqlite3
import time

ROOT = Path(__file__).resolve().parent.parent
SYSTEM = 'NGC 2546 Sector UZ-G d10-16'
SCHEMA = '''
CREATE TABLE mining_sites (
  id INTEGER PRIMARY KEY, commodity TEXT, body TEXT, body_type TEXT,
  signal INTEGER, latitude REAL, longitude REAL, rigs INTEGER,
  preferred INTEGER, notes TEXT, source TEXT, updated_at TEXT
);
CREATE TABLE mining_site_context (site_id INTEGER PRIMARY KEY, system_name TEXT, system_address TEXT);
CREATE TABLE mining_material_status (site_id INTEGER PRIMARY KEY, amount TEXT, updated_at TEXT, updated_by TEXT);
'''


def synthetic_rows():
    rows = []
    for index in range(392):
        resolved = index < 71
        rows.append({
            'id': index + 1, 'commodity': ['Gold', 'gold', 'Silver', 'Bertrandite'][index % 4],
            'body': ['7b', '7B', '9a', '12'][index % 4], 'bodyType': 'moon',
            'signal': index // 8 + 1,
            'latitude': 0 if resolved else None,
            'longitude': -98.81 if resolved else None,
            'rigs': index % 3, 'preferred': index % 2, 'notes': f'Test row {index}',
            'source': 'synthetic', 'updatedAt': '2026-10-01 00:00:00',
        })
    # Edge cases cover partial/zero coordinates and nullable legacy identity fields.
    for extra, fields in enumerate([
        {'latitude': 0, 'longitude': None},
        {'latitude': None, 'longitude': 0},
        {'latitude': 0, 'longitude': 0},
        {'commodity': None}, {'body': None}, {'signal': None},
        {'body': ' 7b '}, {'commodity': 'GOLD'},
    ]):
        rows.append({**rows[80], 'id': 393 + extra, **fields})
    return rows


def fixture(rows, systems, edge_contexts=True):
    db = sqlite3.connect(':memory:')
    db.executescript(SCHEMA)
    for group in range(systems):
        for raw in rows:
            row_id = raw['id'] + group * 1000000
            db.execute('INSERT INTO mining_sites VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (
                row_id, raw.get('commodity'), raw.get('body'), raw.get('bodyType'),
                raw.get('signal'), raw.get('latitude'), raw.get('longitude'), raw.get('rigs'),
                raw.get('preferred'), raw.get('notes'), raw.get('source'), raw.get('updatedAt'),
            ))
            # Missing context uses the existing 10-16 fallback. Other systems have
            # explicit names; blank names must remain distinct during suppression.
            if group or row_id % 11:
                name = SYSTEM if not group else f'Synthetic test system {group}'
                if edge_contexts and not group and row_id % 37 == 0:
                    name = ''
                db.execute('INSERT INTO mining_site_context VALUES(?,?,?)', (row_id, name, str(group)))
            if row_id % 5 == 0:
                db.execute('INSERT INTO mining_material_status VALUES(?,?,?,?)', (
                    row_id, 'high', '2026-10-01 00:00:00', 'Private synthetic identity',
                ))
    return db


def measure(db, query):
    ticks = 0

    def progress():
        nonlocal ticks
        ticks += 1
        return 0

    db.set_progress_handler(progress, 100)
    started = time.perf_counter()
    try:
        result = db.execute(query, (SYSTEM, SYSTEM)).fetchall()
    finally:
        db.set_progress_handler(None, 0)
    return result, {
        'approxVmSteps': ticks * 100,
        'elapsedMs': round((time.perf_counter() - started) * 1000, 2),
        'plan': [row[3] for row in db.execute('EXPLAIN QUERY PLAN ' + query, (SYSTEM, SYSTEM))],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path)
    args = parser.parse_args()
    rows = json.loads(args.input.read_text(encoding='utf-8')) if args.input else synthetic_rows()
    old_query = (ROOT / 'scripts/fixtures/mining-query-before.sql').read_text(encoding='utf-8')
    source = (ROOT / 'functions/api/mining.js').read_text(encoding='utf-8')
    new_template = re.search(r'\.prepare\(`([\s\S]*?)`\)', source).group(1)
    for systems in (1, 8):
        with fixture(rows, systems, edge_contexts=not args.input) as db:
            for poi in (False, True):
                old = old_query.replace('c.system_address,', 'c.system_address, s.source, s.updated_at,') if poi else old_query
                new = new_template.replace("${poiFormat ? 's.source, s.updated_at,' : ''}", 's.source, s.updated_at,' if poi else '')
                before, baseline = measure(db, old)
                after, optimized = measure(db, new)
                assert before == after, 'The selected rows, values, or ordering changed'
                assert any('CORRELATED' in item for item in baseline['plan'])
                assert not any('CORRELATED' in item for item in optimized['plan'])
                assert optimized['approxVmSteps'] < baseline['approxVmSteps'] * 0.25, 'Repeated scanning returned'
                print(json.dumps({
                    'inputRows': len(rows) * systems, 'syntheticSystems': systems - 1,
                    'format': 'poi' if poi else 'default', 'outputRows': len(after),
                    'orderedEquivalent': True,
                    'baselineVmSteps': baseline['approxVmSteps'],
                    'optimizedVmSteps': optimized['approxVmSteps'],
                    'vmReductionPercent': round((1 - optimized['approxVmSteps'] / baseline['approxVmSteps']) * 100, 2),
                }))
        db.close()


if __name__ == '__main__':
    main()
