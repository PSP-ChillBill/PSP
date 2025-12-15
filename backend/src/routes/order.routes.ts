import { Router } from 'express';
import { body, param } from 'express-validator';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ApiError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Helper to get current tax rate
async function getCurrentTaxRate(countryCode: string, taxClass: string): Promise<Decimal> {
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

  return taxRule ? taxRule.ratePercent : new Decimal(0);
}

// Create order
router.post(
  '/',
  authenticate,
  [
    body('businessId').isInt(),
    body('reservationId').optional().isInt(),
    body('tableOrArea').optional().isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, reservationId, tableOrArea } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create order for another business');
      }

      const order = await prisma.order.create({
        data: {
          businessId,
          employeeId: req.user!.id,
          reservationId,
          tableOrArea,
          status: 'Open',
        },
        include: {
          orderLines: true,
          payments: true,
        },
      });

      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Get orders
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

      const orders = await prisma.order.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true } },
          orderLines: {
            include: {
              option: {
                include: {
                  catalogItem: true,
                },
              },
            },
          },
          payments: true,
          reservation: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(orders);
    } catch (error) {
      next(error);
    }
  }
);

// Get order by ID
router.get(
  '/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          employee: true,
          orderLines: {
            include: {
              option: {
                include: {
                  catalogItem: true,
                },
              },
            },
          },
          payments: true,
          reservation: true,
          discount: true,
        },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Add order line
router.post(
  '/:id/lines',
  authenticate,
  [
    param('id').isInt(),
    body('optionId').optional().isInt(),
    body('catalogItemId').optional().isInt(),
    body('qty').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);
      const { optionId, catalogItemId, qty } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { business: true },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed or cancelled order');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      // If optionId provided, use option path
      if (optionId) {
        const option = await prisma.option.findUnique({
          where: { id: optionId },
          include: { catalogItem: true },
        });

        if (!option) {
          throw NotFoundError('Option', optionId);
        }

        // Get current tax rate
        const taxRate = await getCurrentTaxRate(order.business.countryCode, option.catalogItem.taxClass);

        // Calculate unit price safely using Decimal
        const basePrice = new Decimal(option.catalogItem.basePrice);
        const priceModifier = new Decimal(option.priceModifier);
        const unitPrice = basePrice.plus(priceModifier);
        const quantity = new Decimal(qty);

        const orderLine = await prisma.orderLine.create({
          data: {
            orderId,
            optionId,
            itemNameSnapshot: option.catalogItem.name,
            optionNameSnapshot: option.name,
            qty: quantity,
            unitPriceSnapshot: unitPrice,
            taxClassSnapshot: option.catalogItem.taxClass,
            taxRateSnapshotPct: taxRate,
          },
        });

        res.status(201).json(orderLine);
        return;
      }

      // If catalogItemId provided (item without options), create line from catalog item
      if (catalogItemId) {
        const catalogItem = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
        if (!catalogItem) {
          throw NotFoundError('CatalogItem', catalogItemId);
        }

        const taxRate = await getCurrentTaxRate(order.business.countryCode, catalogItem.taxClass);

        const basePrice = new Decimal(catalogItem.basePrice);
        const quantity = new Decimal(qty);

        const orderLine = await prisma.orderLine.create({
          data: {
            orderId,
            optionId: null,
            itemNameSnapshot: catalogItem.name,
            optionNameSnapshot: null,
            qty: quantity,
            unitPriceSnapshot: basePrice,
            taxClassSnapshot: catalogItem.taxClass,
            taxRateSnapshotPct: taxRate,
          },
        });

        res.status(201).json(orderLine);
        return;
      }

      throw ValidationError(['optionId or catalogItemId is required']);
    } catch (error) {
      next(error);
    }
  }
);

// Update order line quantity
router.put(
  '/:id/lines/:lineId',
  authenticate,
  [
    param('id').isInt(),
    param('lineId').isInt(),
    body('qty').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);
      const lineId = parseInt(req.params.lineId);
      const { qty } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed or cancelled order');
      }

      const orderLine = await prisma.orderLine.update({
        where: { id: lineId },
        data: { qty: new Decimal(qty) },
      });

      res.json(orderLine);
    } catch (error) {
      next(error);
    }
  }
);

// Delete order line
router.delete(
  '/:id/lines/:lineId',
  authenticate,
  [
    param('id').isInt(),
    param('lineId').isInt(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);
      const lineId = parseInt(req.params.lineId);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed or cancelled order');
      }

      await prisma.orderLine.delete({
        where: { id: lineId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Apply discount to order
router.post(
  '/:id/discount',
  authenticate,
  [
    param('id').isInt(),
    body('discountId').isInt(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);
      const { discountId } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed order');
      }

      const discount = await prisma.discount.findUnique({
        where: { id: discountId },
      });

      if (!discount || discount.status !== 'Active') {
        throw NotFoundError('Discount', discountId);
      }

      // Check if discount is valid for the time
      const now = new Date();
      if (discount.startsAt > now || (discount.endsAt && discount.endsAt < now)) {
        throw new ApiError(400, 'INVALID_DISCOUNT', 'Discount is not currently valid');
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          discountId,
          orderDiscountSnapshot: JSON.stringify({
            code: discount.code,
            type: discount.type,
            value: discount.value,
            scope: discount.scope,
          }),
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Close order
router.post(
  '/:id/close',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, orderLines: true },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(400, 'INVALID_OPERATION', 'Order is already closed or cancelled');
      }

      // Calculate totals using Decimal arithmetic
      const orderLinesTotal = order.orderLines.reduce((sum, line) => {
        const unitPrice = new Decimal(line.unitPriceSnapshot);
        const qty = new Decimal(line.qty);
        const taxRate = new Decimal(line.taxRateSnapshotPct);
        
        const lineTotal = unitPrice.times(qty);
        const lineTax = lineTotal.times(taxRate).div(100);
        return sum.plus(lineTotal).plus(lineTax);
      }, new Decimal(0));

      const paymentsTotal = order.payments.reduce((sum, payment) => {
        return sum.plus(new Decimal(payment.amount));
      }, new Decimal(0));

      // Use precision safe comparison
      if (paymentsTotal.lessThan(orderLinesTotal)) {
        throw new ApiError(400, 'INSUFFICIENT_PAYMENT', 'Payment amount is less than order total');
      }

      const closed = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'Closed',
          closedAt: new Date(),
        },
      });

      // Process stock movements for products
      for (const line of order.orderLines) {
        const option = await prisma.option.findUnique({
          where: { id: line.optionId! },
          include: {
            catalogItem: {
              include: { stockItem: true },
            },
          },
        });

        if (option?.catalogItem.stockItem) {
          const stockItem = option.catalogItem.stockItem;
          // Exact arithmetic for stock movement
          const qty = new Decimal(line.qty);
          const qtyDelta = qty.negated();

          await prisma.$transaction([
            prisma.stockMovement.create({
              data: {
                stockItemId: stockItem.id,
                orderLineId: line.id,
                type: 'Sale',
                delta: qtyDelta,
                unitCostSnapshot: stockItem.averageUnitCost,
              },
            }),
            prisma.stockItem.update({
              where: { id: stockItem.id },
              data: {
                qtyOnHand: {
                  decrement: qty,
                },
              },
            }),
          ]);
        }
      }

      res.json(closed);
    } catch (error) {
      next(error);
    }
  }
);

export default router;