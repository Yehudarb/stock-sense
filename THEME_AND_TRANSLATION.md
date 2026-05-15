# Theme & Translation Fixes

**עדכון:** 2026-05-15  
**מטרה:** 
1. Implement Dark/Light mode toggle
2. Fix Hebrew translations across the entire site
**Status:** Ready for implementation

---

## 🌓 **PART 1: Dark/Light Mode Implementation**

### Overview
- Currently: Dark mode only
- Target: Full Dark/Light mode with persistent storage
- Toggle button: Header (next to language toggle)

---

### Implementation Steps

#### Step 1: Create Theme Context & Store
**Location:** Create new file `client/src/store/useThemeStore.js`

**What to do:**
```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark', // 'dark' | 'light'
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

export default useThemeStore
```

#### Step 2: Add Theme to Root Element
**Location:** `client/src/components/layout/Layout.jsx`

**What to do:**
```jsx
import useThemeStore from '../../store/useThemeStore'

export default function Layout({ children, isConnected }) {
  const { theme } = useThemeStore()
  const { language } = useStore()
  const isHebrew = language === 'he'

  return (
    <div 
      className="flex min-h-screen flex-col bg-surface md:h-screen" 
      dir={isHebrew ? 'rtl' : 'ltr'}
      data-theme={theme}  // ADD THIS
    >
      {/* rest of layout */}
    </div>
  )
}
```

#### Step 3: Create Light Theme Colors in Tailwind
**Location:** `client/tailwind.config.js` or create `client/src/styles/theme.css`

**What to do:** Add light mode variants
```css
@layer components {
  [data-theme="light"] {
    @apply bg-white text-slate-900;
    
    .bg-surface {
      @apply bg-slate-50;
    }
    
    .bg-surface-muted {
      @apply bg-slate-100;
    }
    
    .bg-surface-bright {
      @apply bg-slate-200;
    }
    
    .glass-panel {
      @apply bg-white/80;
    }
    
    .border-white\/5 {
      @apply border-slate-200;
    }
    
    .border-white\/6 {
      @apply border-slate-300;
    }
    
    .text-slate-400 {
      @apply text-slate-600;
    }
    
    .text-slate-500 {
      @apply text-slate-700;
    }
    
    .bg-slate-950 {
      @apply bg-slate-50;
    }
    
    .bg-slate-900 {
      @apply bg-slate-100;
    }
    
    /* Continue for all color overrides */
  }
}
```

#### Step 4: Add Theme Toggle Button to Header
**Location:** `client/src/components/layout/Header.jsx`

**What to do:**
1. Import theme store:
   ```jsx
   import useThemeStore from '../../store/useThemeStore'
   ```

2. Add toggle button (after language toggle, line 173-180):
   ```jsx
   const { theme, toggleTheme } = useThemeStore()
   
   {/* Add this button after language toggle */}
   <button
     type="button"
     onClick={toggleTheme}
     className="rounded-full border border-white/10 bg-surface-muted/50 px-3 py-1 text-xs font-bold text-slate-300 transition-colors hover:bg-surface-bright"
     title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
     aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
   >
     {theme === 'dark' ? '☀️' : '🌙'}
   </button>
   ```

#### Step 5: Apply Theme to Chart.js
**Location:** `client/src/components/charts/PriceChart.jsx` and all chart files

**What to do:** Update chart colors based on theme
```jsx
import useThemeStore from '../../../store/useThemeStore'

const chartTextColor = (theme) => theme === 'dark' ? 'rgba(226, 232, 240, 0.92)' : 'rgba(15, 23, 42, 0.92)'
const chartGridColor = (theme) => theme === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.12)'
const chartTooltipBg = (theme) => theme === 'dark' ? 'rgba(2, 6, 23, 0.96)' : 'rgba(255, 255, 255, 0.96)'

export default function PriceChart({ ... }) {
  const { theme } = useThemeStore()
  
  // Use theme in chart config:
  options: {
    plugins: {
      tooltip: {
        backgroundColor: chartTooltipBg(theme),
        titleColor: chartTextColor(theme),
        bodyColor: chartTextColor(theme),
      }
    },
    scales: {
      x: {
        ticks: {
          color: chartTextColor(theme),
        },
        grid: {
          color: chartGridColor(theme),
        }
      }
    }
  }
}
```

