/**
 * Error Handling Middleware
 * Centralized error handling for the API
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
}

/**
 * Global Error Handler
 * Processes all errors and sends appropriate response
 */
function errorHandler(err, req, res, next) {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Handle specific MongoDB errors
  if (err.name === 'MongoServerError') {
    if (err.code === 11000) {
      // Duplicate key error
      statusCode = 409;
      message = 'Duplicate key error: A document with this value already exists';
      details = err.keyValue;
    }
  }

  // Handle MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    statusCode = 503;
    message = 'Database connection error';
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = err.errors;
  }

  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  // Handle BSONError (invalid ObjectId)
  if (err.name === 'BSONError' || err.message?.includes('ObjectId')) {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // Log error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', {
      statusCode,
      message,
      details,
      stack: err.stack
    });
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler
};
