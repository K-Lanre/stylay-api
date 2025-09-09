class AppError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Add custom error details
    Object.entries(details).forEach(([key, value]) => {
      this[key] = value;
    });

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
