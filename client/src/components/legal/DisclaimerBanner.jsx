import { useState } from 'react'
import useStore from '../../store/useStore'

const STORAGE_KEY = 'stocksense.disclaimerDismissed'

// localStorage throws rather than returning null in private mode and in some
// embedded webviews, so both sides are guarded. Failing to remember is fine --
// the banner simply shows again -- but throwing would take the page down.
function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* not remembering the dismissal is the acceptable failure here */
  }
}

export default function DisclaimerBanner() {
  // Dismissal used to reset on every reload, so the button did nothing that
  // outlasted the session and the banner re-took the top of the page each
  // visit. The disclosure itself is unaffected: LegalFooter carries the same
  // notice on every page and cannot be dismissed.
  const [dismissed, setDismissed] = useState(readDismissed)
  const { language } = useStore()
  const isHebrew = language === 'he'

  function handleDismiss() {
    setDismissed(true)
    persistDismissed()
  }

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
          onClick={handleDismiss}
          className="shrink-0 text-amber-400 transition-colors hover:text-amber-200"
          aria-label={isHebrew ? 'סגירה' : 'Dismiss'}
        >
          ×
        </button>
      </div>
    </div>
  )
}
