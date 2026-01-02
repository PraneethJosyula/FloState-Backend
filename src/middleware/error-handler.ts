import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }

  static badRequest(message: string = 'Bad request') {
    return new ApiError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Not found') {
    return new ApiError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string = 'Conflict') {
    return new ApiError(message, 409, 'CONFLICT');
  }

  static internal(message: string = 'Internal server error') {
    return new ApiError(message, 500, 'INTERNAL_ERROR');
  }
}

