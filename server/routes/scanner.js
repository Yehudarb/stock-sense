import { Router } from 'express'
import {
  getCupHandleScan,
  getLatestCupHandleScan,
  startCupHandleScan,
} from '../services/cupHandleScanner.js'

const router = Router()

/** Start a shared background scan or return the currently running/cached job. */
router.post('/cup-handle', (req, res) => {
  const job = startCupHandleScan({
    force: req.body?.force === true,
    minimumSize: req.body?.minimumSize,
    strengthThreshold: req.body?.strengthThreshold,
    minimumQuality: req.body?.minimumQuality,
  })
  res.status(job.status === 'done' ? 200 : 202).json(job)
})

/** Return the active scan, or the latest completed result if one exists. */
router.get('/cup-handle/latest', (_req, res) => {
  const job = getLatestCupHandleScan()
  if (!job) return res.status(404).json({ error: 'No Cup & Handle scan is available yet' })
  return res.json(job)
})

/** Poll a specific scan job. */
router.get('/cup-handle/:jobId', (req, res) => {
  const job = getCupHandleScan(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Cup & Handle scan job was not found' })
  return res.json(job)
})

export default router
