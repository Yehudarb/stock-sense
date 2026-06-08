import { Router } from 'express'
import {
  executeAutoPaperCycle,
  getTradingBotState,
  recordTradingBotEvent,
  updateTradingBotSettings,
} from '../services/tradingBotStore.js'

const router = Router()

router.get('/', (_req, res, next) => {
  try {
    res.json(getTradingBotState())
  } catch (error) {
    next(error)
  }
})

router.patch('/settings', (req, res, next) => {
  try {
    res.json(updateTradingBotSettings(req.body ?? {}))
  } catch (error) {
    next(error)
  }
})

router.post('/events', (req, res, next) => {
  try {
    res.status(201).json(recordTradingBotEvent(req.body ?? {}))
  } catch (error) {
    next(error)
  }
})

router.post('/auto-execute', async (req, res, next) => {
  try {
    res.json(await executeAutoPaperCycle(req.body ?? {}))
  } catch (error) {
    next(error)
  }
})

export default router
