import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')
const cliPath = path.join(repoRoot, 'cli.py')

const VALID_STYLES = new Set(['day_trade', 'swing', 'position_trade', 'long_term'])
const DEFAULT_TIMEOUT_MS = 45_000

let testConfig = {
  runner: null,
  timeoutMs: DEFAULT_TIMEOUT_MS,
}

export function sanitizeAnalysisRequest(input = {}) {
  const symbol = String(input.symbol ?? input.ticker ?? '').trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) {
    const error = new Error('Invalid symbol')
    error.status = 400
    throw error
  }

  const style = VALID_STYLES.has(input.style) ? input.style : VALID_STYLES.has(input.trading_style) ? input.trading_style : 'swing'
  const accountSize = numberInRange(input.account_size ?? input.accountSize, 1, 100_000_000, 25_000)
  const riskPercent = numberInRange(input.risk_percent ?? input.riskPercent ?? input.risk_per_trade_percent, 0.01, 10, 1)
  const targetMin = numberInRange(input.target_min ?? input.targetMin ?? input.target_gain_percent?.min, 0.1, 100, 5)
  const targetMax = numberInRange(input.target_max ?? input.targetMax ?? input.target_gain_percent?.max, targetMin, 200, 12)
  const holdingPeriod = String(input.holding_period ?? input.holdingPeriod ?? '1-3 months').slice(0, 60)
  const hasPosition = Boolean(input.has_position ?? input.hasPosition)
  const averageEntryPrice = optionalPositive(input.average_entry_price ?? input.averageEntryPrice)
  const shares = optionalInteger(input.shares)
  const currentStop = optionalPositive(input.current_stop ?? input.currentStop)
  const allowEventRisk = Boolean(input.allow_event_risk ?? input.allowEventRisk)

  return {
    symbol,
    style,
    accountSize,
    riskPercent,
    targetMin,
    targetMax,
    holdingPeriod,
    hasPosition,
    averageEntryPrice,
    shares,
    currentStop,
    allowEventRisk,
  }
}

export async function runStockAnalysisPro(rawInput = {}) {
  const request = sanitizeAnalysisRequest(rawInput)
  if (testConfig.runner) return testConfig.runner(request)

  const args = [
    cliPath,
    'analyze',
    request.symbol,
    '--style',
    request.style,
    '--holding-period',
    request.holdingPeriod,
    '--account-size',
    String(request.accountSize),
    '--risk-percent',
    String(request.riskPercent),
    '--target-min',
    String(request.targetMin),
    '--target-max',
    String(request.targetMax),
    '--json-only',
  ]

  if (request.hasPosition) args.push('--has-position')
  if (request.averageEntryPrice != null) args.push('--average-entry-price', String(request.averageEntryPrice))
  if (request.shares != null) args.push('--shares', String(request.shares))
  if (request.currentStop != null) args.push('--current-stop', String(request.currentStop))
  if (request.allowEventRisk) args.push('--allow-event-risk')

  const candidates = process.env.PYTHON_BIN
    ? [process.env.PYTHON_BIN]
    : process.platform === 'win32'
      ? ['py', 'python', 'python3']
      : ['python3', 'python']

  return runWithCandidates(candidates, args, testConfig.timeoutMs)
}

export function __setStockAnalysisProTestConfig(config = {}) {
  testConfig = { ...testConfig, ...config }
}

export function __resetStockAnalysisProTestConfig() {
  testConfig = { runner: null, timeoutMs: DEFAULT_TIMEOUT_MS }
}

function numberInRange(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function optionalPositive(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function optionalInteger(value) {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function runWithCandidates(candidates, args, timeoutMs) {
  let lastError = null
  for (const command of candidates) {
    try {
      return await runProcess(command, args, timeoutMs)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      lastError = error
    }
  }
  const error = new Error(`Python executable not found: tried ${candidates.join(', ')}`)
  error.status = 503
  error.cause = lastError
  throw error
}

function runProcess(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      const error = new Error('Stock Analysis Pro timed out')
      error.name = 'TimeoutError'
      reject(error)
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) {
        const error = new Error(stderr.trim() || `Stock Analysis Pro failed with exit code ${code}`)
        error.status = 502
        return reject(error)
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        error.status = 502
        error.message = `Invalid Stock Analysis Pro JSON output: ${error.message}`
        reject(error)
      }
    })
  })
}
