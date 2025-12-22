import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';

const router: Router = Router();

const validateRequest = (req: AuthRequest, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map((e: any) => `${e.param}: ${e.msg}`));
  }
  next();
};

// List seats for a business
router.get(
  '/',
  authenticate,
  [query('businessId').isInt(), query('includeInactive').optional().isBoolean()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = parseInt(req.query.businessId as string);
      const includeInactive = (req.query.includeInactive as string) === 'true';

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Access denied');
      }

      const where: any = { businessId };
      if (!includeInactive) where.status = 'Active';

      const seats = await prisma.seat.findMany({
        where,
        orderBy: [{ name: 'asc' }],
      });
      res.json(seats);
    } catch (err) {
      next(err);
    }
  }
);

// Create a seat (Manager/Owner/SuperAdmin)
router.post(
  '/',
  authenticate,
  authorize('Manager', 'Owner', 'SuperAdmin'),
  [
    body('businessId').isInt(),
    body('name').isString().notEmpty(),
    body('capacity').optional().isInt({ min: 1 }),
  ],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { businessId, name, capacity } = req.body;

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create seat for another business');
      }

      const seat = await prisma.seat.create({
        data: { businessId, name, capacity: capacity ?? 1 },
      });
      res.status(201).json(seat);
    } catch (err) {
      next(err);
    }
  }
);

// Soft-deactivate a seat
router.post(
  '/:id/deactivate',
  authenticate,
  authorize('Manager', 'Owner', 'SuperAdmin'),
  [param('id').isInt()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const seat = await prisma.seat.findUnique({ where: { id } });
      if (!seat) throw NotFoundError('Seat', id);
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== seat.businessId) {
        throw ForbiddenError('Access denied');
      }
      const updated = await prisma.seat.update({ where: { id }, data: { status: 'Inactive' } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Activate a seat
router.post(
  '/:id/activate',
  authenticate,
  authorize('Manager', 'Owner', 'SuperAdmin'),
  [param('id').isInt()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const seat = await prisma.seat.findUnique({ where: { id } });
      if (!seat) throw NotFoundError('Seat', id);
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== seat.businessId) {
        throw ForbiddenError('Access denied');
      }
      const updated = await prisma.seat.update({ where: { id }, data: { status: 'Active' } });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Delete a seat
router.delete(
  '/:id',
  authenticate,
  authorize('Manager', 'Owner', 'SuperAdmin'),
  [param('id').isInt()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      const seat = await prisma.seat.findUnique({ 
        where: { id },
        include: { _count: { select: { reservations: true } } }
      });

      if (!seat) throw NotFoundError('Seat', id);
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== seat.businessId) {
        throw ForbiddenError('Access denied');
      }
      await prisma.seat.delete({ where: { id } });
      
      if (seat._count.reservations > 0) {
        throw ConflictError('Cannot delete seat with reservation history. Use deactivate instead.', 'SEAT_HAS_HISTORY');
      }
      
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
