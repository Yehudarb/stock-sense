import useStore from './store/useStore'
import SimpleApp from './simple/SimpleApp'
import AdvancedApp from './AdvancedApp'
import CupHandleScannerModal from './components/scanner/CupHandleScannerModal'

export default function App() {
  const { simpleMode } = useStore()
  return (
    <>
      {simpleMode ? <SimpleApp /> : <AdvancedApp />}
      {/* Scanner modal renders alongside either app so the header button
          works in both modes. Its own store flag controls visibility. */}
      <CupHandleScannerModal />
    </>
  )
}
