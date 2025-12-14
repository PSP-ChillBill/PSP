import { Router } from 'express';
import { body, param } from 'express-validator';
import Stripe from 'stripe';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ApiError, ForbiddenError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

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
  async (req: AuthRequest, res, next) => {
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

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
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
  async (req: AuthRequest, res, next) => {
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

        if (parseFloat(giftCard.balance.toString()) < parseFloat(amount)) {
          throw new ApiError(400, 'GIFT_CARD_INSUFFICIENT_BALANCE', 'Insufficient gift card balance');
        }

        // Deduct from gift card balance
        await prisma.giftCard.update({
          where: { id: giftCardId },
          data: {
            balance: {
              decrement: parseFloat(amount),
            },
          },
        });
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount: parseFloat(amount),
          currency,
          method,
          tipPortion: parseFloat(tipPortion.toString()),
          giftCardId,
          stripePaymentIntentId,
        },
      });

      // Update order tip amount
      await prisma.order.update({
        where: { id: orderId },
        data: {
          tipAmount: {
            increment: parseFloat(tipPortion.toString()),
          },
        },
      });

      res.status(201).json(payment);
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
  async (req: AuthRequest, res, next) => {
    try {
      const { orderId, amount, reason } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
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

      const totalPaid = order.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
      const refundAmount = parseFloat(amount);

      if (refundAmount > totalPaid) {
        throw new ApiError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount exceeds total paid');
      }

      // Create negative payment for refund
      const refund = await prisma.payment.create({
        data: {
          orderId,
          amount: -refundAmount,
          currency: 'EUR',
          method: 'Cash', // Simplified - in practice, match original payment method
        },
      });

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'Refunded' },
      });

      res.status(201).json(refund);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
