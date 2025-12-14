import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError, ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Create business (Super Admin only)
router.post(
  '/',
  authenticate,
  authorize('SuperAdmin'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('countryCode').notEmpty().isLength({ min: 2, max: 2 }).withMessage('Valid country code required'),
    body('priceIncludesTax').optional().isBoolean(),
    body('ownerEmail').isEmail().withMessage('Valid owner email required'),
    body('ownerName').notEmpty().withMessage('Owner name required'),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { name, address, phone, email, countryCode, priceIncludesTax, ownerEmail, ownerName } = req.body;

      // Check if owner email already exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: ownerEmail },
      });

      if (existingEmployee) {
        throw ConflictError('DUPLICATE_EMAIL', 'Employee with this email already exists');
      }

      // Create business and owner in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name,
            address,
            phone,
            email,
            countryCode,
            priceIncludesTax: priceIncludesTax ?? false,
          },
        });

        const owner = await tx.employee.create({
          data: {
            businessId: business.id,
            email: ownerEmail,
            name: ownerName,
            role: 'Owner',
            status: 'Active',
          },
        });

        return { business, owner };
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get all businesses (Super Admin only)
router.get(
  '/',
  authenticate,
  authorize('SuperAdmin'),
  async (req: AuthRequest, res, next) => {
    try {
      const businesses = await prisma.business.findMany({
        include: {
          _count: {
            select: {
              employees: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(businesses);
    } catch (error) {
      next(error);
    }
  }
);

// Get business by ID
router.get(
  '/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = parseInt(req.params.id);

      // Check access
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Access denied to this business');
      }

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          employees: {
            where: { status: 'Active' },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      });

      if (!business) {
        throw NotFoundError('Business', businessId);
      }

      res.json(business);
    } catch (error) {
      next(error);
    }
  }
);

// Update business
router.put(
  '/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner'),
  param('id').isInt(),
  [
    body('name').optional().notEmpty(),
    body('countryCode').optional().isLength({ min: 2, max: 2 }),
    body('priceIncludesTax').optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = parseInt(req.params.id);

      // Check access
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'Access denied to this business');
      }

      const business = await prisma.business.update({
        where: { id: businessId },
        data: req.body,
      });

      res.json(business);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
