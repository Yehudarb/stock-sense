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
  const [activeTab, setActiveTab] = useState('context')
  const isHebrew = language === 'he'

  const tabs = [
    { id: 'context', label: isHebrew ? 'הקשר שוק' : 'Context' },
    { id: 'forecast', label: isHebrew ? 'תחזית' : 'Forecast' },
    { id: 'trends', label: isHebrew ? 'מגמות' : 'Trends' },
    { id: 'signals', label: isHebrew ? 'איתותים' : 'Signals' },
    { id: 'earnings', label: isHebrew ? 'דוחות' : 'Earnings' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Tab Switcher */}
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

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'context' && (
          <MarketContextPanel 
            marketContext={marketContext} 
            isLoading={isLoadingMarket} 
            language={language} 
          />
        )}
        {activeTab === 'forecast' && (
          <ForecastOpinionPanel 
            forecast={forecast} 
            isLoading={isLoadingForecast} 
            language={language} 
          />
        )}
        {activeTab === 'trends' && (
          <AdvancedTrendsPanel 
            trends={trends} 
            language={language} 
          />
        )}
        {activeTab === 'signals' && (
          <SignalPanel 
            signal={signal} 
            language={language} 
          />
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
