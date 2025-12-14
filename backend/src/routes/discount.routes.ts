import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError, ApiError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Create discount
router.post(
  '/',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('businessId').isInt(),
    body('code').notEmpty(),
    body('type').isIn(['Percent', 'Amount']),
    body('scope').isIn(['Order', 'Line']),
    body('value').isDecimal(),
    body('startsAt').isISO8601(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, code, type, scope, value, startsAt, endsAt, eligibleItems } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create discount for another business');
      }

      // Check for duplicate code
      const existing = await prisma.discount.findUnique({
        where: { businessId_code: { businessId, code } },
      });

      if (existing) {
        throw ConflictError('DUPLICATE_CODE', 'Discount with this code already exists');
      }

      const discount = await prisma.discount.create({
        data: {
          businessId,
          code,
          type,
          scope,
          value: parseFloat(value),
          startsAt: new Date(startsAt),
          endsAt: endsAt ? new Date(endsAt) : null,
          status: 'Active',
        },
      });

      // Create eligibility records for line-scoped discounts
      if (scope === 'Line' && eligibleItems && eligibleItems.length > 0) {
        await prisma.discountEligibility.createMany({
          data: eligibleItems.map((itemId: number) => ({
            discountId: discount.id,
            catalogItemId: itemId,
          })),
        });
      }

      const fullDiscount = await prisma.discount.findUnique({
        where: { id: discount.id },
        include: {
          eligibilities: {
            include: { catalogItem: true },
          },
        },
      });

      res.status(201).json(fullDiscount);
    } catch (error) {
      next(error);
    }
  }
);

// Get discounts
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin'
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      const status = req.query.status as string | undefined;

      const where: any = { businessId };
      if (status) where.status = status;

      const discounts = await prisma.discount.findMany({
        where,
        include: {
          eligibilities: {
            include: { catalogItem: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(discounts);
    } catch (error) {
      next(error);
    }
  }
);

// Get discount by code
router.get(
  '/code/:code',
  authenticate,
  param('code').notEmpty(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const code = req.params.code;
      const businessId = req.user!.businessId;

      if (!businessId && req.user!.role !== 'SuperAdmin') {
        throw ForbiddenError('Business ID required');
      }

      const discount = await prisma.discount.findUnique({
        where: {
          businessId_code: {
            businessId: businessId!,
            code,
          },
        },
        include: {
          eligibilities: {
            include: { catalogItem: true },
          },
        },
      });

      if (!discount) {
        throw NotFoundError('Discount');
      }

      // Check if discount is currently valid
      const now = new Date();
      if (discount.startsAt > now || (discount.endsAt && discount.endsAt < now)) {
        throw new ApiError(400, 'INVALID_DISCOUNT', 'Discount is not currently active');
      }

      res.json(discount);
    } catch (error) {
      next(error);
    }
  }
);

// Update discount
router.put(
  '/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const discountId = parseInt(req.params.id);

      const discount = await prisma.discount.findUnique({
        where: { id: discountId },
      });

      if (!discount) {
        throw NotFoundError('Discount', discountId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== discount.businessId) {
        throw ForbiddenError('Cannot update discount from another business');
      }

      const updated = await prisma.discount.update({
        where: { id: discountId },
        data: req.body,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Deactivate discount
router.delete(
  '/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const discountId = parseInt(req.params.id);

      const discount = await prisma.discount.findUnique({
        where: { id: discountId },
      });

      if (!discount) {
        throw NotFoundError('Discount', discountId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== discount.businessId) {
        throw ForbiddenError('Cannot delete discount from another business');
      }

      const updated = await prisma.discount.update({
        where: { id: discountId },
        data: { status: 'Inactive' },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
