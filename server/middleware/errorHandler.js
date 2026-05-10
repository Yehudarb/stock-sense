export function errorHandler(err, _req, res, _next) {
  console.error(err)
  const status = err.status ?? err.statusCode ?? 500
  const message = err.message ?? 'שגיאת שרת'
  res.status(status).json({ error: message })
}
