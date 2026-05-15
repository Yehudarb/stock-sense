import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const STORE_PATH = join(DATA_DIR, 'alerts.json')

function load() {
  try {
    if (!existsSync(STORE_PATH)) return []
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'))
  } catch {
    return []
  }
}

function save(alerts) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(alerts, null, 2), 'utf8')
}

export function getAll() {
  return load()
}

export function add({ ticker, type, price }) {
  const alerts = load()
  const newAlert = {
    id: Math.random().toString(36).substring(2, 15),
    ticker: ticker.toUpperCase(),
    type, // 'above' or 'below'
    price: Number(price),
    active: true,
    createdAt: new Date().toISOString(),
    firedAt: null
  }
  alerts.push(newAlert)
  save(alerts)
  return newAlert
}

export function update(id, updates) {
  const alerts = load()
  const index = alerts.findIndex(a => a.id === id)
  if (index === -1) return null
  alerts[index] = { ...alerts[index], ...updates }
  save(alerts)
  return alerts[index]
}

export function remove(id) {
  const alerts = load()
  const filtered = alerts.filter(a => a.id !== id)
  save(filtered)
}

export function getActiveAlertsForTicker(ticker) {
  return load().filter(a => a.ticker === ticker.toUpperCase() && a.active)
}
