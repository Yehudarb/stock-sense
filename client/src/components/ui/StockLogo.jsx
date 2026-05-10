import { useState } from 'react'

const LOGO_DOMAINS = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  AMZN: 'amazon.com',
  TSLA: 'tesla.com',
  META: 'meta.com',
  NVDA: 'nvidia.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  INTC: 'intel.com',
  IBM: 'ibm.com',
  ORCL: 'oracle.com',
  CRM: 'salesforce.com',
  ADBE: 'adobe.com',
  PYPL: 'paypal.com',
  SHOP: 'shopify.com',
  UBER: 'uber.com',
  ABNB: 'airbnb.com',
  COIN: 'coinbase.com',
  SQ: 'block.xyz',
  PLTR: 'palantir.com',
  SNOW: 'snowflake.com',
  NET: 'cloudflare.com',
  DDOG: 'datadoghq.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  GS: 'goldmansachs.com',
  MS: 'morganstanley.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  DIS: 'disney.com',
  NKE: 'nike.com',
  SBUX: 'starbucks.com',
  MCD: 'mcdonalds.com',
  WMT: 'walmart.com',
  COST: 'costco.com',
  HD: 'homedepot.com',
  LOW: 'lowes.com',
  PEP: 'pepsico.com',
  KO: 'coca-cola.com',
  PG: 'pg.com',
  JNJ: 'jnj.com',
  PFE: 'pfizer.com',
  MRK: 'merck.com',
  UNH: 'unitedhealthgroup.com',
  LLY: 'lilly.com',
  XOM: 'exxonmobil.com',
  CVX: 'chevron.com',
  BA: 'boeing.com',
  GE: 'ge.com',
  F: 'ford.com',
  GM: 'gm.com',
  RIVN: 'rivian.com',
  LCID: 'lucidmotors.com',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  DIA: 'ssga.com',
  IWM: 'ishares.com',
  VOO: 'vanguard.com',
  VTI: 'vanguard.com',
}

const SIZE_CLASS = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

function initials(ticker) {
  return (ticker ?? '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?'
}

export default function StockLogo({ ticker, size = 'sm', className = '' }) {
  const symbol = ticker?.toUpperCase()
  const [failed, setFailed] = useState(false)
  const domain = LOGO_DOMAINS[symbol]
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.sm

  if (!domain || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-slate-600 bg-gradient-to-br from-slate-700 to-slate-950 font-black text-slate-100 shadow-inner ${sizeClass} ${className}`}
        aria-hidden="true"
      >
        {initials(symbol)}
      </span>
    )
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-white ${sizeClass} ${className}`}>
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt=""
        className="h-full w-full object-contain p-0.5"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
