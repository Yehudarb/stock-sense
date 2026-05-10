import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const STORE_PATH = join(DATA_DIR, 'watchlist.json')
const DEFAULT = [
  'AAPL',
  'TSLA',
  'TSLL',
  'NVDA',
  'MSFT',
  'SPY',
  'QQQ',
  'AMD',
  'META',
  'GOOGL',
  'AMZN',
  'NFLX',
  'AVGO',
  'SMCI',
  'PLTR',
  'SOXL',
  'TQQQ',
]

function load() {
  try {
    if (!existsSync(STORE_PATH)) return [...DEFAULT]
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'))
  } catch {
    return [...DEFAULT]
  }
}

function save(tickers) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(tickers), 'utf8')
}

export function getAll() {
  return load().map((ticker, i) => ({ id: String(i + 1), ticker, created_at: new Date().toISOString() }))
}

export function add(ticker) {
  const list = load()
  const upper = ticker.toUpperCase()
  if (!list.includes(upper)) {
    list.push(upper)
    save(list)
  }
  return { id: String(list.indexOf(upper) + 1), ticker: upper }
}

export function remove(ticker) {
  const upper = ticker.toUpperCase()
  save(load().filter(t => t !== upper))
}
