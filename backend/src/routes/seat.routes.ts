import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validationResult } from 'express-validator';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';

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
  [query('businessId').isInt()],
  validateRequest,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = parseInt(req.query.businessId as string);

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Access denied');
      }

      const seats = await (prisma as any).seat.findMany({
        where: { businessId, status: 'Active' },
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

      const seat = await (prisma as any).seat.create({
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
      const seat = await (prisma as any).seat.findUnique({ where: { id } });
      if (!seat) throw NotFoundError('Seat', id);
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== seat.businessId) {
        throw ForbiddenError('Access denied');
      }
      const updated = await (prisma as any).seat.update({ where: { id }, data: { status: 'Inactive' } });
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
      const seat = await (prisma as any).seat.findUnique({ where: { id } });
      if (!seat) throw NotFoundError('Seat', id);
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== seat.businessId) {
        throw ForbiddenError('Access denied');
      }
      await (prisma as any).seat.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
