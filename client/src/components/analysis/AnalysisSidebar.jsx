import { useState } from 'react'
import MarketContextPanel from './MarketContextPanel'
import EarningsPanel from './EarningsPanel'
import AdvancedTrendsPanel from './AdvancedTrendsPanel'
import SignalPanel from './SignalPanel'
import ForecastOpinionPanel from './ForecastOpinionPanel'

export default function AnalysisSidebar({
  forecast,
  marketContext,
  earnings,
  trends,
  signal,
  isLoadingForecast,
  isLoadingMarket,
  isLoadingEarnings,
  language = 'he'
}) {
  const [activeTab, setActiveTab] = useState('signals')
  const isHebrew = language === 'he'

  const tabs = [
    { id: 'signals', label: isHebrew ? 'מה חשוב' : 'What Matters' },
    { id: 'context', label: isHebrew ? 'הקשר' : 'Context' },
    { id: 'earnings', label: isHebrew ? 'אירועים' : 'Events' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
        {isHebrew
          ? 'מיקדנו את האזור הזה לשלושה חלקים: מה לעשות עכשיו, מה ההקשר, ואילו אירועים קרובים יכולים להשפיע.'
          : 'This area is trimmed to three views: what matters now, the broader context, and nearby events.'}
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-900/50 border border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="transition-all duration-300">
        {activeTab === 'signals' && (
          <SignalPanel 
            signal={signal} 
            language={language} 
          />
        )}
        {activeTab === 'context' && (
          <div className="space-y-4">
            <MarketContextPanel 
              marketContext={marketContext} 
              isLoading={isLoadingMarket} 
              language={language} 
            />
            <AdvancedTrendsPanel 
              trends={trends} 
              language={language} 
            />
            <ForecastOpinionPanel 
              forecast={forecast} 
              isLoading={isLoadingForecast} 
              language={language} 
            />
          </div>
        )}
        {activeTab === 'earnings' && (
          <EarningsPanel 
            earnings={earnings} 
            isLoading={isLoadingEarnings} 
            language={language} 
          />
        )}
      </div>
    </div>
  )
}
