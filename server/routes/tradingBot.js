import { Router } from 'express'
import {
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

export default router
