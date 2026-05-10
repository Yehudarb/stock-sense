export function errorHandler(err, _req, res, _next) {
  console.error(err)

  const status = err.name === 'TimeoutError'
    ? 504
    : (err.status ?? err.statusCode ?? 500)

  const message = status >= 500
    ? 'Temporary market data error'
    : (err.message ?? 'Server error')

  res.status(status).json({ error: message })
}
