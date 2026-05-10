import { Router } from 'express'
import { getAll, add, remove } from '../services/watchlistStore.js'

const router = Router()

router.get('/', (_req, res) => res.json(getAll()))

router.post('/', (req, res) => {
  const { ticker } = req.body
  if (!ticker) return res.status(400).json({ error: 'ticker required' })
  res.status(201).json(add(ticker))
})

router.delete('/:ticker', (req, res) => {
  remove(req.params.ticker)
  res.json({ ok: true })
})

export default router
