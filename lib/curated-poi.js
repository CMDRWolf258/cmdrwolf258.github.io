export const TEN16_SYSTEM = Object.freeze({
  systemId64: '560820275507',
  systemName: 'NGC 2546 Sector UZ-G d10-16',
});

// A representation of approved curated locations only, never system/core data.
export function miningRowsToPoiProvider(rows) {
  return {
    schemaVersion: 1,
    ...TEN16_SYSTEM,
    locations: rows.map(site => ({
      id: `ten16-mining:${TEN16_SYSTEM.systemId64}:${site.id}`,
      legacySiteId: site.id,
      name: `${site.commodity} — ${site.body} #${site.signal}`,
      kind: 'surface-deposit',
      bodyJournalId: null,
      bodyName: site.body,
      latitude: site.latitude ?? null,
      longitude: site.longitude ?? null,
      commodities: [site.commodity],
      resourceTags: [],
      notes: site.notes || '',
      source: {
        name: '10-16 curated mining archive',
        url: 'https://ten16-archive.pages.dev/mining.html',
        reference: `mining_sites:${site.id}`,
        ...(site.source ? { type: site.source } : {}),
      },
      sourceUpdatedAt: site.updated_at || null,
      surfaceMining: {
        signal: site.signal,
        rigs: site.rigs ?? null,
        preferred: Boolean(site.preferred),
        bodyType: site.body_type,
      },
      materialAmount: site.material_amount || null,
      materialUpdatedAt: site.material_updated_at || null,
    })),
  };
}
