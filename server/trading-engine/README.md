# Trading Engine - ATR-Based Stop Loss Calculator

**Dynamic risk management for stock trading**

Calculate optimal stop loss and take profit levels using:
- ✅ ATR (Average True Range) for volatility
- ✅ Support level detection
- ✅ Risk:Reward validation (never >5% risk)
- ✅ Three strategic scenarios (Tight/Normal/Wide)

---

## 📋 Quick Start

### API Endpoints

#### GET `/api/trading/calculate-stops/:ticker`
Calculate stops using query parameters

```bash
curl "http://localhost:3001/api/trading/calculate-stops/TSLL?entry=7.60&atr=0.38&support=7.25"
```

**Query Parameters:**
| Param | Type | Required | Example |
|-------|------|----------|---------|
| entry | number | ✅ | 7.60 |
| atr | number | ✅ | 0.38 |
| support | number | ❌ | 7.25 |
| volatility | number | ❌ | 0.05 |

**Response:**
```json
{
  "entry_price": 7.60,
  "atr": 0.38,
  "support_price": 7.25,
  "tight": {
    "stop": 7.22,
    "target": 9.10,
    "risk_pct": 5.0,
    "reward_pct": 19.74,
    "rr_ratio": 3.95,
    "reason": "atr_tight"
  },
  "normal": {
    "stop": 7.03,
    "target": 8.74,
    "risk_pct": 7.5,
    "reward_pct": 15.0,
    "rr_ratio": 2.0,
    "reason": "atr_normal"
  },
  "wide": {
    "stop": 6.84,
    "target": 8.39,
    "risk_pct": 10.0,
    "reward_pct": 10.39,
    "rr_ratio": 1.04,
    "reason": "atr_wide"
  },
  "recommended": "normal",
  "warning": null
}
```

#### POST `/api/trading/calculate-stops`
Calculate stops using JSON body

```bash
curl -X POST http://localhost:3001/api/trading/calculate-stops \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "TSLL",
    "entry_price": 7.60,
    "atr": 0.38,
    "support_price": 7.25,
    "volatility_pct": 0.05
  }'
```

#### GET `/api/trading/example`
Get example calculation for documentation

---

## 🎯 Decision Logic

### Three Scenarios

#### 1. **TIGHT** (Aggressive)
- Stop: entry - 1.0×ATR
- Target: entry + 4×ATR
- **R:R: ~4:1** ✅ Best ratio, but wider stop
- **Use when:** High confidence, tight stops
- **Risk:** 3-5% per trade

#### 2. **NORMAL** (Recommended)
- Stop: entry - 1.5×ATR
- Target: entry + 3×ATR
- **R:R: ~3-3.75:1** ✅ Balanced
- **Use when:** Average setup, standard trades
- **Risk:** 4-7.5% per trade

#### 3. **WIDE** (Conservative)
- Stop: entry - 2.0×ATR
- Target: entry + 2×ATR
- **R:R: ~1.5-2:1** ⚠️ Lower ratio
- **Use when:** Low confidence, choppy markets
- **Risk:** 5-10% per trade

### Support Level Rules

| Scenario | Decision |
|----------|----------|
| Support > Entry | ⚠️ **WARNING** - Entry may be invalid |
| Support <1% below entry | Use **WIDE** stop |
| Support 1-3% below entry | Use **NORMAL** stop |
| Support >3% below entry | Use **TIGHT** stop |

### Risk Cap

⚠️ **All stops are capped at 5% maximum risk**

Even if ATR suggests wider stop, it's automatically tightened to entry × (1 - 0.05)

---

## 🔧 Python API

### Installation

```python
from trading_engine.stop_engine import calculate_optimal_levels
```

### Basic Usage

```python
# Simple: Entry 7.60, ATR 0.38
decision = calculate_optimal_levels(
    entry_price=7.60,
    atr=0.38
)

print(f"Entry: ${decision.entry_price}")
print(f"Recommended: {decision.recommended}")
print(f"Stop: ${decision.normal.stop_price}")
print(f"Target: ${decision.normal.target_price}")
print(f"R:R: {decision.normal.rr_ratio:.2f}:1")
```