---

## 🇮🇱 **PART 2: Hebrew Translation Fixes**

### Current Issues:
- Some English text hardcoded instead of translated
- Inconsistent Hebrew grammar/spelling
- Missing Hebrew translations for new components
- English labels mixed with Hebrew

### Files to Audit & Fix:

#### 1. Header.jsx
**Location:** `client/src/components/layout/Header.jsx`

**Issues to fix:**
```jsx
// Line 56 - Copy object:
language: isHebrew ? 'EN' : 'עב',  // Should be full words
// FIX TO:
language: isHebrew ? '🇺🇸 English' : '🇮🇱 עברית',

// Line 62 - refreshHint:
refreshHint: isHebrew ? 'הנתונים מתרעננים עבור הטווח שנבחר' : 'Refreshing data for the selected range',
// This is OK, but could be better:
// FIX TO:
refreshHint: isHebrew ? 'מחשב מחדש ניתוח לטווח החדש' : 'Recalculating for the new timeframe',
```

#### 2. App.jsx
**Location:** `client/src/App.jsx`

**Issues:**
```jsx
// Lines 196-202 - Copy object needs complete Hebrew:
copy: {
  changePct: isHebrew ? 'Change %' : 'Change %',  // WRONG - not translated
  high20: isHebrew ? '20-bar high' : '20-bar high',  // WRONG
  low20: isHebrew ? '20-bar low' : '20-bar low',  // WRONG
  trend: isHebrew ? 'Trend' : 'Trend',  // WRONG
  vsSma20: 'vs SMA20',  // Not translated
}

// FIX TO:
copy: {
  changePct: isHebrew ? 'שינוי %' : 'Change %',
  high20: isHebrew ? 'שיא 20 נרות' : '20-bar high',
  low20: isHebrew ? 'נמוך 20 נרות' : '20-bar low',
  trend: isHebrew ? 'מגמה' : 'Trend',
  vsSma20: isHebrew ? 'מול SMA20' : 'vs SMA20',
}

// Lines 205-225 - loadingSteps Hebrew:
// Current: English only
// FIX: Add Hebrew to each step
{
  label: isHebrew ? 'טוען נתונים בשוק...' : 'Fetching market data...',
  detail: isHebrew ? 'טוען היסטוריית מחירים ותמונת מצב עבור ' + currentTicker : `Loading price history and snapshot for ${currentTicker}.`,
  state: snapshot ? 'done' : 'active',
}
```

#### 3. SignalPanel.jsx
**Location:** `client/src/components/analysis/SignalPanel.jsx`

