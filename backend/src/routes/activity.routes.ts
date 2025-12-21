import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ForbiddenError } from '../middleware/errorHandler';

type ActivityItem = {
  id: string;
  type: 'order' | 'payment' | 'reservation' | 'stock' | 'giftcard' | 'discount';
  occurredAt: string;
  title: string;
  description?: string;
  actorName?: string;
};

const router: Router = Router();

const toNumber = (value: unknown) => {
  if (value && typeof value === 'object' && typeof (value as any).toNumber === 'function') {
    return (value as any).toNumber() as number;
  }
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const businessId = req.user!.role === 'SuperAdmin'
      ? parseInt(req.query.businessId as string)
      : req.user!.businessId;

    if (!businessId) {
      throw ForbiddenError('Business ID required');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const perCategory = Math.min(Math.max(limit * 2, 40), 200);
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

    const [orders, payments, reservations, stockMovements, giftCards, discounts] = await Promise.all([
      prisma.order.findMany({
        where: { businessId },
        include: {
          employee: { select: { name: true } },
          reservation: { select: { customerName: true } },
          payments: { select: { method: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: perCategory,
      }),
      prisma.payment.findMany({
        where: { order: { businessId } },
        include: {
          order: { select: { id: true, employee: { select: { name: true } } } },
          giftCard: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: perCategory,
      }),
      prisma.reservation.findMany({
        where: { businessId },
        include: {
          employee: { select: { name: true } },
        },
        orderBy: { bookedAt: 'desc' },
        take: perCategory,
      }),
      prisma.stockMovement.findMany({
        where: { stockItem: { catalogItem: { businessId } } },
        include: {
          stockItem: {
            include: {
              catalogItem: { select: { name: true } },
            },
          },
          orderLine: {
            select: {
              orderId: true,
              order: { select: { employee: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: perCategory,
      }),
      prisma.giftCard.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: perCategory,
      }),
      prisma.discount.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: perCategory,
      }),
    ]);

    const events: ActivityItem[] = [];

    orders.forEach((order) => {
      // Parse discount snapshot
      let discountAmount = 0;
      if ((order as any).orderDiscountSnapshot) {
        try {
          const discountData = JSON.parse((order as any).orderDiscountSnapshot as string);
          if (discountData.appliedAmount) {
            discountAmount = parseFloat(discountData.appliedAmount);
          }
        } catch {}
      }

      const tipAmount = toNumber((order as any).tipAmount);
      const paymentMethods = Array.from(new Set(order.payments?.map((p) => p.method) ?? []));
      const paymentLabel = paymentMethods.length > 0 ? paymentMethods.join(', ') : undefined;

      events.push({
        id: `order-${order.id}`,
        type: 'order',
        occurredAt: order.createdAt.toISOString(),
        title: `Order #${order.id} opened`,
        description:
          order.tableOrArea
            ? `Table/Area: ${order.tableOrArea}`
            : order.reservation?.customerName
              ? `For reservation: ${order.reservation.customerName}`
              : order.employee?.name
                ? `Created`
                : undefined,
        actorName: order.employee?.name,
      });

      if (order.closedAt) {
        events.push({
          id: `order-closed-${order.id}`,
          type: 'order',
          occurredAt: order.closedAt.toISOString(),
          title: `Order #${order.id} closed`,
          description: `${paymentLabel ? `Handled via ${paymentLabel}` : 'Handled'}${discountAmount > 0 ? ` • Discount €${discountAmount.toFixed(2)}` : ''}${tipAmount > 0 ? ` • Tip €${tipAmount.toFixed(2)}` : ''}`,
          actorName: order.employee?.name,
        });
      }
    });

    payments.forEach((payment) => {
      const amount = toNumber(payment.amount).toFixed(2);
      const tipPortion = toNumber((payment as any).tipPortion);
      events.push({
        id: `payment-${payment.id}`,
        type: 'payment',
        occurredAt: payment.createdAt.toISOString(),
        title: `Payment €${amount}`,
        description: `Order #${payment.order?.id ?? 'N/A'} via ${payment.method}${tipPortion > 0 ? ` • Tip €${tipPortion.toFixed(2)}` : ''}`,
        actorName: payment.order?.employee?.name,
      });
    });

    reservations.forEach((reservation) => {
      events.push({
        id: `reservation-${reservation.id}`,
        type: 'reservation',
        occurredAt: reservation.bookedAt.toISOString(),
        title: `Reservation for ${reservation.customerName}`,
        description: reservation.employee?.name
          ? `Assigned to ${reservation.employee.name}`
          : `Starts ${reservation.appointmentStart.toISOString()}`,
        actorName: reservation.employee?.name,
      });

      if (reservation.status === 'Cancelled') {
        events.push({
          id: `reservation-cancelled-${reservation.id}`,
          type: 'reservation',
          occurredAt: reservation.updatedAt.toISOString(),
          title: `Reservation cancelled (${reservation.customerName})`,
          description: `Cancelled by ${reservation.employee?.name ?? 'unknown'}`,
          actorName: reservation.employee?.name,
        });
      }
      if (reservation.status === 'Expired') {
        events.push({
          id: `reservation-expired-${reservation.id}`,
          type: 'reservation',
          occurredAt: reservation.updatedAt.toISOString(),
          title: `Reservation expired (${reservation.customerName})`,
          description: undefined,
          actorName: reservation.employee?.name,
        });
      }
      if (reservation.status === 'Completed') {
        events.push({
          id: `reservation-completed-${reservation.id}`,
          type: 'reservation',
          occurredAt: reservation.updatedAt.toISOString(),
          title: `Reservation completed (${reservation.customerName})`,
          description: undefined,
          actorName: reservation.employee?.name,
        });
      }
    });

    stockMovements.forEach((movement) => {
      const deltaNumber = toNumber(movement.delta);
      const delta = deltaNumber.toFixed(3);
      events.push({
        id: `stock-${movement.id}`,
        type: 'stock',
        occurredAt: movement.createdAt.toISOString(),
        title: `${movement.type} ${deltaNumber >= 0 ? 'added' : 'removed'}`,
        description: `${movement.stockItem.catalogItem.name} (${delta})${movement.orderLine?.orderId ? ` for Order #${movement.orderLine.orderId}` : ''}${movement.orderLine?.order?.employee?.name ? ` by ${movement.orderLine.order.employee.name}` : ''}`,
        actorName: movement.orderLine?.order?.employee?.name,
      });
    });

    giftCards.forEach((giftCard) => {
      const value = toNumber(giftCard.initialValue).toFixed(2);
      events.push({
        id: `giftcard-${giftCard.id}`,
        type: 'giftcard',
        occurredAt: giftCard.createdAt.toISOString(),
        title: `Gift card ${giftCard.code} issued`,
        description: `Value €${value}${giftCard.expiresAt ? `, expires ${giftCard.expiresAt.toISOString()}` : ''}`,
      });
    });

    discounts.forEach((discount) => {
      events.push({
        id: `discount-${discount.id}`,
        type: 'discount',
        occurredAt: discount.createdAt.toISOString(),
        title: `Discount ${discount.code} created`,
        description: `${discount.type} ${discount.scope}${discount.status ? ` • Status ${discount.status}` : ''}`,
        actorName: undefined,
      });

      if (discount.status && discount.status !== 'Active') {
        events.push({
          id: `discount-status-${discount.id}`,
          type: 'discount',
          occurredAt: discount.updatedAt.toISOString(),
          title: `Discount ${discount.code} deactivated`,
          description: `Status changed to ${discount.status}`,
          actorName: undefined,
        });
      }
    });

    const filtered = events
      .filter((item) => !cursor || new Date(item.occurredAt) < cursor)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    const items = filtered.slice(0, limit);
    const nextCursor = filtered.length > limit ? filtered[limit].occurredAt : undefined;

    res.json({ items, nextCursor });
  } catch (error) {
    next(error);
  }
});

export default router;
