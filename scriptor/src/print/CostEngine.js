const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

const TABLES = {
  kdp: {
    validFrom: '2026-04-01',
    markets: {
      FR: { fixed: 0.85, perPageBw: 0.0125, perPageColor: 0.065 },
      US: { fixed: 0.85, perPageBw: 0.012, perPageColor: 0.064 },
      UK: { fixed: 0.85, perPageBw: 0.0118, perPageColor: 0.063 },
    },
  },
  ingramspark: {
    validFrom: '2026-04-01',
    markets: {
      FR: { fixed: 1.6, perPageBw: 0.016, perPageColor: 0.082 },
      US: { fixed: 1.55, perPageBw: 0.0155, perPageColor: 0.081 },
      UK: { fixed: 1.5, perPageBw: 0.015, perPageColor: 0.079 },
    },
  },
}

function outdated(validFrom) {
  const t = new Date(validFrom).getTime()
  return Date.now() - t > SIX_MONTHS_MS
}

export function estimatePrintCost({
  platform = 'kdp',
  market = 'FR',
  distribution = 'standard',
  pageCount = 0,
  coverType = 'soft',
  color = false,
}) {
  const pf = TABLES[platform] || TABLES.kdp
  const row = pf.markets[market] || pf.markets.FR
  const per = color ? row.perPageColor : row.perPageBw
  const distroMul = distribution === 'expanded' ? 1.1 : 1
  const coverMul = coverType === 'hard' ? 1.22 : 1
  const base = (row.fixed + per * Math.max(0, pageCount)) * distroMul * coverMul
  const rounded = Math.round(base * 100) / 100
  const isOutdated = outdated(pf.validFrom)
  return {
    price: rounded,
    currency: market === 'US' ? 'USD' : market === 'UK' ? 'GBP' : 'EUR',
    validFrom: pf.validFrom,
    outdated: isOutdated,
    mode: isOutdated ? 'estimation approximative' : 'table tarifaire',
  }
}

