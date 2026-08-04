import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../../store/useStore'
import { scanCupAndHandle } from '../../lib/scannerCupHandle'
import { buildScanUniverse } from '../../lib/scannerUniverse'

const STAGE_LABEL = {
  near_breakout: { text: 'קרוב לפריצה', color: '#f59e0b' },
  broken_out:    { text: 'פרץ', color: '#10b981' },
  in_handle:     { text: 'בהידית', color: '#3b82f6' },
  cup_forming:   { text: 'גביע בגיבוש', color: '#8b5cf6' },
  developing:    { text: 'בפיתוח', color: '#6b7280' },
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v >= 100 ? v.toFixed(2) : v.toFixed(3)
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v.toFixed(1)
  return (v > 0 ? '+' : '') + s + '%'
}

// Cup & Handle scanner — modal experience so it doesn't require route wiring.
// The scan kicks off automatically on mount and streams progress via
// onProgress. Users pick a stage filter (defaulting to actionable set:
// near_breakout + broken_out) and get a ranked table they can click through
// to jump into the main analysis for a specific candidate.
export default function CupHandleScannerModal() {
  const showScanner       = useStore(s => s.showScanner)
  const setShowScanner    = useStore(s => s.setShowScanner)
  const setCurrentTicker  = useStore(s => s.setCurrentTicker)
  const watchlist         = useStore(s => s.watchlist)

  const [progress, setProgress]     = useState({ done: 0, total: 0, current: '' })
  const [candidates, setCandidates] = useState([])
  const [status, setStatus]         = useState('idle') // idle | scanning | done | error
  const [error, setError]           = useState(null)
  const [scanRun, setScanRun]       = useState(0)
  const [stageFilter, setStageFilter] = useState(new Set(['near_breakout', 'broken_out']))
  const [minQuality, setMinQuality]   = useState(0.35)
  const cancelledRef = useRef(false)

  const universe = useMemo(
    () => buildScanUniverse(watchlist.map(w => w.ticker)),
    [watchlist],
  )

  useEffect(() => {
    if (!showScanner) return
    cancelledRef.current = false
    setStatus('scanning')
    setCandidates([])
    setError(null)
    setProgress({ done: 0, total: universe.length, current: '' })
    scanCupAndHandle(universe, {
      stages: [...stageFilter, 'in_handle', 'cup_forming'], // fetch all, filter in UI
      minQuality: 0.25, // fetch loosely, tighten in UI
      onProgress: (done, total, ticker) => {
        if (cancelledRef.current) return
        setProgress({ done, total, current: ticker })
      },
    })
      .then(rows => {
        if (cancelledRef.current) return
        setCandidates(rows)
        setStatus('done')
      })
      .catch(err => {
        if (cancelledRef.current) return
        setError(err?.message || String(err))
        setStatus('error')
      })
    return () => { cancelledRef.current = true }
  }, [showScanner, scanRun, universe])

  if (!showScanner) return null

  const visible = candidates.filter(c =>
    stageFilter.has(c.stage) && c.quality >= minQuality,
  )

  const toggleStage = (s) => {
    setStageFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  const jumpTo = (ticker) => {
    setCurrentTicker(ticker)
    setShowScanner(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(3, 7, 18, 0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => setShowScanner(false)}
      dir="rtl"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111827', border: '1px solid #1f2937', borderRadius: 12,
          width: '100%', maxWidth: 980, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          color: '#e5e7eb',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #1f2937',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>סורק Cup & Handle</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              מזהה תבניות קאפ אנד הנדל תקפות עם פוטנציאל פריצה גבוה מתוך {universe.length} מניות
            </div>
          </div>
          <button
            onClick={() => setScanRun(value => value + 1)}
            disabled={status === 'scanning'}
            style={{
              background: status === 'scanning' ? '#1f2937' : '#0f766e',
              border: '1px solid #14b8a6', color: '#ecfeff', borderRadius: 8,
              padding: '6px 12px', cursor: status === 'scanning' ? 'not-allowed' : 'pointer',
              marginInlineStart: 'auto',
            }}
          >
            ↻ סריקה מחדש
          </button>
          <button
            onClick={() => setShowScanner(false)}
            style={{
              background: 'transparent', border: '1px solid #374151',
              color: '#e5e7eb', borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            }}
          >
            סגור
          </button>
        </div>

        {/* Controls / Progress */}
        <div style={{
          padding: '10px 18px', borderBottom: '1px solid #1f2937',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginInlineEnd: 8 }}>סנן שלב:</div>
          {['near_breakout', 'broken_out', 'in_handle', 'cup_forming'].map(s => {
            const active = stageFilter.has(s)
            const meta = STAGE_LABEL[s]
            return (
              <button
                key={s}
                onClick={() => toggleStage(s)}
                style={{
                  background: active ? meta.color : 'transparent',
                  color: active ? '#0b0f19' : meta.color,
                  border: `1px solid ${meta.color}`,
                  borderRadius: 999, padding: '4px 10px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {meta.text}
              </button>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#9ca3af' }}>איכות מינימלית</label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={minQuality}
              onChange={e => setMinQuality(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 12, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>
              {minQuality.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {status === 'scanning' && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #1f2937' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, color: '#9ca3af', marginBottom: 6,
            }}>
              <span>סורק {progress.current || '...'}</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div style={{ height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                transition: 'width 200ms',
              }} />
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {status === 'error' && (
            <div style={{ padding: 24, color: '#ef4444' }}>שגיאה: {error}</div>
          )}

          {status !== 'scanning' && visible.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              אין מועמדים תואמים במסננים הנוכחיים. נסה להוסיף שלבים או להוריד את סף האיכות.
            </div>
          )}

          {visible.length > 0 && (
            <div className="cup-scanner-results">
            <div className="cup-scanner-table-wrap">
            <table className="cup-scanner-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0b0f19', color: '#9ca3af', fontSize: 11 }}>
                  <th style={cellHead}>מניה</th>
                  <th style={cellHead}>מחיר</th>
                  <th style={cellHead}>שלב</th>
                  <th style={cellHead}>Pivot</th>
                  <th style={cellHead}>יעד</th>
                  <th style={cellHead}>Stop</th>
                  <th style={cellHead}>עליה ליעד</th>
                  <th style={cellHead}>מרחק לפיווט</th>
                  <th style={cellHead}>איכות</th>
                  <th style={cellHead}>Score</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(c => {
                  const stage = STAGE_LABEL[c.stage] || STAGE_LABEL.developing
                  return (
                    <tr
                      key={c.ticker}
                      onClick={() => jumpTo(c.ticker)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') jumpTo(c.ticker)
                      }}
                      style={{
                        cursor: 'pointer', borderTop: '1px solid #1f2937',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#0f172a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...cellBody, fontWeight: 700 }}>{c.ticker}</td>
                      <td style={cellBody}>${fmtPrice(c.currentPrice)}</td>
                      <td style={cellBody}>
                        <span style={{
                          background: stage.color + '33', color: stage.color,
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        }}>{stage.text}</span>
                      </td>
                      <td style={cellBody}>${fmtPrice(c.pivot)}</td>
                      <td style={cellBody}>${fmtPrice(c.target)}</td>
                      <td style={cellBody}>${fmtPrice(c.stopLoss)}</td>
                      <td style={{ ...cellBody, color: c.upsidePct > 0 ? '#10b981' : '#9ca3af' }}>
                        {fmtPct(c.upsidePct)}
                      </td>
                      <td style={cellBody}>{fmtPct(c.distanceToBreakoutPct * 100)}</td>
                      <td style={cellBody}>{(c.quality * 100).toFixed(0)}</td>
                      <td style={{ ...cellBody, fontWeight: 700, color: '#e5e7eb' }}>{c.opportunityScore}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            <div className="cup-scanner-cards">
              {visible.map(c => {
                const stage = STAGE_LABEL[c.stage] || STAGE_LABEL.developing
                return (
                  <button
                    key={`card-${c.ticker}`}
                    type="button"
                    onClick={() => jumpTo(c.ticker)}
                    className="cup-scanner-card"
                  >
                    <div className="cup-scanner-card__top">
                      <strong>{c.ticker}</strong>
                      <span style={{ color: stage.color }}>{stage.text}</span>
                    </div>
                    <div className="cup-scanner-card__price">${fmtPrice(c.currentPrice)}</div>
                    <div className="cup-scanner-card__grid">
                      <span>Pivot <b>${fmtPrice(c.pivot)}</b></span>
                      <span>Target <b>${fmtPrice(c.target)}</b></span>
                      <span>Stop <b>${fmtPrice(c.stopLoss)}</b></span>
                      <span>Upside <b className={c.upsidePct > 0 ? 'positive' : ''}>{fmtPct(c.upsidePct)}</b></span>
                    </div>
                    <div className="cup-scanner-card__meta">
                      <span>Quality {(c.quality * 100).toFixed(0)}</span>
                      <span>Score {c.opportunityScore}</span>
                      <span>{c.breakoutConfirmed ? 'Volume confirmed' : 'Needs volume'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px', borderTop: '1px solid #1f2937',
          fontSize: 11, color: '#6b7280',
        }}>
          לחיצה על שורה תטען את המניה לניתוח מלא. Score = איכות × 40 + עליה% × 2 + בונוס שלב − קנס מרחק לפיווט.
        </div>
      </div>
    </div>
  )
}

const cellHead = {
  padding: '10px 12px', textAlign: 'start', fontWeight: 600,
  letterSpacing: 0.3, textTransform: 'none',
}
const cellBody = { padding: '10px 12px', textAlign: 'start', fontVariantNumeric: 'tabular-nums' }
