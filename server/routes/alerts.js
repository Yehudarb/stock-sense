import { Router } from 'express'
import * as alertsStore from '../services/alertsStore.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(alertsStore.getAll())
})

router.post('/', (req, res) => {
  const { ticker, type, price } = req.body
  if (!ticker || !type || !price) {
    return res.status(400).json({ error: 'Ticker, type and price are required' })
  }
  const alert = alertsStore.add({ ticker, type, price })
  res.status(201).json(alert)
})

router.patch('/:id', (req, res) => {
  const alert = alertsStore.update(req.params.id, req.body)
  if (!alert) return res.status(404).json({ error: 'Alert not found' })
  res.json(alert)
})

router.delete('/:id', (req, res) => {
  alertsStore.remove(req.params.id)
  res.status(204).end()
})

export default router
