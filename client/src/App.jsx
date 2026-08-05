import { lazy, Suspense } from 'react'
import useStore from './store/useStore'

const SimpleApp = lazy(() => import('./simple/SimpleApp'))
const AdvancedApp = lazy(() => import('./AdvancedApp'))
const CupHandleScannerModal = lazy(() => import('./components/scanner/CupHandleScannerModal'))

function AppLoadingShell() {
  return (
    <div className="app-loading-shell" role="status" aria-live="polite">
      <div className="app-loading-shell__brand">
        <span aria-hidden="true" />
        <strong>STOCK SENSE</strong>
      </div>
      <h1>ניתוח מניה ברור, לפני שמקבלים החלטה.</h1>
      <p>טוען את סביבת הניתוח...</p>
    </div>
  )
}

export default function App() {
  const { simpleMode, showScanner } = useStore()
  return (
    <>
      <Suspense fallback={<AppLoadingShell />}>
        {simpleMode ? <SimpleApp /> : <AdvancedApp />}
      </Suspense>
      {showScanner && (
        <Suspense fallback={null}>
          <CupHandleScannerModal />
        </Suspense>
      )}
    </>
  )
}
