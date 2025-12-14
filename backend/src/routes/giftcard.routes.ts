import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError, ApiError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';
import crypto from 'crypto';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Generate unique gift card code
function generateGiftCardCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

// Issue gift card
router.post(
  '/',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('businessId').isInt(),
    body('initialValue').isDecimal(),
    body('expiresAt').optional().isISO8601(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, initialValue, expiresAt } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot issue gift card for another business');
      }

      const code = generateGiftCardCode();

      const giftCard = await prisma.giftCard.create({
        data: {
          businessId,
          code,
          initialValue: parseFloat(initialValue),
          balance: parseFloat(initialValue),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          status: 'Active',
        },
      });

      res.status(201).json(giftCard);
    } catch (error) {
      next(error);
    }
  }
);

// Get gift cards
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

      const giftCards = await prisma.giftCard.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
      });

      res.json(giftCards);
    } catch (error) {
      next(error);
    }
  }
);

// Get gift card by code
router.get(
  '/code/:code',
  authenticate,
  param('code').notEmpty(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const code = req.params.code.toUpperCase();

      const giftCard = await prisma.giftCard.findUnique({
        where: { code },
      });

      if (!giftCard) {
        throw NotFoundError('Gift card');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== giftCard.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(giftCard);
    } catch (error) {
      next(error);
    }
  }
);

// Check gift card balance
router.get(
  '/balance/:code',
  authenticate,
  param('code').notEmpty(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const code = req.params.code.toUpperCase();

      const giftCard = await prisma.giftCard.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          balance: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!giftCard) {
        throw NotFoundError('Gift card');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== giftCard.businessId) {
        throw ForbiddenError('Access denied');
      }

      // Check expiration
      if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
        await prisma.giftCard.update({
          where: { code },
          data: { status: 'Expired' },
        });
        giftCard.status = 'Expired';
      }

      res.json(giftCard);
    } catch (error) {
      next(error);
    }
  }
);

// Block/unblock gift card
router.put(
  '/:id/status',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    param('id').isInt(),
    body('status').isIn(['Active', 'Blocked']),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const giftCardId = parseInt(req.params.id);
      const { status } = req.body;

      const giftCard = await prisma.giftCard.findUnique({
        where: { id: giftCardId },
      });

      if (!giftCard) {
        throw NotFoundError('Gift card', giftCardId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== giftCard.businessId) {
        throw ForbiddenError('Cannot modify gift card from another business');
      }

      const updated = await prisma.giftCard.update({
        where: { id: giftCardId },
        data: { status },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
