import { useState } from 'react'

const TRADINGVIEW_SLUGS = {
  AAPL: 'apple',
  MSFT: 'microsoft',
  GOOGL: 'alphabet',
  GOOG: 'alphabet',
  AMZN: 'amazon',
  TSLA: 'tesla',
  META: 'meta-platforms',
  NVDA: 'nvidia',
  NFLX: 'netflix',
  AMD: 'advanced-micro-devices',
  INTC: 'intel',
  IBM: 'international-business-machines',
  ORCL: 'oracle',
  CRM: 'salesforce',
  ADBE: 'adobe',
  PYPL: 'paypal',
  SHOP: 'shopify',
  UBER: 'uber',
  ABNB: 'airbnb',
  COIN: 'coinbase',
  SQ: 'block',
  PLTR: 'palantir',
  SNOW: 'snowflake',
  NET: 'cloudflare',
  DDOG: 'datadog',
  JPM: 'jpmorgan-chase',
  BAC: 'bank-of-america',
  WFC: 'wells-fargo',
  GS: 'goldman-sachs',
  MS: 'morgan-stanley',
  V: 'visa',
  MA: 'mastercard',
  DIS: 'walt-disney',
  NKE: 'nike',
  SBUX: 'starbucks',
  MCD: 'mcdonalds',
  WMT: 'walmart',
  TGT: 'target',
  COST: 'costco-wholesale',
  HD: 'home-depot',
  LOW: 'lowes',
  PEP: 'pepsico',
  KO: 'coca-cola',
  PG: 'procter-and-gamble',
  JNJ: 'johnson-and-johnson',
  PFE: 'pfizer',
  MRK: 'merck-and-co',
  UNH: 'unitedhealth',
  LLY: 'eli-lilly',
  ABBV: 'abbvie',
  TMO: 'thermo-fisher-scientific',
  ISRG: 'intuitive-surgical',
  XOM: 'exxon',
  CVX: 'chevron',
  COP: 'conocophillips',
  SLB: 'schlumberger',
  BA: 'boeing',
  GE: 'general-electric',
  CAT: 'caterpillar',
  DE: 'deere',
  HON: 'honeywell',
  UPS: 'united-parcel-service',
  FDX: 'fedex',
  F: 'ford',
  GM: 'general-motors',
  RIVN: 'rivian',
  LCID: 'lucid-group',
  BABA: 'alibaba',
  NIO: 'nio',
  TSM: 'taiwan-semiconductor',
  ASML: 'asml',
  SAP: 'sap',
  SONY: 'sony',
  TM: 'toyota',
  SPY: 'spdr-sandp500-etf-tr',
  QQQ: 'invesco-qqq-trust',
  DIA: 'spdr-dow-jones-industrial-average-etf',
  IWM: 'ishares-russell-2000-etf',
  VOO: 'vanguard-sandp500-etf',
  VTI: 'vanguard-total-stock-market-etf',
}

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
  TGT: 'target.com',
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
  const [fallbackStep, setFallbackStep] = useState(0)
  const tradingViewSlug = TRADINGVIEW_SLUGS[symbol]
  const clearbitDomain = LOGO_DOMAINS[symbol]
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.sm
  const logoSrc = fallbackStep === 0 && tradingViewSlug
    ? `https://s3-symbol-logo.tradingview.com/${tradingViewSlug}.svg`
    : fallbackStep < 2 && clearbitDomain
      ? `https://logo.clearbit.com/${clearbitDomain}`
      : null

  if (!logoSrc) {
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
        src={logoSrc}
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFallbackStep(step => step + 1)}
      />
    </span>
  )
}