**Issues - All these need Hebrew:**
```jsx
// Line 287-311 - copy object:
copy: {
  loading: isEnglish ? 'Loading analysis...' : 'טוען ניתוח...',
  signalTitle: isEnglish ? 'Trading signal' : 'אות מסחר',
  confidence: isEnglish ? 'Confidence' : 'ביטחון',
  buyProbability: isEnglish ? 'Buy probability' : 'הסתברות קנייה',  // Good!
  sellProbability: isEnglish ? 'Sell probability' : 'הסתברות מכירה',  // Good!
  
  // BUT these are missing Hebrew:
  pipeline: isEnglish ? 'Pipeline gates' : 'Pipeline gates',  // NOT TRANSLATED
  marketTrend: isEnglish ? 'Market trend' : 'Market trend',  // NOT TRANSLATED
  
  // FIX ALL:
  pipeline: isEnglish ? 'Pipeline gates' : 'שערי בדיקה',
  marketTrend: isEnglish ? 'Market trend' : 'מגמת שוק',
  trendGate: isEnglish ? 'Trend gate' : 'שער מגמה',
  passed: isEnglish ? 'Passed' : 'עבר בדיקה',
  blocked: isEnglish ? 'Blocked' : 'נחסם',
  buyConfluence: isEnglish ? 'Buy confluence' : 'confluence קנייה',  // FIX: 'התכנסות קנייה'
  aligned: isEnglish ? 'aligned' : 'aligned',  // NOT TRANSLATED - FIX: 'מיושרים'
  candleVolume: isEnglish ? 'Candle + volume' : 'Candle + volume',  // FIX: 'נר + נפח'
  bullishCandle: isEnglish ? 'Bullish candle' : 'Bullish candle',  // FIX: 'נר בולישי'
  notConfirmed: isEnglish ? 'Not confirmed' : 'Not confirmed',  // FIX: 'לא אושר'
  indicators: isEnglish ? 'Indicators' : 'Indicators',  // FIX: 'אינדיקטורים'
  patterns: isEnglish ? 'Chart patterns' : 'Chart patterns',  // FIX: 'תבניות גרפיות'
  leadingPattern: isEnglish ? 'Leading pattern' : 'Leading pattern',  // FIX: 'תבנית מובילה'
  patternScore: isEnglish ? 'Pattern score' : 'Pattern score',  // FIX: 'ניקוד תבניות'
  risk: isEnglish ? 'Risk management' : 'Risk management',  // FIX: 'ניהול סיכונים'
  riskReward: isEnglish ? 'Risk/reward ratio' : 'Risk/reward ratio',  // FIX: 'יחס סיכון/תשואה'
  analysis: isEnglish ? 'Analysis' : 'Analysis',  // FIX: 'ניתוח'
}
```

#### 4. TradeActionCard.jsx
**Location:** `client/src/components/ui/TradeActionCard.jsx`

**Issues:**
```jsx
// Line 50-57 - All copy labels:
copy: {
  title: isEnglish ? 'Trade action' : 'פעולת מסחר',  // Good!
  confidence: isEnglish ? 'Confidence' : 'ביטחון',  // Good!
  currentPrice: isEnglish ? 'Current price' : 'מחיר נוכחי',  // Good!
  entryZone: isEnglish ? 'Entry zone' : 'אזור כניסה',  // Good!
  ratio: isEnglish ? 'R/R' : 'סיכוי/סיכון',  // Good but could be 'יחס סיכון/תשואה'
  stopLoss: 'Stop Loss',  // NOT TRANSLATED - FIX: isEnglish ? 'Stop Loss' : 'Stop Loss'
  takeProfit: 'Take Profit',  // NOT TRANSLATED - FIX: isEnglish ? 'Take Profit' : 'Take Profit'
  risk: isEnglish ? 'Risk' : 'סיכון',  // Good!
}
```

#### 5. DisclaimerBanner.jsx
**Location:** `client/src/components/legal/DisclaimerBanner.jsx`

**Check:** Lines 15-18 (already have Hebrew, looks good!)

#### 6. ChartWorkspace.jsx
**Location:** `client/src/components/charts/ChartWorkspace.jsx`

**Issues:**
```jsx
// Many English-only labels:
- 'Chart workspace'  // NOT TRANSLATED
- 'Active chart structures'  // NOT TRANSLATED
- 'Pattern read'  // NOT TRANSLATED
- 'No dominant pattern...'  // NOT TRANSLATED
- All Group labels  // NOT TRANSLATED
- All button labels  // NOT TRANSLATED

// FIX: Add Hebrew for ALL labels with language check:
label={language === 'he' ? 'סוג גרף' : 'Chart type'}
label={language === 'he' ? 'אינדיקטורים' : 'Indicators'}
label={language === 'he' ? 'כלים לניתוח' : 'Analysis tools'}
// etc.
```

#### 7. AnalysisResultCard.jsx
**Location:** `client/src/components/analysis/AnalysisResultCard.jsx`

**Check:** Lines 52-64 (looks good with Hebrew!)

