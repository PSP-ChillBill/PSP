import { Router } from 'express';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError, ApiError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Check for reservation conflicts
async function checkReservationConflict(
  businessId: number,
  employeeId: number | null,
  appointmentStart: Date,
  appointmentEnd: Date,
  excludeReservationId?: number
) {
  const where: any = {
    businessId,
    status: 'Booked',
    OR: [
      {
        appointmentStart: { lte: appointmentStart },
        appointmentEnd: { gt: appointmentStart },
      },
      {
        appointmentStart: { lt: appointmentEnd },
        appointmentEnd: { gte: appointmentEnd },
      },
      {
        appointmentStart: { gte: appointmentStart },
        appointmentEnd: { lte: appointmentEnd },
      },
    ],
  };

  if (employeeId) {
    where.employeeId = employeeId;
  }

  if (excludeReservationId) {
    where.id = { not: excludeReservationId };
  }

  const conflict = await prisma.reservation.findFirst({ where });
  return !!conflict;
}

// Create reservation
router.post(
  '/',
  authenticate,
  [
    body('businessId').isInt(),
    body('customerName').notEmpty(),
    body('appointmentStart').isISO8601(),
    body('plannedDurationMin').isInt(),
    body('services').isArray(),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, employeeId, customerName, customerEmail, customerPhone, appointmentStart, plannedDurationMin, tableOrArea, notes, services } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create reservation for another business');
      }

      const start = new Date(appointmentStart);
      const end = new Date(start.getTime() + plannedDurationMin * 60000);

      // Check for conflicts
      const hasConflict = await checkReservationConflict(businessId, employeeId, start, end);
      if (hasConflict) {
        throw ConflictError('RESERVATION_TIME_UNAVAILABLE', 'Selected time slot is not available');
      }

      const reservation = await prisma.reservation.create({
        data: {
          businessId,
          employeeId,
          customerName,
          customerEmail,
          customerPhone,
          appointmentStart: start,
          appointmentEnd: end,
          plannedDurationMin,
          tableOrArea,
          notes,
          status: 'Booked',
        },
      });

      // Add services
      if (services && services.length > 0) {
        await prisma.reservationService.createMany({
          data: services.map((s: any) => ({
            reservationId: reservation.id,
            catalogItemId: s.catalogItemId,
            quantity: s.quantity || 1,
          })),
        });
      }

      const fullReservation = await prisma.reservation.findUnique({
        where: { id: reservation.id },
        include: {
          employee: true,
          services: {
            include: { catalogItem: true },
          },
        },
      });

      res.status(201).json(fullReservation);
    } catch (error) {
      next(error);
    }
  }
);

// Get reservations
router.get(
  '/',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const businessId = req.user!.role === 'SuperAdmin'
        ? parseInt(req.query.businessId as string)
        : req.user!.businessId!;

      const status = req.query.status as string | undefined;
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const where: any = { businessId };
      if (status) where.status = status;
      if (employeeId) where.employeeId = employeeId;
      
      if (startDate || endDate) {
        where.appointmentStart = {};
        if (startDate) where.appointmentStart.gte = new Date(startDate);
        if (endDate) where.appointmentStart.lte = new Date(endDate);
      }

      const reservations = await prisma.reservation.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true } },
          services: {
            include: { catalogItem: true },
          },
        },
        orderBy: { appointmentStart: 'asc' },
      });

      res.json(reservations);
    } catch (error) {
      next(error);
    }
  }
);

// Get reservation by ID
router.get(
  '/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const reservationId = parseInt(req.params.id);

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          employee: true,
          services: {
            include: { catalogItem: true },
          },
          order: true,
        },
      });

      if (!reservation) {
        throw NotFoundError('Reservation', reservationId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== reservation.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(reservation);
    } catch (error) {
      next(error);
    }
  }
);

// Update reservation
router.put(
  '/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const reservationId = parseInt(req.params.id);
      const { appointmentStart, plannedDurationMin, employeeId, status } = req.body;

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw NotFoundError('Reservation', reservationId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== reservation.businessId) {
        throw ForbiddenError('Cannot update reservation from another business');
      }

      // If changing time or employee, check for conflicts
      if (appointmentStart || plannedDurationMin || employeeId) {
        const start = appointmentStart ? new Date(appointmentStart) : reservation.appointmentStart;
        const duration = plannedDurationMin || reservation.plannedDurationMin;
        const end = new Date(start.getTime() + duration * 60000);
        const empId = employeeId !== undefined ? employeeId : reservation.employeeId;

        const hasConflict = await checkReservationConflict(
          reservation.businessId,
          empId,
          start,
          end,
          reservationId
        );

        if (hasConflict) {
          throw ConflictError('RESERVATION_TIME_UNAVAILABLE', 'Selected time slot is not available');
        }

        if (appointmentStart || plannedDurationMin) {
          req.body.appointmentEnd = end;
        }
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: req.body,
        include: {
          employee: true,
          services: {
            include: { catalogItem: true },
          },
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Cancel reservation
router.post(
  '/:id/cancel',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const reservationId = parseInt(req.params.id);

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw NotFoundError('Reservation', reservationId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== reservation.businessId) {
        throw ForbiddenError('Cannot cancel reservation from another business');
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'Cancelled' },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Complete reservation
router.post(
  '/:id/complete',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const reservationId = parseInt(req.params.id);

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw NotFoundError('Reservation', reservationId);
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== reservation.businessId) {
        throw ForbiddenError('Access denied');
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: 'Completed' },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