### With Support Level

```python
decision = calculate_optimal_levels(
    entry_price=7.60,
    atr=0.38,
    support_price=7.25,
    volatility_pct=0.05
)

if decision.warning:
    print(f"⚠️ {decision.warning}")

print(f"Recommendation: {decision.recommended.upper()}")
```

### Access Individual Levels

```python
# Tight scenario
print(f"Tight Stop: ${decision.tight.stop_price}")
print(f"Tight Target: ${decision.tight.target_price}")
print(f"Tight R:R: {decision.tight.rr_ratio:.2f}:1")

# Normal scenario
print(f"Normal Stop: ${decision.normal.stop_price}")

# Wide scenario
print(f"Wide Stop: ${decision.wide.stop_price}")
```

### Convert to Dictionary

```python
data = decision.to_dict()
# → JSON-ready dictionary for API responses
```

---

## 🧪 Testing

Run unit tests:

```bash
cd server/trading-engine
python -m pytest test_stop_engine.py -v
```

**Test Coverage:**
- ✅ R:R ratio calculations
- ✅ Risk/Reward percentages
- ✅ ATR-based stop generation
- ✅ Support level detection
- ✅ Edge cases (zero ATR, support above entry)
- ✅ Risk capping (5% max)
- ✅ JSON conversion
- ✅ Real-world scenarios (TSLL example)

---

## 📊 Real-World Example: TSLL

**Stock:** TSLL (3x Inverse Nasdaq)  
**Setup:**
- Entry Price: $7.60
- ATR (14): $0.38
- Support: $7.25
- Daily Volatility: ~5%

**Decision Output:**

| Level | Stop | Target | Risk | Reward | R:R | Status |
|-------|------|--------|------|--------|-----|--------|
| **Tight** | $7.22 | $9.10 | 5.0% | 19.7% | 3.95:1 | ✅ |
| **Normal** | $7.03 | $8.74 | 7.5% | 15.0% | 2.0:1 | ✅ RECOMMENDED |
| **Wide** | $6.84 | $8.39 | 10.0% | 10.4% | 1.04:1 | ⚠️ Not advised |

**Recommendation:** **NORMAL** scenario
- Stop at $7.03 (below support by 3.5%)
- Target at $8.74 (15% upside)
- 2:1 Risk:Reward ratio
- 7.5% risk per trade

---

## ⚙️ Parameters Explained

### Entry Price
The price you plan to enter the trade at.

### ATR (Average True Range)
The 14-period Average True Range from your chart.
- Measures volatility
- Wider ATR → Wider stops
- Usually from RSI chart or technical analysis

**Where to get:**
- Yahoo Finance chart
- Finnhub API
- TradingView

### Support Price (Optional)
The nearest support level below entry.
- Helps validate stop placement
- If support is too close, forces wider stop
- If missing, only ATR is used

### Volatility % (Optional)
Daily volatility percentage (default 5%).
- For future enhancements
- Currently stored but not actively used
- 0.05 = 5% daily volatility

---

## 🔄 Integration Flow

```
Express Route (trading-engine.js)
    ↓
Parse request → Validate inputs
    ↓
Spawn Python process (cli.py)
    ↓
Call calculate_optimal_levels()
    ↓
Return JSON response
```

---

## 📝 Error Handling

| Error | Cause | HTTP | Response |
|-------|-------|------|----------|
| Missing entry/atr | Required params missing | 400 | `{ error: "...", required: [...] }` |
| Entry ≤ 0 | Invalid entry price | 400 | `{ error: "Entry price must be positive" }` |
| ATR < 0 | Negative ATR | 400 | `{ error: "ATR cannot be negative" }` |
| Support ≥ Entry | Invalid support | 200 | Returns decision with warning |
| Python crash | Unexpected error | 500 | `{ error: "..." }` |

---

## 🚀 Future Enhancements

- [ ] Integrate with Finnhub ATR data
- [ ] Store trade decisions in database
- [ ] Historical win-rate tracking
- [ ] Machine learning for optimal ratios
- [ ] Multi-leg strategy support
- [ ] Options-specific calculations

---

## 📄 License

Part of stock-sense trading analysis platform
