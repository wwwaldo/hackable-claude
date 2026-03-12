import { FactCache } from '../factcache'

interface TokenBarProps {
  cache: FactCache
  apiTokens?: number   // real count from API if available
}

export function TokenBar({ cache, apiTokens }: TokenBarProps) {
  const cats = cache.categoryTotals()
  const used = apiTokens ?? cache.totalTokens
  const max  = cache.maxTokens
  const pct  = Math.min((used / max) * 100, 100)

  const usedFmt = used.toLocaleString()
  const maxFmt  = max.toLocaleString()
  const remFmt  = Math.max(0, max - used).toLocaleString()

  const warningColor = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--accent2)' : 'var(--accent)'

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '8px 16px',
      background: 'var(--surface)',
      flexShrink: 0,
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', color: 'var(--text2)', textTransform: 'uppercase' }}>
          Context Window
        </span>
        <span style={{ fontSize: 11, color: warningColor }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{usedFmt}</span>
          <span style={{ color: 'var(--text2)' }}> / {maxFmt} </span>
          <span style={{ color: 'var(--text2)', fontSize: 10 }}>({pct.toFixed(1)}%)</span>
          {apiTokens && (
            <span style={{ color: 'var(--accent)', fontSize: 9, marginLeft: 8 }}>● API</span>
          )}
        </span>
      </div>

      {/* Segmented bar */}
      <div style={{
        height: 10,
        background: 'var(--bg)',
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid var(--border2)',
      }}>
        {cats.map(({ category, pct: catPct, color }) => (
          <div
            key={category}
            title={`${category}: ${catPct.toFixed(1)}%`}
            style={{
              width: `${catPct}%`,
              background: color,
              opacity: 0.85,
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
              position: 'relative',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {cats.map(({ category, tokens, color }) => (
          <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 1, background: color, flexShrink: 0 }} />
            <span>{category}</span>
            <span style={{ color }}>{tokens.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text2)' }}>
          {remFmt} free
        </div>
      </div>
    </div>
  )
}
