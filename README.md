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
