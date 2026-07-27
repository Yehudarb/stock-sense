import { Router } from 'express'
import { runStockAnalysisPro } from '../services/stockAnalysisProRunner.js'

const router = Router()

router.post('/analyze', async (req, res, next) => {
  try {
    const result = await runStockAnalysisPro(req.body ?? {})
    res.json(result)
  } catch (error) {
    next(error)
  }
})

export default router
