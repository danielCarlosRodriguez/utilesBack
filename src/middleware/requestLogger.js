/**
 * Request Logger Middleware
 * Logs incoming requests for debugging and monitoring
 */

/**
 * Simple request logger
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // Log request
  console.log(`--> ${req.method} ${req.originalUrl}`);

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`<-- ${req.method} ${req.originalUrl} ${statusColor}${res.statusCode}\x1b[0m ${duration}ms`);
  });

  next();
}

module.exports = requestLogger;
