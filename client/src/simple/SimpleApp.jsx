import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import useTicker from '../hooks/useTicker'
import useIndicators from '../hooks/useIndicators'
import useSignal from '../hooks/useSignal'
import useSocket from '../hooks/useSocket'
import usePaperTrading from '../hooks/usePaperTrading'
import Layout from '../components/layout/Layout'
import LoadingState from '../components/ui/LoadingState'
import DisclaimerBanner from '../components/legal/DisclaimerBanner'
import useSimpleSignal from './hooks/useSimpleSignal'
import useGoalTracking from './hooks/useGoalTracking'
import DashboardScreen from './screens/DashboardScreen'
import TradeSetupScreen from './screens/TradeSetupScreen'
import PositionTrackerScreen from './screens/PositionTrackerScreen'

const TICKER = 'TSLL'

export default function SimpleApp() {
  const { currentTicker, ohlcv, snapshot, language, setCurrentTicker } = useStore()
  const [screen, setScreen] = useState('dashboard')

  useEffect(() => {
    if (currentTicker !== TICKER) setCurrentTicker(TICKER)
  }, [currentTicker, setCurrentTicker])

  useTicker()
  const indicators = useIndicators(ohlcv)
  const signal = useSignal(ohlcv, indicators, language)
  const { isConnected } = useSocket()
  const paperTrading = usePaperTrading(`${TICKER}-${snapshot?.price ?? 'na'}`)
  const simpleSignal = useSimpleSignal(signal)
  const goalTracking = useGoalTracking(paperTrading.account, paperTrading.setAccount)

  const openPosition = paperTrading.account?.openPositions?.find(position => position.ticker === TICKER)

  useEffect(() => {
    if (openPosition && screen === 'trade-setup') setScreen('position')
    if (!openPosition && screen === 'position') setScreen('dashboard')
  }, [openPosition, screen])

  const isReady = currentTicker === TICKER && snapshot && signal

  return (
    <Layout isConnected={isConnected}>
      <DisclaimerBanner />

      {!isReady && (
        <LoadingState
          title={language === 'he' ? 'טוען את הסיגנל עבור TSLL' : 'Loading the TSLL signal'}
          subtitle={language === 'he' ? 'רק רגע...' : 'One moment...'}
          steps={[]}
        />
      )}

      {isReady && screen === 'dashboard' && (
        <DashboardScreen
          price={snapshot.price}
          simpleSignal={simpleSignal}
          account={paperTrading.account}
          goal={goalTracking.goal}
          taxShield={goalTracking.taxShield}
          language={language}
          hasOpenPosition={Boolean(openPosition)}
          onOpenTradeSetup={() => setScreen('trade-setup')}
          onOpenPosition={() => setScreen('position')}
        />
      )}

      {isReady && screen === 'trade-setup' && (
        <TradeSetupScreen
          decision={simpleSignal.decision}
          account={paperTrading.account}
          language={language}
          onBack={() => setScreen('dashboard')}
          onEnterTrade={async (payload) => {
            await paperTrading.createOrder(payload)
            setScreen('position')
          }}
        />
      )}

      {isReady && screen === 'position' && openPosition && (
        <PositionTrackerScreen
          position={openPosition}
          decision={simpleSignal.decision}
          closedTrades={paperTrading.account?.closedTrades?.filter(trade => trade.ticker === TICKER) ?? []}
          language={language}
          onBack={() => setScreen('dashboard')}
          onClosePosition={async (id, exitPrice) => {
            await paperTrading.closePosition(id, exitPrice)
            setScreen('dashboard')
          }}
        />
      )}
    </Layout>
  )
}
