import { Router, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ApiError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router: Router = Router();

const validateRequest = (req: AuthRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map((e: any) => `${e.path || e.param}: ${e.msg}`));
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
          discount: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Add calculated discount amounts
      const ordersWithDiscounts = orders.map(order => {
        let discountAmount = 0;
        
        if (order.discountId && order.orderDiscountSnapshot) {
          try {
            const discountData = JSON.parse(order.orderDiscountSnapshot as string);
            if (discountData.appliedAmount) {
              discountAmount = parseFloat(discountData.appliedAmount);
            }
          } catch (e) {
            // If parsing fails, discountAmount stays 0
          }
        }

        return {
          ...order,
          discountAmount,
        };
      });

      res.json(ordersWithDiscounts);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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

      // Add calculated discount amount
      let discountAmount = 0;
      if (order.discountId && order.orderDiscountSnapshot) {
        try {
          const discountData = JSON.parse(order.orderDiscountSnapshot as string);
          if (discountData.appliedAmount) {
            discountAmount = parseFloat(discountData.appliedAmount);
          }
        } catch (e) {
          // If parsing fails, discountAmount stays 0
        }
      }

      const response = {
        ...order,
        discountAmount,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Generate receipt
router.get(
  '/:id/receipt',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          business: true,
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
        },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      // Calculate totals
      const lines = order.orderLines.map(line => {
        const unitPrice = new Decimal(line.unitPriceSnapshot);
        const qty = new Decimal(line.qty);
        const taxRate = new Decimal(line.taxRateSnapshotPct);
        
        const lineBase = unitPrice.times(qty);
        const lineTax = lineBase.times(taxRate).div(100);
        const lineTotal = lineBase.plus(lineTax);

        return {
          name: `${line.itemNameSnapshot}${line.optionNameSnapshot && line.optionNameSnapshot !== 'Standard' ? ` (${line.optionNameSnapshot})` : ''}`,
          qty: qty.toNumber(),
          price: unitPrice.toNumber(),
          total: lineTotal.toNumber(),
        };
      });

      const totalAmountWithoutTip = lines.reduce((sum, line) => sum + line.total, 0);
      // Apply discount snapshot if present
      let discountAmount = 0;
      if (order.discountId && order.orderDiscountSnapshot) {
        try {
          const discountData = JSON.parse(order.orderDiscountSnapshot as string);
          if (discountData.appliedAmount) {
            discountAmount = parseFloat(discountData.appliedAmount);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      const tipAmount = parseFloat(order.tipAmount.toString());
      const totalAmount = Math.max(0, totalAmountWithoutTip - discountAmount) + tipAmount;
      const totalPaid = order.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const change = Math.max(0, totalPaid - totalAmount);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Receipt #${order.id}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 10px 0; color: #000; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .item { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .totals { margin-top: 8px; }
            .row { display: flex; justify-content: space-between; }
            .header { margin-bottom: 10px; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="text-center header">
            <div class="bold" style="font-size: 16px;">${order.business.name}</div>
            ${order.business.address ? `<div>${order.business.address}</div>` : ''}
            ${order.business.phone ? `<div>Tel: ${order.business.phone}</div>` : ''}
            ${order.business.email ? `<div>${order.business.email}</div>` : ''}
          </div>
          
          <div class="line"></div>
          
          <div>
            <div>Order: #${order.id}</div>
            <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
            <div>Server: ${order.employee?.name || 'Staff'}</div>
            ${order.tableOrArea ? `<div>Table: ${order.tableOrArea}</div>` : ''}
          </div>
          
          <div class="line"></div>
          
          <div>
            ${lines.map(line => `
              <div class="item">
                <span>${line.qty}x ${line.name}</span>
                <span>${line.total.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="line"></div>
          
          <div class="totals">
            <div class="row bold" style="font-size: 14px;">
              <span>TOTAL</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            ${discountAmount > 0 ? `
              <div class="row">
                <span>Discount</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${tipAmount > 0 ? `
              <div class="row">
                <span>Tip</span>
                <span>${tipAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${order.payments.length > 0 ? `
              <div class="line" style="margin: 4px 0; border-bottom-style: dotted;"></div>
              ${order.payments.map(p => `
                <div class="row">
                  <span>${p.method}</span>
                  <span>${p.amount.toNumber().toFixed(2)}</span>
                </div>
              `).join('')}
              <div class="row">
                <span>Change</span>
                <span>${change.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="line"></div>
          
          <div class="text-center">
            Thank you!
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
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
    body('optionId').isInt(),
    body('qty').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);
      const { optionId, qty } = req.body;

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

      // Get option and catalog item
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
  '/:id/apply-discount',
  authenticate,
  [
    param('id').isInt(),
    body('discountCode').notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);
      const { discountCode } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderLines: {
            include: {
              option: {
                include: {
                  catalogItem: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed order');
      }

      // Find discount by code and business
      const discount = await prisma.discount.findUnique({
        where: {
          businessId_code: {
            businessId: order.businessId,
            code: discountCode,
          },
        },
        include: {
          eligibilities: true,
        },
      });

      if (!discount || discount.status !== 'Active') {
        throw new ApiError(404, 'DISCOUNT_NOT_FOUND', 'Discount code not found or inactive');
      }

      // Check if discount is valid for the time
      const now = new Date();
      if (discount.startsAt > now || (discount.endsAt && discount.endsAt < now)) {
        throw new ApiError(400, 'INVALID_DISCOUNT', 'Discount is not currently valid');
      }

      // Calculate order total before discount
      const orderTotal = order.orderLines.reduce((sum, line) => {
        const unitPrice = new Decimal(line.unitPriceSnapshot);
        const qty = new Decimal(line.qty);
        const taxRate = new Decimal(line.taxRateSnapshotPct);
        const lineBase = unitPrice.times(qty);
        const lineTax = lineBase.times(taxRate).div(100);
        return sum.plus(lineBase).plus(lineTax);
      }, new Decimal(0));

      // Calculate discount amount
      let discountAmount = new Decimal(0);

      if (discount.scope === 'Order') {
        // Apply discount to entire order
        if (discount.type === 'Percent') {
          discountAmount = orderTotal.times(discount.value).div(100);
        } else {
          // Amount type
          discountAmount = new Decimal(discount.value);
        }
      } else if (discount.scope === 'Line') {
        // Apply discount to eligible line items only
        const eligibleItemIds = discount.eligibilities.map(e => e.catalogItemId);
        
        // Check if any eligible items exist in order
        const hasEligibleItems = order.orderLines.some(line => {
          const catalogItemId = line.option?.catalogItem?.id;
          return catalogItemId && (eligibleItemIds.includes(catalogItemId) || eligibleItemIds.includes(line.optionId!));
        });

        if (!hasEligibleItems) {
          throw new ApiError(400, 'DISCOUNT_NOT_APPLICABLE', 'This discount does not apply to any items in this order');
        }

        // Calculate discount for eligible items
        order.orderLines.forEach(line => {
          const catalogItemId = line.option?.catalogItem?.id;
          const isEligible = catalogItemId && (eligibleItemIds.includes(catalogItemId) || eligibleItemIds.includes(line.optionId!));
          if (isEligible) {
            const unitPrice = new Decimal(line.unitPriceSnapshot);
            const qty = new Decimal(line.qty);
            const lineTotal = unitPrice.times(qty);
            
            if (discount.type === 'Percent') {
              discountAmount = discountAmount.plus(lineTotal.times(discount.value).div(100));
            } else {
              discountAmount = discountAmount.plus(discount.value);
            }
          }
        });
      }

      // Ensure discount doesn't exceed order total
      if (discountAmount.greaterThan(orderTotal)) {
        discountAmount = orderTotal;
      }

      // Update order with discount
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          discountId: discount.id,
          orderDiscountSnapshot: JSON.stringify({
            code: discount.code,
            type: discount.type,
            value: discount.value.toString(),
            scope: discount.scope,
            appliedAmount: discountAmount.toString(),
          }),
        },
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
          discount: true,
        },
      });

      // Add discountAmount to response
      const response = {
        ...updated,
        discountAmount: discountAmount.toNumber(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Remove discount from order
router.delete(
  '/:id/discount',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed order');
      }

      // Remove discount from order
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          discountId: null,
          orderDiscountSnapshot: null,
        },
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
          discount: true,
        },
      });

      // Add discountAmount to response (0 since discount removed)
      const response = {
        ...updated,
        discountAmount: 0,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Set or update tip amount for an order (before payments)
router.put(
  '/:id/tip',
  authenticate,
  [
    param('id').isInt(),
    body('amount').isDecimal(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);
      const { amount } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot modify closed order');
      }

      // Authorization: same business unless SuperAdmin
      // Note: authenticate middleware populates req.user
      // @ts-ignore
      const user = (req as AuthRequest).user!;
      if (user.role !== 'SuperAdmin' && user.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { tipAmount: new Decimal(amount) },
        include: {
          employee: { select: { id: true, name: true } },
          orderLines: {
            include: {
              option: { include: { catalogItem: true } },
            },
          },
          payments: true,
          discount: true,
        },
      });

      // Add discountAmount to response for frontend consistency
      let discountAmount = 0;
      if (updated.discountId && updated.orderDiscountSnapshot) {
        try {
          const discountData = JSON.parse(updated.orderDiscountSnapshot as string);
          if (discountData.appliedAmount) {
            discountAmount = parseFloat(discountData.appliedAmount);
          }
        } catch {}
      }

      res.json({ ...updated, discountAmount });
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      let orderLinesTotal = order.orderLines.reduce((sum, line) => {
        const unitPrice = new Decimal(line.unitPriceSnapshot);
        const qty = new Decimal(line.qty);
        const taxRate = new Decimal(line.taxRateSnapshotPct);
        
        const lineTotal = unitPrice.times(qty);
        const lineTax = lineTotal.times(taxRate).div(100);
        return sum.plus(lineTotal).plus(lineTax);
      }, new Decimal(0));

      // Subtract discount if applied
      let discountAmount = new Decimal(0);
      if (order.discountId && order.orderDiscountSnapshot) {
        try {
          const discountData = JSON.parse(order.orderDiscountSnapshot as string);
          if (discountData.appliedAmount) {
            discountAmount = new Decimal(discountData.appliedAmount);
            orderLinesTotal = orderLinesTotal.minus(discountAmount);
          }
        } catch (e) {
          // If parsing fails, continue without discount
        }
      }

      // Add tip amount
      const tipAmount = new Decimal(order.tipAmount);
      const grandTotal = orderLinesTotal.plus(tipAmount);

      const paymentsTotal = order.payments.reduce((sum, payment) => {
        return sum.plus(new Decimal(payment.amount));
      }, new Decimal(0));

      // Use precision safe comparison
      if (paymentsTotal.lessThan(grandTotal)) {
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

router.post(
  '/:id/cancel',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(400, 'INVALID_OPERATION', 'Only open orders can be cancelled');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      if (order.payments.length > 0) {
        throw new ApiError(400, 'ORDER_HAS_PAYMENTS', 'Cannot cancel an order with existing payments. Please refund instead.');
      }

      const cancelledOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'Cancelled',
        },
      });

      res.json(cancelledOrder);
    } catch (error) {
      next(error);
    }
  }
);

// Update order (e.g., table assignment)
router.put(
  '/:id',
  authenticate,
  [
    param('id').isInt(),
    body('tableOrArea').optional({ nullable: true }).isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id);
      const { tableOrArea } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      // Authorization check
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Cannot update order for another business');
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          tableOrArea: tableOrArea || null,
        },
        include: {
          employee: { select: { id: true, name: true } },
          orderLines: {
            include: {
              option: { include: { catalogItem: true } },
            },
          },
          payments: true,
          discount: true,
        },
      });

      res.json(updatedOrder);
    } catch (error) {
      next(error);
    }
  }
);

export default router;