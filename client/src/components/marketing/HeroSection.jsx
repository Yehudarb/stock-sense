import { useEffect, useState } from 'react'
import { ChartNoAxesCombined, Database, Loader2, Search, ShieldCheck, Target } from 'lucide-react'
import useStore from '../../store/useStore'
import Button from '../ui/Button'
import Input from '../ui/Input'

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY']

export default function HeroSection({
  currentTicker,
  isLoading,
  onAnalyze,
  onPickTicker,
  lastLoadedTicker,
}) {
  const [value, setValue] = useState(currentTicker ?? '')
  const [inlineError, setInlineError] = useState('')
  const { language } = useStore()
  const isHebrew = language === 'he'

  const copy = {
    eyebrow: isHebrew ? 'סביבת מחקר וקבלת החלטות' : 'Research and decision workspace',
    title: isHebrew ? 'ניתוח מניה ברור, לפני שמקבלים החלטה.' : 'Clear stock analysis before making a decision.',
    subtitle: isHebrew
      ? 'בחרו סימול וקבלו מסקנה, גרף, רמות סיכון והסבר המבוססים על מנוע כללים דטרמיניסטי.'
      : 'Choose a symbol and get a conclusion, chart, risk levels, and an explanation from a deterministic rules engine.',
    inputLabel: isHebrew ? 'סימול מניה או קרן' : 'Stock or ETF symbol',
    placeholder: isHebrew ? 'לדוגמה: TSLA, AAPL או SPY' : 'For example: TSLA, AAPL, or SPY',
    analyze: isHebrew ? 'נתחו מניה' : 'Analyze stock',
    analyzing: isHebrew ? 'מכין ניתוח...' : 'Preparing analysis...',
    popular: isHebrew ? 'התחלה מהירה' : 'Quick start',
    invalidEmpty: isHebrew ? 'יש להזין סימול כמו AAPL או NVDA.' : 'Enter a symbol such as AAPL or NVDA.',
    invalidSymbol: isHebrew ? 'הזינו סימול שוק תקין בלבד, לדוגמה AAPL, SPY או ^VIX.' : 'Use a valid market symbol, for example AAPL, SPY, or ^VIX.',
    panelTitle: isHebrew ? 'מה תקבלו בניתוח' : 'What the analysis includes',
    panelSubtitle: isHebrew ? 'מהמחיר הנוכחי ועד לתוכנית סיכון ברורה.' : 'From current price to a clear risk plan.',
    outcomes: [
      [ChartNoAxesCombined, isHebrew ? 'מגמה ומבנה מחיר' : 'Trend and price structure', isHebrew ? 'נרות, ממוצעים, מומנטום ורמות מפתח.' : 'Candles, averages, momentum, and key levels.'],
      [ShieldCheck, isHebrew ? 'סיכון לפני פעולה' : 'Risk before action', isHebrew ? 'Stop אפשרי, ביטול תרחיש ויחס סיכון/תשואה.' : 'Possible stop, invalidation, and risk/reward.'],
      [Target, isHebrew ? 'מסקנה שניתנת לבדיקה' : 'A verifiable conclusion', isHebrew ? 'ציון כללים, סיבות ותנאי לשינוי המסקנה.' : 'Rule score, reasons, and a condition for reassessment.'],
    ],
  }

  useEffect(() => {
    setValue(currentTicker ?? '')
  }, [currentTicker])

  function handleSubmit(event) {
    event.preventDefault()
    const normalized = value.trim().toUpperCase()

    if (!normalized) {
      setInlineError(copy.invalidEmpty)
      return
    }

    if (!/^[A-Z.^-]{1,12}$/.test(normalized)) {
      setInlineError(copy.invalidSymbol)
      return
    }

    setInlineError('')
    onAnalyze(normalized)
  }

  return (
    <section className="empty-workspace">
      <div className="empty-workspace__content">
        <div className="empty-workspace__eyebrow">
          <Database size={15} strokeWidth={1.8} aria-hidden="true" />
          {copy.eyebrow}
        </div>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>

        <form className="empty-search" onSubmit={handleSubmit}>
          <div className="empty-search__field">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <Input
              aria-label={copy.inputLabel}
              placeholder={copy.placeholder}
              value={value}
              disabled={isLoading}
              onChange={event => setValue(event.target.value.toUpperCase())}
            />
          </div>
          <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
            {isLoading ? copy.analyzing : copy.analyze}
          </Button>
        </form>

        {inlineError && <div className="empty-search__error" role="alert">{inlineError}</div>}

        <div className="empty-quick-start">
          <span>{copy.popular}</span>
          {POPULAR_TICKERS.map(ticker => (
            <button
              key={ticker}
              type="button"
              onClick={() => {
                setValue(ticker)
                setInlineError('')
                onPickTicker(ticker)
              }}
            >
              {ticker}
            </button>
          ))}
          {lastLoadedTicker && !POPULAR_TICKERS.includes(lastLoadedTicker) && (
            <button type="button" onClick={() => onPickTicker(lastLoadedTicker)}>{lastLoadedTicker}</button>
          )}
        </div>
      </div>

      <aside className="empty-workspace__preview">
        <div className="empty-preview__header">
          <span className="empty-preview__mark"><ChartNoAxesCombined size={21} aria-hidden="true" /></span>
          <span>
            <strong>{copy.panelTitle}</strong>
            <small>{copy.panelSubtitle}</small>
          </span>
        </div>
        <div className="empty-preview__outcomes">
          {copy.outcomes.map(([Icon, title, description]) => (
            <div key={title}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="empty-preview__flow" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </aside>
    </section>
  )
}
