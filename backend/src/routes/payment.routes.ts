import { Router, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ApiError, ForbiddenError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router: Router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Exchange rates cache
let exchangeRatesCache: { rates: { [key: string]: number }; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

const validateRequest = (req: AuthRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map((e: any) => `${e.param}: ${e.msg}`));
  }
  next();
};

// Fetch exchange rates from API with caching
const fetchExchangeRates = async () => {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (exchangeRatesCache && now - exchangeRatesCache.timestamp < CACHE_DURATION) {
    return exchangeRatesCache.rates;
  }

  try {
    // Using exchangerate-api.com free tier (no API key needed for basic usage)
    const response = await fetch('https://open.er-api.com/v6/latest/eur');
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned status ${response.status}`);
    }
    
    const data = (await response.json()) as { rates?: { [key: string]: number } };
    
    if (!data.rates) {
      throw new Error('No rates in API response');
    }
    
    exchangeRatesCache = {
      rates: data.rates,
      timestamp: now,
    };
    return data.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    throw new ApiError(503, 'EXCHANGE_RATE_UNAVAILABLE', 'Could not get the exchange rates');
  }
};

// Get exchange rates endpoint
router.get(
  '/exchange-rates',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rates = await fetchExchangeRates();
      res.json({ rates });
    } catch (error) {
      next(error);
    }
  }
);

// Create payment intent (Stripe)
router.post(
  '/create-intent',
  authenticate,
  [
    body('orderId').isInt(),
    body('amount').isDecimal(),
    body('currency').optional().isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, amount, currency = 'eur' } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      // Safe conversion for Stripe (expects integer cents)
      const amountDecimal = new Decimal(amount);
      const amountCents = amountDecimal.times(100).round().toNumber();

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        metadata: {
          orderId: orderId.toString(),
          businessId: order.businessId.toString(),
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Record payment
router.post(
  '/',
  authenticate,
  [
    body('orderId').isInt(),
    body('amount').isDecimal(),
    body('method').isIn(['Cash', 'CardDebit', 'CardCredit', 'GiftCard']),
    body('tipPortion').optional().isDecimal(),
    body('giftCardId').optional().isInt(),
    body('stripePaymentIntentId').optional().isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, amount, method, tipPortion = 0, giftCardId, stripePaymentIntentId, currency = 'EUR' } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, orderLines: true },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Open') {
        throw new ApiError(403, 'ORDER_NOT_MODIFIABLE', 'Cannot add payment to closed order');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      const amountDecimal = new Decimal(amount);
      const tipDecimal = new Decimal(tipPortion);

      // Handle gift card payment
      if (method === 'GiftCard') {
        if (!giftCardId) {
          throw ValidationError(['Gift card ID required for gift card payments']);
        }

        const giftCard = await prisma.giftCard.findUnique({
          where: { id: giftCardId },
        });

        if (!giftCard) {
          throw NotFoundError('Gift card', giftCardId);
        }

        if (giftCard.status !== 'Active') {
          throw new ApiError(400, 'GIFT_CARD_BLOCKED', 'Gift card is not active');
        }

        if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
          throw new ApiError(400, 'GIFT_CARD_EXPIRED', 'Gift card has expired');
        }

        const currentBalance = new Decimal(giftCard.balance);
        if (currentBalance.lessThan(amountDecimal)) {
          throw new ApiError(400, 'GIFT_CARD_INSUFFICIENT_BALANCE', 'Insufficient gift card balance');
        }

        // Deduct from gift card balance
        await prisma.giftCard.update({
          where: { id: giftCardId },
          data: {
            balance: {
              decrement: amountDecimal,
            },
          },
        });
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: amountDecimal,
          currency,
          method,
          tipPortion: tipDecimal,
          giftCardId,
          stripePaymentIntentId,
        },
      });

      // Update order tip amount
      await prisma.order.update({
        where: { id: orderId },
        data: {
          tipAmount: {
            increment: tipDecimal,
          },
        },
      });

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin'
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      if (!businessId && req.user!.role !== 'SuperAdmin') {
         throw ForbiddenError('Business ID required');
      }

      const payments = await prisma.payment.findMany({
        where: {
          order: {
            businessId,
          },
        },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              employee: {
                select: { name: true }
              }
            }
          },
          giftCard: {
            select: { code: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json(payments);
    } catch (error) {
      next(error);
    }
  }
);

// Get payments for an order
router.get(
  '/order/:orderId',
  authenticate,
  param('orderId').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const orderId = parseInt(req.params.orderId);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      const payments = await prisma.payment.findMany({
        where: { orderId },
        include: { giftCard: true },
        orderBy: { createdAt: 'asc' },
      });

      res.json(payments);
    } catch (error) {
      next(error);
    }
  }
);

// Process refund
router.post(
  '/refund',
  authenticate,
  [
    body('orderId').isInt(),
    body('amount').isDecimal(),
    body('reason').optional().isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { orderId, amount, reason } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          orderLines: {
            include: {
              option: {
                include: {
                  catalogItem: {
                    include: { stockItem: true }
                  }
                }
              }
            }
          }
        },
      });

      if (!order) {
        throw NotFoundError('Order', orderId);
      }

      if (order.status !== 'Closed') {
        throw new ApiError(400, 'INVALID_REFUND', 'Can only refund closed orders');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== order.businessId) {
        throw ForbiddenError('Access denied');
      }

      const totalPaid = order.payments.reduce((sum, p) => sum.plus(new Decimal(p.amount)), new Decimal(0));
      const refundAmount = new Decimal(amount);

      if (refundAmount.greaterThan(totalPaid)) {
        throw new ApiError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount exceeds total paid');
      }

      // Perform refund in transaction to handle payment and inventory restoration
      const result = await prisma.$transaction(async (tx) => {
        // Create negative payment for refund
        const refund = await tx.payment.create({
          data: {
            orderId,
            amount: refundAmount.negated(),
            currency: 'EUR', // Simplified - in practice use order currency
            method: 'Cash', // Default to Cash for refund record, or could match original
            giftCardId: undefined, // Not refunding to gift card logic here for simplicity
          },
        });

        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'Refunded' },
        });

        // Restore stock for items
        for (const line of order.orderLines) {
          const stockItem = line.option?.catalogItem?.stockItem;
          
          if (stockItem) {
            const qty = new Decimal(line.qty);
            
            // Record stock movement
            await tx.stockMovement.create({
              data: {
                stockItemId: stockItem.id,
                orderLineId: line.id,
                type: 'Return', // Using 'Return' to signify restoration
                delta: qty, // Positive delta adds back to stock
                unitCostSnapshot: stockItem.averageUnitCost,
                notes: `Refund for Order #${orderId} - ${reason || 'Manual refund'}`,
              }
            });

            // Increment stock quantity
            await tx.stockItem.update({
              where: { id: stockItem.id },
              data: {
                qtyOnHand: {
                  increment: qty,
                },
              },
            });
          }
        }

        return refund;
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;