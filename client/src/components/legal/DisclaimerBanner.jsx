import { useState } from 'react'
import { Info, X } from 'lucide-react'
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
    <div className="disclaimer-banner">
      <div className="disclaimer-banner__inner">
        <Info size={17} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <strong>{isHebrew ? 'כלי מידע ומחקר — לא ייעוץ השקעות.' : 'Research and information tool — not investment advice.'}</strong>
          <span>
            {isHebrew
              ? 'האותות והאינדיקטורים מוצגים למטרות מידע בלבד; האחריות להחלטות המסחר היא של המשתמש.'
              : 'Signals and indicators are informational only; users remain responsible for all trading decisions.'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="disclaimer-banner__close"
          aria-label={isHebrew ? 'סגירה' : 'Dismiss'}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
