# cmdrwolf258.github.io
NGC 2546 Sector UZ-G d10-16 System Archive

The curated mining archive uses the existing central D1 database bound as `DB`.
Deposits (`/api/mining`, `/api/hud/mining-report`) and body + signal centers
(`/api/mining-centers`, `/api/hud/mining-center`) use that same binding. Public
read endpoints return central records; HUD caches are outage fallbacks only.
Do not seed or replace the database from static JSON or the legacy Worker reader.

Mining failures return a safe error code, operation/phase, and correlation ID
that matches the private Functions log. Inspect the deployed binding and log
before changing storage. Quota exhaustion is an operational failure and must
not be presented as a successful local save.

Backend regression tests use disposable SQLite fixtures, including a fresh
connection reading a centrally saved center while existing deposits remain
unchanged. They do not replace production API or EDMC/HUD verification.


## Multi-system mining D1 expansion — draft PR #4 (NOT DEPLOYED)

The legacy 10-16 archive is retained with its existing tables and
name-or-address compatibility rules. This branch adds new tables:
\`mining_multi_centers\` and \`mining_multi_sites\`. It does **not** alter,
delete, backfill or renumber old 10-16 records.

Off-system writes require a validated decimal Frontier system ID64, the full
journal BodyName prefixed by that system's name, a signal number and measured
coordinates. An identical coordinate retry is idempotent. Approved close
duplicates of the same commodity/body/signal (within 1 km with known radius)
enter \`duplicate_review\` rather than becoming separate public deposits.
Only site admins can save location centers; ordinary member deposit submissions
stay pending. The optional new admin page \`/mining-multi-admin.html\` uses the
existing Discord site-admin session to approve/reject submissions and explicitly
resolve nearby duplicates; legacy \`/mining-admin.html\` remains unchanged.

The public \`/api/mining-systems\` endpoint supplies a bounded catalogue of
systems containing an **approved deposit or a shared location center**.
It includes the original 10-16 system, excludes pending-only systems and
never returns private CMDR/report details or coordinates. The HUD caches the
directory for one hour; typing into its autocomplete performs client-side
matching and **does not call this endpoint**. Deposit/center data is fetched
only for the specific chosen system and cached independently.

Multi-system reads are **opt-in by exact URL filter**, e.g.
\`/api/mining?systemAddress=12345678901234567\` and
\`/api/mining-centers?systemAddress=12345678901234567\`. These query only their
own indexed ID64 rows; unfiltered legacy reads continue to return the existing
10-16 data. The separate Scout/HUD PR #182 prepares read-through support but
defaults it off pending backend deployment.

### Mandatory deployment checklist

1. Verify the Cloudflare Pages project \`ten16-archive\` is connected to this
   repository and the deployed \`DB\` binding is the intended production D1.
2. Take and verify a production **D1 backup** before the first deployment or
   new table initialization; use Cloudflare's supported backup/export procedure.
3. Run CI tests, including \`scripts/test-mining-multisystem.mjs\` and the
   existing 10-16 backend, curated-POI and query-cost regressions.
4. Deploy the archive in a controlled release, verify new tables, writer auth,
   pending review and exact-ID64 reads, then enable the matching Scout/HUD
   release flags. Do not enable shared writes or reads prematurely.
5. Verify the HUD/iPad compass, journal identity and actual location
   recordings on a Windows Elite client. Confirm legacy 10-16 reports and
   centers still work. Keep Surveyor PR #179 independently staged.

Do not consider a local-only HUD mining record squad-synchronized until the
server explicitly acknowledges a successful authenticated write.
