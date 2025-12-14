import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: string[];
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';
  const details = err.details || [];

  // Log error
  console.error(`[Error] ${code}: ${message}`, {
    path: req.path,
    method: req.method,
    statusCode,
    stack: err.stack,
  });

  res.status(statusCode).json({
    code: statusCode,
    message,
    details,
  });
};

export class ApiError extends Error implements AppError {
  statusCode: number;
  code: string;
  details: string[];

  constructor(statusCode: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Common error factory functions
export const NotFoundError = (resource: string, id?: string | number) => {
  const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
  return new ApiError(404, `${resource.toUpperCase().replace(' ', '_')}_NOT_FOUND`, message);
};

export const UnauthorizedError = (message: string = 'Invalid credentials') => {
  return new ApiError(401, 'INVALID_CREDENTIALS', message);
};

export const ForbiddenError = (message: string = 'Insufficient permissions') => {
  return new ApiError(403, 'INSUFFICIENT_PERMISSIONS', message);
};

export const ValidationError = (details: string[]) => {
  return new ApiError(400, 'VALIDATION_ERROR', 'Invalid request parameters', details);
};

export const ConflictError = (message: string, code: string = 'CONFLICT') => {
  return new ApiError(409, code, message);
};
