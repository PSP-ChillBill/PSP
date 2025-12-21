import { Router } from 'express';
import { body, param } from 'express-validator';
import { Decimal } from '@prisma/client/runtime/library';
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

// Create stock item for a catalog item
router.post(
  '/items',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('catalogItemId').isInt(),
    body('unit').notEmpty(),
    body('qtyOnHand').isDecimal(),
    body('averageUnitCost').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { catalogItemId, unit, qtyOnHand, averageUnitCost } = req.body;

      // Check catalog item exists and user has access
      const catalogItem = await prisma.catalogItem.findUnique({
        where: { id: catalogItemId },
      });

      if (!catalogItem) {
        throw NotFoundError('Catalog item', catalogItemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== catalogItem.businessId) {
        throw ForbiddenError('Cannot manage inventory for another business');
      }

      const qtyDecimal = new Decimal(qtyOnHand);
      const costDecimal = new Decimal(averageUnitCost);

      const result = await prisma.$transaction(async (tx) => {
        const stockItem = await tx.stockItem.create({
          data: {
            catalogItemId,
            unit,
            qtyOnHand: qtyDecimal,
            averageUnitCost: costDecimal,
          },
        });

        // Create initial movement log if quantity is not zero to have audit trail
        if (!qtyDecimal.isZero()) {
          await tx.stockMovement.create({
            data: {
              stockItemId: stockItem.id,
              type: 'Adjust',
              delta: qtyDecimal,
              unitCostSnapshot: costDecimal,
              notes: 'Initial Inventory Setup',
            },
          });
        }

        return stockItem;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get stock items
router.get(
  '/items',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin'
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      const stockItems = await prisma.stockItem.findMany({
        where: {
          catalogItem: {
            businessId,
          },
        },
        include: {
          catalogItem: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          catalogItem: {
            name: 'asc',
          },
        },
      });

      res.json(stockItems);
    } catch (error) {
      next(error);
    }
  }
);

// Get stock item by ID
router.get(
  '/items/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const stockItemId = parseInt(req.params.id);

      const stockItem = await prisma.stockItem.findUnique({
        where: { id: stockItemId },
        include: {
          catalogItem: true,
          stockMovements: {
            orderBy: { at: 'desc' },
            take: 50,
          },
        },
      });

      if (!stockItem) {
        throw NotFoundError('Stock item', stockItemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== stockItem.catalogItem.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(stockItem);
    } catch (error) {
      next(error);
    }
  }
);

// Record stock movement
router.post(
  '/movements',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('stockItemId').isInt(),
    body('type').isIn(['Receive', 'Waste', 'Adjust']),
    body('delta').isDecimal(),
    body('unitCostSnapshot').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { stockItemId, type, delta, unitCostSnapshot, notes } = req.body;

      const stockItem = await prisma.stockItem.findUnique({
        where: { id: stockItemId },
        include: { catalogItem: true },
      });

      if (!stockItem) {
        throw NotFoundError('Stock item', stockItemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== stockItem.catalogItem.businessId) {
        throw ForbiddenError('Cannot manage inventory for another business');
      }

      const deltaValue = new Decimal(delta);
      const unitCost = new Decimal(unitCostSnapshot);

      // Create movement and update stock quantity using safe Decimal arithmetic
      await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            stockItemId,
            type,
            delta: deltaValue,
            unitCostSnapshot: unitCost,
            notes,
          },
        }),
        prisma.stockItem.update({
          where: { id: stockItemId },
          data: {
            qtyOnHand: {
              increment: deltaValue,
            },
            // Update average cost for receipts
            ...(type === 'Receive' ? {
              averageUnitCost: unitCost,
            } : {}),
          },
        }),
      ]);

      const updated = await prisma.stockItem.findUnique({
        where: { id: stockItemId },
        include: {
          catalogItem: true,
          stockMovements: {
            orderBy: { at: 'desc' },
            take: 10,
          },
        },
      });

      res.status(201).json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Get stock movements
router.get(
  '/movements',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const stockItemId = req.query.stockItemId ? parseInt(req.query.stockItemId as string) : undefined;
      
      let businessId: number | undefined;
      if (req.user!.role === 'SuperAdmin') {
        if (req.query.businessId) {
          const parsed = parseInt(req.query.businessId as string);
          if (!isNaN(parsed)) businessId = parsed;
        }
      } else {
        businessId = req.user!.businessId!;
      }

      const where: any = {};

      // Only apply business filter if we have a valid businessId.
      // This allows SuperAdmins to query specific items without passing businessId.
      if (businessId) {
        where.stockItem = {
          catalogItem: {
            businessId,
          },
        };
      }

      if (stockItemId) {
        if (isNaN(stockItemId)) throw ValidationError(['Invalid stockItemId']);
        where.stockItemId = stockItemId;
      }

      const movements = await prisma.stockMovement.findMany({
        where,
        include: {
          stockItem: {
            include: {
              catalogItem: true,
            },
          },
          orderLine: {
            include: {
              order: true,
            },
          },
        },
        orderBy: { at: 'desc' },
        take: 100,
      });

      res.json(movements);
    } catch (error) {
      next(error);
    }
  }
);

export default router;