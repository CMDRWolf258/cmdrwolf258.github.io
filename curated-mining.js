const SYSTEM_ID64 = '560820275507';
const CANONICAL_ORIGIN = 'https://ten16-archive.pages.dev';
const CANONICAL_POI_URL = `${CANONICAL_ORIGIN}/api/mining?format=poi`;

// Keep the existing card/report site IDs and mining-specific fields intact.
export function poiProviderToMiningSites(provider) {
  if (provider?.schemaVersion !== 1 || provider.systemId64 !== SYSTEM_ID64 ||
      !Array.isArray(provider.locations)) {
    throw new Error('Unsupported curated mining provider.');
  }

  return provider.locations.filter(location => location.kind === 'surface-deposit')
    .map(location => {
      const mining = location.surfaceMining;
      if (!Number.isInteger(location.legacySiteId) || location.legacySiteId < 1 ||
          typeof location.bodyName !== 'string' || !location.bodyName ||
          !Array.isArray(location.commodities) || typeof location.commodities[0] !== 'string' ||
          !mining || !['planet', 'moon'].includes(mining.bodyType)) {
        throw new Error('Curated mining location is missing archive compatibility fields.');
      }

      return {
        id: location.legacySiteId,
        commodity: location.commodities[0],
        body: location.bodyName,
        bodyType: mining.bodyType,
        signal: mining.signal,
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
        rigs: mining.rigs ?? null,
        preferred: Boolean(mining.preferred),
        notes: location.notes || '',
        materialAmount: location.materialAmount || null,
        materialUpdatedAt: location.materialUpdatedAt || null,
        materialUpdatedBy: '',
      };
    });
}

export async function loadCuratedMiningData({
  fetchImpl = fetch,
  now = Date.now,
  warn = (...args) => console.warn(...args),
  origin = '',
  timeoutMs = 6000,
} = {}) {
  const sources = [
    { url: '/api/mining?format=poi', poi: true },
    ...(origin === CANONICAL_ORIGIN ? [] : [{ url: CANONICAL_POI_URL, poi: true }]),
    { url: '/api/mining', poi: false },
    { url: () => `data/mining.json?ts=${now()}`, poi: false },
  ];

  for (const source of sources) {
    const url = typeof source.url === 'function' ? source.url() : source.url;
    try {
      const response = await fetchImpl(url, {
        cache: 'no-store',
        ...(source.poi ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      });
      if (!response.ok) throw new Error(`Mining source unavailable (${response.status}).`);
      const data = await response.json();
      if (source.poi) return poiProviderToMiningSites(data);
      if (!Array.isArray(data)) throw new Error('Mining source returned invalid data.');
      return data;
    } catch (error) {
      warn(`Mining source unavailable: ${url}`, error);
    }
  }

  throw new Error('Unable to load mining database.');
}
