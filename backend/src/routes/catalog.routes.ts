import { Router } from 'express';
import { body, param } from 'express-validator';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Create category
router.post(
  '/categories',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('businessId').isInt(),
    body('name').notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, name, description, sortOrder } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create category for another business');
      }

      const category = await prisma.category.create({
        data: { businessId, name, description, sortOrder: sortOrder || 0 },
      });

      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }
);

// Get categories
router.get(
  '/categories',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin' 
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      const categories = await prisma.category.findMany({
        where: { businessId },
        include: {
          _count: { select: { catalogItems: true } },
        },
        orderBy: { sortOrder: 'asc' },
      });

      res.json(categories);
    } catch (error) {
      next(error);
    }
  }
);

// Create catalog item
router.post(
  '/items',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('businessId').isInt(),
    body('name').notEmpty(),
    body('code').notEmpty(),
    body('type').isIn(['Product', 'Service']),
    body('basePrice').isDecimal(),
    body('taxClass').notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, categoryId, name, code, type, basePrice, taxClass, description, defaultDurationMin, options } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create item for another business');
      }

      // Check for duplicate code
      const existing = await prisma.catalogItem.findUnique({
        where: { businessId_code: { businessId, code } },
      });

      if (existing) {
        throw ConflictError('DUPLICATE_CODE', 'Catalog item with this code already exists');
      }

      const item = await prisma.catalogItem.create({
        data: {
          businessId,
          categoryId,
          name,
          code,
          type,
          basePrice: new Decimal(basePrice),
          taxClass,
          description,
          defaultDurationMin,
          status: 'Active',
        },
      });

      // Create options if provided
      if (options && options.length > 0) {
        await prisma.option.createMany({
          data: options.map((opt: any, index: number) => ({
            catalogItemId: item.id,
            name: opt.name,
            priceModifier: new Decimal(opt.priceModifier || 0),
            sortOrder: opt.sortOrder || index,
          })),
        });
      }

      const fullItem = await prisma.catalogItem.findUnique({
        where: { id: item.id },
        include: { options: true, category: true },
      });

      res.status(201).json(fullItem);
    } catch (error) {
      next(error);
    }
  }
);

// Get catalog items
router.get(
  '/items',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin'
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;

      const where: any = { businessId };
      if (type) where.type = type;
      if (status) where.status = status;

      const items = await prisma.catalogItem.findMany({
        where,
        include: {
          category: true,
          options: { orderBy: { sortOrder: 'asc' } },
          stockItem: true,
        },
        orderBy: { name: 'asc' },
      });

      res.json(items);
    } catch (error) {
      next(error);
    }
  }
);

// Get catalog item by ID
router.get(
  '/items/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const itemId = parseInt(req.params.id);

      const item = await prisma.catalogItem.findUnique({
        where: { id: itemId },
        include: {
          category: true,
          options: { orderBy: { sortOrder: 'asc' } },
          stockItem: true,
          serviceEmployees: { include: { employee: true } },
        },
      });

      if (!item) {
        throw NotFoundError('Catalog item', itemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== item.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update catalog item
router.put(
  '/items/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const itemId = parseInt(req.params.id);

      const item = await prisma.catalogItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw NotFoundError('Catalog item', itemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== item.businessId) {
        throw ForbiddenError('Cannot update item from another business');
      }

      const updated = await prisma.catalogItem.update({
        where: { id: itemId },
        data: req.body,
        include: { options: true, category: true },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Create option for catalog item
router.post(
  '/options',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('catalogItemId').isInt(),
    body('name').notEmpty(),
    body('priceModifier').optional().isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { catalogItemId, name, priceModifier = 0, sortOrder = 0 } = req.body;

      const item = await prisma.catalogItem.findUnique({
        where: { id: catalogItemId },
      });

      if (!item) {
        throw NotFoundError('Catalog item', catalogItemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== item.businessId) {
        throw ForbiddenError('Cannot create option for another business');
      }

      const option = await prisma.option.create({
        data: {
          catalogItemId,
          name,
          priceModifier: new Decimal(priceModifier),
          sortOrder,
        },
      });

      res.status(201).json(option);
    } catch (error) {
      next(error);
    }
  }
);

// Assign employee to service
router.post(
  '/items/:id/employees',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    param('id').isInt(),
    body('employeeId').isInt(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const itemId = parseInt(req.params.id);
      const { employeeId } = req.body;

      const item = await prisma.catalogItem.findUnique({
        where: { id: itemId },
      });

      if (!item || item.type !== 'Service') {
        throw NotFoundError('Service', itemId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== item.businessId) {
        throw ForbiddenError('Access denied');
      }

      const assignment = await prisma.serviceEmployee.create({
        data: { catalogItemId: itemId, employeeId },
      });

      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  }
);

export default router;