#### 8. FactorRow.jsx
**Location:** `client/src/components/analysis/FactorRow.jsx`

**Issues:**
```jsx
// Lines 7-9 - labels object missing full Hebrew:
labels: {
  he: { BUY: 'קנייה', SELL: 'מכירה', HOLD: 'ניטרלי' },  // Good!
  en: { BUY: 'Buy', SELL: 'Sell', HOLD: 'Neutral' },
}

// But labelMap (lines 12-16) has English only:
labelMap: {
  en: {
    'מרחק SMA20': 'SMA20 distance',  // Wrong direction
  },
}

// FIX:
labelMap: {
  he: {
    'SMA20 distance': 'מרחק SMA20',
  },
  en: {
    'מרחק SMA20': 'SMA20 distance',
  },
}
```

---

## 📋 **Complete Translation Audit Checklist**

### Files to check:
- [ ] Header.jsx — Button labels, tooltips
- [ ] App.jsx — KPI labels, loading steps
- [ ] SignalPanel.jsx — ALL copy object items
- [ ] TradeActionCard.jsx — Metric labels
- [ ] ChartWorkspace.jsx — All control groups & buttons
- [ ] AnalysisResultCard.jsx — Section titles
- [ ] FactorRow.jsx — Label mapping
- [ ] EarningsPanel.jsx — Check for Hebrew
- [ ] MarketContextPanel.jsx — Check for Hebrew
- [ ] ForecastOpinionPanel.jsx — Check for Hebrew
- [ ] TechnicalAnalysisPanel.jsx — Check for Hebrew
- [ ] AdvancedTrendsPanel.jsx — Check for Hebrew
- [ ] DisclaimerBanner.jsx — ✅ Already good
- [ ] LegalFooter.jsx — Check for Hebrew

### Hebrew Translation Guidelines:
1. **Technical terms:** Keep English for universal understanding
   - ✅ RSI, MACD, Stochastic, ATR, SMA, EMA, Bollinger Bands
   - But add Hebrew explanation in brackets if needed

2. **Action words:** Always translate
   - BUY → קנייה
   - SELL → מכירה
   - HOLD → ניטרלי
   - WAIT → המתן

3. **UI Labels:** Always translate
   - Entry zone → אזור כניסה
   - Stop Loss → עצור הפסד / סטופ לוס
   - Take Profit → קח רווח / טייק פרופיט
   - Risk/Reward → יחס סיכון/תשואה

4. **Tooltips & Help text:** Always translate

5. **Direction:** Make sure RTL (right-to-left) works with text

---

## Implementation Priority

### Part 1: Dark/Light Mode (Priority: HIGH)
1. Create theme store
2. Add toggle button
3. Update tailwind colors
4. Update all charts
5. Test light mode on all pages

**Estimated time:** 45 minutes

### Part 2: Hebrew Translations (Priority: MEDIUM)
1. Audit all files (above checklist)
2. Fix SignalPanel.jsx (most issues)
3. Fix ChartWorkspace.jsx (many labels)
4. Fix App.jsx (KPI labels)
5. Test on Hebrew setting

**Estimated time:** 30 minutes

---

## Testing Checklist

### Dark Mode Testing:
- [ ] Toggle button visible in Header
- [ ] Dark mode persists on refresh
- [ ] Light mode persists on refresh
- [ ] All text readable in both modes
- [ ] Charts display correctly in both modes
- [ ] Cards and panels look good in both modes
- [ ] Mobile responsive in both modes

### Hebrew Translation Testing:
- [ ] Switch to Hebrew in Header
- [ ] All KPI labels in Hebrew
- [ ] All button labels in Hebrew
- [ ] All section titles in Hebrew
- [ ] All tooltips in Hebrew
- [ ] RTL layout correct
- [ ] No mixed English/Hebrew mid-sentence
- [ ] Technical terms use proper Hebrew convention

---

**All instructions ready for implementation. Total estimated time: 75 minutes (45 + 30)**
