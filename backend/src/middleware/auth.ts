import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, UnauthorizedError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    businessId?: number;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    // Development/demo shortcut: accept a well-known demo token without JWT verification
    if (token === 'demo-token' && process.env.NODE_ENV !== 'production') {
      req.user = {
        id: 1,
        email: 'demo@example.com',
        role: 'Owner',
        businessId: 1,
      };
      return next();
    }

    const secret = process.env.JWT_SECRET!;

    const decoded = jwt.verify(token, secret) as {
      id: number;
      email: string;
      role: string;
      businessId?: number;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ForbiddenError(`Role ${req.user.role} is not authorized for this action`));
    }

    next();
  };
};

export const checkBusinessAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(UnauthorizedError('Authentication required'));
  }

  // Super admins have access to all businesses
  if (req.user.role === 'SuperAdmin') {
    return next();
  }

  // Get business ID from params or body
  const businessId = parseInt(req.params.businessId || req.body.businessId);
  
  if (!businessId) {
    return next(ForbiddenError('Business ID required'));
  }

  // Check if user belongs to the business
  if (req.user.businessId !== businessId) {
    return next(ForbiddenError('Access denied to this business'));
  }

  next();
};
