import { useState } from 'react'
import useStore from '../../store/useStore'

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { language } = useStore()
  const isHebrew = language === 'he'

  if (dismissed) return null

  return (
    <div className="rounded-2xl border border-amber-900/50 bg-amber-950/45 px-4 py-3 text-xs text-amber-100">
      <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-3">
        <div className="leading-5">
          <strong>{isHebrew ? 'הערה משפטית:' : 'Disclaimer:'}</strong>{' '}
          {isHebrew
            ? 'זה כלי ניתוח חינוכי ומידעי בלבד, ולא ייעוץ פיננסי. כל האותות, התבניות והאינדיקטורים ניתנים למטרות מידע בלבד. האחריות על החלטות המסחר היא של המשתמש בלבד.'
            : 'This is an educational and informational analysis tool, not financial advice. All signals, patterns, and indicators are provided for information only. Users remain fully responsible for their trading decisions.'}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-400 transition-colors hover:text-amber-200"
          aria-label={isHebrew ? 'סגירה' : 'Dismiss'}
        >
          ×
        </button>
      </div>
    </div>
  )
}
