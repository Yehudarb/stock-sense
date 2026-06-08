import { Router } from 'express'
import {
  cancelPaperOrder,
  closePaperPosition,
  createPaperOrder,
  getPaperAccount,
  resetPaperAccount,
  updatePaperTradingSettings,
} from '../services/paperTradingStore.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    res.json(await getPaperAccount())
  } catch (error) {
    next(error)
  }
})

router.post('/orders', async (req, res, next) => {
  try {
    const account = await createPaperOrder(req.body ?? {})
    res.status(201).json(account)
  } catch (error) {
    next(error)
  }
})

router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    res.json(await cancelPaperOrder(req.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/positions/:id/close', async (req, res, next) => {
  try {
    res.json(await closePaperPosition(req.params.id, req.body?.exitPrice))
  } catch (error) {
    next(error)
  }
})

router.patch('/settings', async (req, res, next) => {
  try {
    res.json(await updatePaperTradingSettings(req.body ?? {}))
  } catch (error) {
    next(error)
  }
})

router.post('/reset', async (req, res, next) => {
  try {
    res.json(await resetPaperAccount())
  } catch (error) {
    next(error)
  }
})

export default router
