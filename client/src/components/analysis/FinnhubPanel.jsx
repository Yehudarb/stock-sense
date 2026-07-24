import { useFinnhubNews, useFinnhubProfile } from '../../hooks/useFinnhub'
import { TRADER_TEXT } from '../../lib/traderColors'

export default function FinnhubPanel({ ticker, language }) {
  const { profile, loading: profileLoading } = useFinnhubProfile(ticker)
  const { news, loading: newsLoading } = useFinnhubNews(ticker, 5)
  const isHebrew = language === 'he'

  if (profileLoading || newsLoading) {
    return (
      <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
        <div className="animate-pulse text-sm text-slate-400">
          {isHebrew ? '📊 טוען נתונים מ-Finnhub...' : '📊 Loading Finnhub data...'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Company Profile */}
      {profile && (
        <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
          <div className="flex items-start gap-4">
            {profile.logo && (
              <img
                src={profile.logo}
                alt={profile.name}
                className="h-12 w-12 rounded-lg object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{profile.name}</h3>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">
                    {isHebrew ? 'בורסה' : 'Exchange'}
                  </div>
                  <div className="font-semibold text-slate-300">{profile.exchange || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {isHebrew ? 'תעשייה' : 'Industry'}
                  </div>
                  <div className="font-semibold text-slate-300">{profile.industry || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {isHebrew ? 'IPO' : 'IPO'}
                  </div>
                  <div className="font-semibold text-slate-300">{profile.ipo || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {isHebrew ? 'ערך שוק' : 'Market Cap'}
                  </div>
                  <div className="font-semibold text-slate-300">
                    {profile.marketCap ? `$${(profile.marketCap / 1e9).toFixed(1)}B` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest News */}
      {news && news.length > 0 && (
        <div className="rounded-2xl border border-white/6 bg-slate-950/35 p-6">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-300">
            📰 {isHebrew ? 'חדשות אחרונות' : 'Latest News'}
          </h3>

          <div className="space-y-3">
            {news.slice(0, 5).map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-slate-900/50 p-3 transition-colors hover:bg-slate-800/50"
              >
                <div className="font-semibold text-white hover:text-primary">
                  {item.headline}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.source} • {new Date(item.datetime).toLocaleDateString()}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
