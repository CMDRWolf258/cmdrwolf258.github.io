# Curated location sharing

The deployed archive already keeps approved mining locations in its existing
Cloudflare D1 `mining_sites` table. Approved add/update/delete reports write to
that table. `mining_material_status` contains operational material reports.
`data/mining.json` is an older fallback snapshot used when the live source is
unavailable; it is not a second editing authority. The system-data workflow
updates market and faction/system snapshots, not curated mining records.

`GET /api/mining?format=poi` exposes the same approved locations as a public
version 1 curated-location provider. The default `GET /api/mining` response,
authenticated report/material routes, Discord permissions, and approval workflow
retain their existing behavior. No database, API route, table, or lazy migration
is added. Public cross-site reads are enabled only for the POI representation;
it exports no report/reviewer or Discord identity fields.

The provider envelope contains `schemaVersion`, string `systemId64`,
`systemName`, and `locations`. A location contains a namespaced `id`,
`legacySiteId` for the archive's existing report workflow, `name`, `kind`,
`bodyJournalId` (null when unknown), original `bodyName`, unchanged
`latitude`/`longitude` or null, `commodities`, `resourceTags`, `notes`, `source`,
and `sourceUpdatedAt`. `surfaceMining` preserves signal number, rig count,
preferred status and body type. Public `materialAmount`/`materialUpdatedAt`
carry existing operational status. An optional exact `ringName` can be used by other
providers; these surface surveys contain no ring associations. Records without
coordinates remain known signals, never estimated locations.

IDs use `ten16-mining:560820275507:<existing database id>`, so changing coordinates,
labels or ordering does not change a record's shared ID. The original base table
schema is not in this repository, so database-ID non-reuse after deletion cannot
be proven here. Do not reassign/reseed existing numeric IDs. A future permanent
UUID or verified AUTOINCREMENT migration requires inspecting that schema first;
this integration does not silently perform one.

The mining page prefers the shared POI representation and adapts it to its
existing card/search fields. On static hosting it tries the canonical archive
provider before the legacy API and JSON fallback. Existing coordinate copying,
commodity filtering, preferred sites, market data, report submissions and
material updates retain their field shapes. Custom non-mining POIs do not appear
as mining sites in this archive.

New POI reads have a six-second timeout so an unavailable provider cannot stall
the existing fallback indefinitely. The canonical origin is tried only once
when the page is already running on that origin.

Consumers join curated locations to their separately imported core system data
using system ID/name and body journal ID or exact body-name reference. This
provider supplies only curated locations; it does not supply stars, planets,
moons, rings, orbital relationships, stations or settlements. The schema can be
used by static files or other providers for any system without depending on this
archive. No copied live locations are introduced as an authoritative JSON file.

Deploy this archive PR first. Verify the canonical `?format=poi` endpoint and its
public-read CORS header, then enable the consumer integration. The consumer may
load before deployment but should report curated locations as unavailable rather
than inventing them. Existing legacy/JSON fallbacks keep the archive usable
during rollout or network failures.

Run `node --experimental-default-type=module --test scripts/test-curated-poi.mjs`
with Node 22, or `node --test scripts/test-curated-poi.mjs` with Node 24. These
checks cover legacy API compatibility, coordinate/null preservation, IDs,
public provenance, adapter fields and the source fallback order. They do not
inspect or change the production database.
