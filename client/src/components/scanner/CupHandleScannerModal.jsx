import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../../store/useStore'

const POLL_INTERVAL_MS = 1_800

const STAGE_LABEL = {
  near_breakout: { text: 'קרוב לפריצה', color: '#f59e0b' },
  broken_out: { text: 'פרץ', color: '#10b981' },
  in_handle: { text: 'בהידית', color: '#3b82f6' },
  cup_forming: { text: 'גביע בגיבוש', color: '#8b5cf6' },
  developing: { text: 'בפיתוח', color: '#6b7280' },
}

const PHASE_LABEL = {
  queued: 'מכין את הסריקה',
  discovery: 'טוען ומאמת את חברות S&P 500',
  strength: 'מחשב חוזק יחסי ומגמה',
  structure: 'מחפש מבנה Cup במניות המדד החזקות',
  validation: 'מאמת OHLCV, נפח, Pivot וידית',
  done: 'הסריקה הושלמה',
  error: 'הסריקה נעצרה',
}

function fmtPrice(value) {
  if (!Number.isFinite(value)) return '—'
  return value >= 100 ? value.toFixed(2) : value.toFixed(3)
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function fmtSize(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`
  return `$${(value / 1_000_000_000).toFixed(1)}B`
}

function StatCard({ label, value, detail, tone = '#e2e8f0' }) {
  return (
    <div style={{
      minWidth: 132, flex: '1 1 132px', padding: '10px 12px', borderRadius: 10,
      border: '1px solid #273449', background: 'linear-gradient(145deg, #0b1220, #101a2c)',
    }}>
      <div style={{ color: '#7f8da3', fontSize: 10, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: tone, fontSize: 20, fontWeight: 800, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {detail && <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{detail}</div>}
    </div>
  )
}

function FilterChip({ active, color, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? color : 'transparent', color: active ? '#07111f' : color,
        border: `1px solid ${color}`, borderRadius: 999, padding: '5px 11px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/** S&P 500 Cup & Handle scanner backed by a shared server-side scan job. */
export default function CupHandleScannerModal() {
  const showScanner = useStore(state => state.showScanner)
  const setShowScanner = useStore(state => state.setShowScanner)
  const setCurrentTicker = useStore(state => state.setCurrentTicker)
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [scanRun, setScanRun] = useState(0)
  const [stageFilter, setStageFilter] = useState(new Set(['near_breakout', 'broken_out', 'in_handle']))
  const [minQuality, setMinQuality] = useState(0.25)
  const [minStrength, setMinStrength] = useState(55)
  const [resultLimit, setResultLimit] = useState(100)
  const lastStartedRunRef = useRef(0)
  const dialogRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    dialogRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') setShowScanner(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [setShowScanner])

  useEffect(() => {
    if (!showScanner) return undefined
    let disposed = false
    let pollTimer = null
    const controller = new AbortController()
    const force = scanRun > lastStartedRunRef.current
    lastStartedRunRef.current = scanRun

    const applyJob = nextJob => {
      if (disposed) return
      setJob(nextJob)
      setError(nextJob?.status === 'error' ? nextJob.error : null)
    }

    const poll = async jobId => {
      try {
        const response = await axios.get(`/api/scanner/cup-handle/${encodeURIComponent(jobId)}`, {
          signal: controller.signal,
          timeout: 15_000,
        })
        const nextJob = response.data
        applyJob(nextJob)
        if (!disposed && ['queued', 'running'].includes(nextJob.status)) {
          pollTimer = window.setTimeout(() => poll(jobId), POLL_INTERVAL_MS)
        }
      } catch (requestError) {
        if (disposed || requestError?.code === 'ERR_CANCELED') return
        setError(requestError?.response?.data?.error ?? requestError?.message ?? 'הסריקה אינה זמינה כרגע')
      }
    }

    const start = async () => {
      setError(null)
      setJob(previous => previous ? { ...previous, status: 'queued' } : null)
      try {
        const response = await axios.post('/api/scanner/cup-handle', {
          force,
          strengthThreshold: 55,
          minimumQuality: 0.2,
        }, {
          signal: controller.signal,
          timeout: 15_000,
        })
        applyJob(response.data)
        if (['queued', 'running'].includes(response.data.status)) pollTimer = window.setTimeout(() => poll(response.data.id), 500)
      } catch (requestError) {
        if (disposed || requestError?.code === 'ERR_CANCELED') return
        setError(requestError?.response?.data?.error ?? requestError?.message ?? 'לא ניתן להתחיל את הסריקה')
      }
    }

    void start()
    return () => {
      disposed = true
      controller.abort()
      if (pollTimer) window.clearTimeout(pollTimer)
    }
  }, [scanRun, showScanner])

  const candidates = job?.results ?? []
  const stageCounts = useMemo(() => candidates.reduce((counts, candidate) => {
    counts[candidate.stage] = (counts[candidate.stage] ?? 0) + 1
    return counts
  }, {}), [candidates])
  const filtered = useMemo(() => candidates.filter(candidate => (
    candidate.indexMembership === 'S&P 500' &&
    stageFilter.has(candidate.stage) &&
    candidate.quality >= minQuality &&
    candidate.strengthScore >= minStrength
  )), [candidates, minQuality, minStrength, stageFilter])
  const visible = filtered.slice(0, resultLimit)

  useEffect(() => {
    setResultLimit(100)
  }, [minQuality, minStrength, stageFilter])

  if (!showScanner) return null

  const scanning = ['queued', 'running'].includes(job?.status)
  const stats = job?.stats ?? {}
  const progress = job?.progress ?? { phase: 'queued', completed: 0, total: 1 }
  const progressPct = progress.total ? Math.min(100, (progress.completed / progress.total) * 100) : 0

  const toggleStage = stage => {
    setStageFilter(previous => {
      const next = new Set(previous)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  const jumpTo = ticker => {
    setCurrentTicker(ticker)
    setShowScanner(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200, padding: 12,
        background: 'rgba(2, 6, 18, 0.82)', backdropFilter: 'blur(7px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => setShowScanner(false)}
      dir="rtl"
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="סורק Cup and Handle למניות S&P 500"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1180, maxHeight: '92vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', color: '#e5e7eb',
          border: '1px solid #2a3950', borderRadius: 16,
          background: 'radial-gradient(circle at top right, rgba(14, 116, 144, 0.16), transparent 34%), #0c1423',
          boxShadow: '0 24px 80px rgba(0,0,0,0.48)',
        }}
      >
        <header style={{ padding: '16px 18px', borderBottom: '1px solid #233149', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 19, fontWeight: 850, margin: 0 }}>סורק Cup & Handle למניות S&P 500</h2>
              <span style={{ border: '1px solid #0891b2', color: '#67e8f9', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800 }}>
                חברות המדד בלבד · ללא ETF וללא מניות מחוץ למדד
              </span>
              {job?.cached && <span style={{ color: '#94a3b8', fontSize: 10 }}>תוצאה שמורה מהסריקה האחרונה</span>}
            </div>
            <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>
              הרשימה מאומתת מול constituents עדכניים, לאחר מכן מחושבים חוזק יחסי, מבנה Cup ואימות OHLCV יומי מלא.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScanRun(value => value + 1)}
            disabled={scanning}
            style={{
              background: scanning ? '#1e293b' : '#0f766e', border: '1px solid #14b8a6',
              color: '#ecfeff', borderRadius: 9, padding: '8px 13px', fontWeight: 750,
              cursor: scanning ? 'not-allowed' : 'pointer',
            }}
          >
            {scanning ? 'הסריקה פועלת…' : '↻ סריקה חדשה'}
          </button>
          <button
            type="button"
            onClick={() => setShowScanner(false)}
            style={{ background: '#111c2e', border: '1px solid #3a475b', color: '#e5e7eb', borderRadius: 9, padding: '8px 13px', cursor: 'pointer' }}
          >
            סגור
          </button>
        </header>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid #233149' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatCard label="חברי S&P 500 שנטענו" value={(stats.indexConstituents ?? 0).toLocaleString()} detail={`${stats.marketDataMatched ?? 0} הוצלבו עם Nasdaq`} />
            <StatCard label="מניות חזקות במדד" value={(stats.strongAssets ?? 0).toLocaleString()} detail={`Strength ${stats.strengthThreshold ?? 55}+`} tone="#67e8f9" />
            <StatCard label="פרצו מאושר" value={(stageCounts.broken_out ?? 0).toLocaleString()} detail="סגירה מעל Pivot + נפח 1.2x" tone="#6ee7b7" />
            <StatCard label="מבני Cup ב־pre-scan" value={(stats.preScanMatches ?? 0).toLocaleString()} detail="סריקת close לכל היקום החזק" tone="#c4b5fd" />
            <StatCard label="אימות OHLCV" value={`${stats.validatedAssets ?? 0}/${stats.validationPool ?? 0}`} detail={`${stats.validationFailed ?? 0} כשלים ממקור הנתונים`} tone="#fbbf24" />
            <StatCard label="תבניות מאומתות" value={(stats.matches ?? candidates.length).toLocaleString()} detail={`${filtered.length} תואמות למסננים`} tone="#6ee7b7" />
          </div>
        </div>

        <div style={{ padding: '11px 18px', borderBottom: '1px solid #233149', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#7f8da3', fontSize: 11 }}>שלב</span>
            {['near_breakout', 'broken_out', 'in_handle', 'cup_forming'].map(stage => (
              <FilterChip key={stage} active={stageFilter.has(stage)} color={STAGE_LABEL[stage].color} onClick={() => toggleStage(stage)}>
                {STAGE_LABEL[stage].text}
              </FilterChip>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#94a3b8', fontSize: 11 }}>
            איכות {(minQuality * 100).toFixed(0)}+
            <input type="range" min="0.15" max="0.8" step="0.05" value={minQuality} onChange={event => setMinQuality(Number(event.target.value))} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#94a3b8', fontSize: 11 }}>
            חוזק {minStrength}+
            <input type="range" min="40" max="90" step="5" value={minStrength} onChange={event => setMinStrength(Number(event.target.value))} />
          </label>
        </div>

        {!scanning && job?.status === 'done' && (
          <div
            role="status"
            style={{
              margin: '10px 18px 0', padding: '9px 12px', borderRadius: 9,
              border: `1px solid ${(stageCounts.broken_out ?? 0) > 0 ? '#166534' : '#854d0e'}`,
              background: (stageCounts.broken_out ?? 0) > 0 ? 'rgba(22,101,52,0.16)' : 'rgba(133,77,14,0.14)',
              color: (stageCounts.broken_out ?? 0) > 0 ? '#bbf7d0' : '#fde68a',
              fontSize: 11, lineHeight: 1.5,
            }}
          >
            {(stageCounts.broken_out ?? 0) > 0
              ? `נמצאו ${stageCounts.broken_out} מניות עם פריצה מאושרת.`
              : `אין כרגע פריצה מאושרת בסריקה. נמצאו ${stageCounts.near_breakout ?? 0} קרובות לפריצה ו־${stageCounts.in_handle ?? 0} בהידית. אישור דורש סגירת נר יומי מעל ה־Pivot ב־0.5% לפחות ומחזור של 1.2x מממוצע 20 הימים.`}
          </div>
        )}

        {scanning && (
          <div style={{ padding: '11px 18px', borderBottom: '1px solid #233149' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#a8b3c5', fontSize: 11, marginBottom: 7 }}>
              <span><b style={{ color: '#e2e8f0' }}>{PHASE_LABEL[progress.phase] ?? progress.phase}</b> · {progress.message}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{progress.completed.toLocaleString()} / {progress.total.toLocaleString()}</span>
            </div>
            <div style={{ height: 6, background: '#1d293c', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #06b6d4, #10b981)', transition: 'width 240ms ease' }} />
            </div>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 210 }}>
          {error && <div role="alert" style={{ margin: 18, padding: 14, border: '1px solid #7f1d1d', borderRadius: 10, color: '#fecaca', background: 'rgba(127,29,29,0.18)' }}>שגיאה: {error}</div>}
          {!error && !scanning && visible.length === 0 && (
            <div style={{ padding: 38, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              הסריקה הסתיימה ללא מועמדים במסננים הנוכחיים. נסה להציג גם "גביע בגיבוש" או להוריד מעט את סף האיכות.
            </div>
          )}
          {!error && scanning && visible.length === 0 && (
            <div style={{ padding: 34, textAlign: 'center', color: '#7f8da3', fontSize: 12 }}>
              מועמדים יופיעו כאן בזמן שלב האימות. אין צורך להשאיר את החלון פתוח כדי שה־job ימשיך בשרת.
            </div>
          )}

          {visible.length > 0 && (
            <div className="cup-scanner-results">
              <div className="cup-scanner-table-wrap">
                <table className="cup-scanner-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#080f1c', color: '#8290a5', fontSize: 10, position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={cellHead}>מניה</th><th style={cellHead}>מדד / שווי שוק</th><th style={cellHead}>שלב</th>
                      <th style={cellHead}>מחיר</th><th style={cellHead}>Pivot</th><th style={cellHead}>יעד</th>
                      <th style={cellHead}>Stop</th><th style={cellHead}>Upside</th><th style={cellHead}>חוזק</th>
                      <th style={cellHead}>איכות</th><th style={cellHead}>Score</th><th style={cellHead}>Micha</th><th style={cellHead}>Setup</th><th style={cellHead}>סיכון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(candidate => {
                      const stage = STAGE_LABEL[candidate.stage] ?? STAGE_LABEL.developing
                      return (
                        <tr
                          key={candidate.ticker}
                          onClick={() => jumpTo(candidate.ticker)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') jumpTo(candidate.ticker) }}
                          style={{ cursor: 'pointer', borderTop: '1px solid #1c293b' }}
                          onMouseEnter={event => { event.currentTarget.style.background = '#111d30' }}
                          onMouseLeave={event => { event.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={cellBody}><strong style={{ color: '#f8fafc', fontSize: 13 }}>{candidate.indexSymbol ?? candidate.ticker}</strong><div style={subText}>{candidate.name}</div></td>
                          <td style={cellBody}>S&P 500<div style={subText}>Market Cap {fmtSize(candidate.sizeValue)}</div></td>
                          <td style={cellBody}><span style={{ color: stage.color, background: `${stage.color}1f`, borderRadius: 999, padding: '3px 7px', whiteSpace: 'nowrap' }}>{stage.text}</span></td>
                          <td style={cellBody}>${fmtPrice(candidate.currentPrice)}</td>
                          <td style={cellBody}>${fmtPrice(candidate.pivot)}</td>
                          <td style={cellBody}>${fmtPrice(candidate.target)}</td>
                          <td style={{ ...cellBody, color: '#fca5a5' }}>${fmtPrice(candidate.stopLoss)}</td>
                          <td style={{ ...cellBody, color: candidate.upsidePct > 0 ? '#6ee7b7' : '#94a3b8' }}>{fmtPct(candidate.upsidePct)}</td>
                          <td style={cellBody}>{candidate.strengthScore}<div style={subText}>6M {fmtPct(candidate.return6mPct)}</div></td>
                          <td style={cellBody}>{(candidate.quality * 100).toFixed(0)}</td>
                          <td style={{ ...cellBody, fontWeight: 850, color: '#67e8f9' }}>{candidate.opportunityScore}</td>
                          <td style={{ ...cellBody, color: '#a5f3fc', fontWeight: 800 }}>{candidate.technicalMethodScore ?? '-'}</td>
                          <td style={cellBody}>{candidate.setupType?.replaceAll('_', ' ') ?? '-'}</td>
                          <td style={{ ...cellBody, color: candidate.riskLevel === 'high' ? '#fca5a5' : '#cbd5e1' }}>{candidate.riskLevel ?? '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cup-scanner-cards">
                {visible.map(candidate => {
                  const stage = STAGE_LABEL[candidate.stage] ?? STAGE_LABEL.developing
                  return (
                    <button key={`card-${candidate.ticker}`} type="button" onClick={() => jumpTo(candidate.ticker)} className="cup-scanner-card">
                      <div className="cup-scanner-card__top"><strong>{candidate.indexSymbol ?? candidate.ticker}</strong><span style={{ color: stage.color }}>{stage.text}</span></div>
                      <div style={{ color: '#7f8da3', fontSize: 10, textAlign: 'start' }}>S&P 500 · Market Cap {fmtSize(candidate.sizeValue)}</div>
                      <div className="cup-scanner-card__price">${fmtPrice(candidate.currentPrice)}</div>
                      <div className="cup-scanner-card__grid">
                        <span>Pivot <b>${fmtPrice(candidate.pivot)}</b></span><span>Target <b>${fmtPrice(candidate.target)}</b></span>
                        <span>Stop <b>${fmtPrice(candidate.stopLoss)}</b></span><span>Upside <b className={candidate.upsidePct > 0 ? 'positive' : ''}>{fmtPct(candidate.upsidePct)}</b></span>
                      </div>
                      <div className="cup-scanner-card__meta"><span>Strength {candidate.strengthScore}</span><span>Quality {(candidate.quality * 100).toFixed(0)}</span><span>Micha {candidate.technicalMethodScore ?? '-'}</span><span>{candidate.setupType?.replaceAll('_', ' ') ?? '-'}</span></div>
                    </button>
                  )
                })}
              </div>
              {visible.length < filtered.length && (
                <div style={{ padding: '14px 18px 18px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setResultLimit(limit => limit + 100)}
                    style={{
                      border: '1px solid #0891b2', borderRadius: 9, background: '#0e2235',
                      color: '#a5f3fc', padding: '8px 18px', fontWeight: 750, cursor: 'pointer',
                    }}
                  >
                    הצג עוד · מוצגות {visible.length} מתוך {filtered.length}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <footer style={{ padding: '10px 18px', borderTop: '1px solid #233149', color: '#6f7e94', fontSize: 10, lineHeight: 1.5 }}>
          מקורות: רשימת constituents מתעדכנת של S&P 500 לקביעת החברות במדד; Nasdaq למטא־דאטה ושווי שוק; Yahoo Finance לחוזק ולהיסטוריית מחיר. אם הרשימה אינה ניתנת לאימות, הסריקה נעצרת ואינה עוברת ליקום רחב. ציון החוזק 0–100 אינו הסתברות.
        </footer>
      </section>
    </div>
  )
}

const cellHead = { padding: '10px 9px', textAlign: 'start', fontWeight: 700, whiteSpace: 'nowrap' }
const cellBody = { padding: '10px 9px', textAlign: 'start', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const subText = { color: '#64748b', fontSize: 9, marginTop: 2, maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis' }
