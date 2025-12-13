import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Create tax rule (Super Admin only)
router.post(
  '/',
  authenticate,
  authorize('SuperAdmin'),
  [
    body('countryCode').notEmpty().isLength({ min: 2, max: 2 }),
    body('taxClass').notEmpty(),
    body('ratePercent').isDecimal(),
    body('validFrom').isISO8601(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { countryCode, taxClass, ratePercent, validFrom, validTo } = req.body;

      // Check for overlapping rules
      const overlapping = await prisma.taxRule.findFirst({
        where: {
          countryCode,
          taxClass,
          isActive: true,
          OR: [
            {
              validFrom: { lte: new Date(validFrom) },
              validTo: validTo ? { gte: new Date(validFrom) } : null,
            },
            validTo ? {
              validFrom: { lte: new Date(validTo) },
              validTo: { gte: new Date(validTo) },
            } : {},
          ],
        },
      });

      if (overlapping) {
        // Deactivate overlapping rule
        await prisma.taxRule.update({
          where: { id: overlapping.id },
          data: { isActive: false },
        });
      }

      const taxRule = await prisma.taxRule.create({
        data: {
          countryCode,
          taxClass,
          ratePercent,
          validFrom: new Date(validFrom),
          validTo: validTo ? new Date(validTo) : null,
          isActive: true,
        },
      });

      res.status(201).json(taxRule);
    } catch (error) {
      next(error);
    }
  }
);

// Get tax rules
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const taxClass = req.query.taxClass as string | undefined;
      const activeOnly = req.query.active === 'true';

      const where: any = {};
      if (countryCode) where.countryCode = countryCode;
      if (taxClass) where.taxClass = taxClass;
      if (activeOnly) where.isActive = true;

      const taxRules = await prisma.taxRule.findMany({
        where,
        orderBy: [{ countryCode: 'asc' }, { taxClass: 'asc' }, { validFrom: 'desc' }],
      });

      res.json(taxRules);
    } catch (error) {
      next(error);
    }
  }
);

// Get current tax rate for a country and tax class
router.get(
  '/current',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const countryCode = req.query.countryCode as string;
      const taxClass = req.query.taxClass as string;

      if (!countryCode || !taxClass) {
        throw ValidationError(['countryCode and taxClass are required']);
      }

      const now = new Date();
      const taxRule = await prisma.taxRule.findFirst({
        where: {
          countryCode,
          taxClass,
          isActive: true,
          validFrom: { lte: now },
          OR: [
            { validTo: null },
            { validTo: { gte: now } },
          ],
        },
        orderBy: { validFrom: 'desc' },
      });

      if (!taxRule) {
        throw NotFoundError('Tax rule');
      }

      res.json(taxRule);
    } catch (error) {
      next(error);
    }
  }
);

// Deactivate tax rule (instead of delete)
router.delete(
  '/:id',
  authenticate,
  authorize('SuperAdmin'),
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const taxRuleId = parseInt(req.params.id);

      const taxRule = await prisma.taxRule.update({
        where: { id: taxRuleId },
        data: { isActive: false },
      });

      res.json(taxRule);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
