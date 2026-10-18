export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'ZodError') {
    return res.status(422).json({ code: 'VALIDATION_ERROR', issues: error.issues });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ code: 'BUSINESS_ERROR', message: error.message, details: error.details });
  }
  console.error('Erro não tratado no medical-record-service', error);
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno inesperado' });
}

