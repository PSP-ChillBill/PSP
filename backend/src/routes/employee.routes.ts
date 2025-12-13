import { Router } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError, ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler';
import { validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: AuthRequest, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError(errors.array().map(e => `${e.param}: ${e.msg}`));
  }
  next();
};

// Create employee
router.post(
  '/',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  [
    body('businessId').isInt().withMessage('Business ID is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['Owner', 'Manager', 'Staff']).withMessage('Valid role required'),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const { businessId, email, name, role } = req.body;

      // Check permissions
      if (req.user!.role === 'Manager' && role !== 'Staff') {
        throw ForbiddenError('Managers can only create Staff accounts');
      }

      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== businessId) {
        throw ForbiddenError('Cannot create employee for another business');
      }

      // Check for duplicate email
      const existing = await prisma.employee.findUnique({
        where: { email },
      });

      if (existing) {
        throw ConflictError('DUPLICATE_EMAIL', 'Employee with this email already exists');
      }

      const employee = await prisma.employee.create({
        data: {
          businessId,
          email,
          name,
          role,
          status: 'Active',
        },
      });

      res.status(201).json(employee);
    } catch (error) {
      next(error);
    }
  }
);

// Get all employees for a business
router.get(
  '/',
  authenticate,
  query('businessId').optional().isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      let businessId: number | undefined;

      if (req.user!.role === 'SuperAdmin') {
        businessId = req.query.businessId ? parseInt(req.query.businessId as string) : undefined;
      } else {
        businessId = req.user!.businessId!;
      }

      const where: any = businessId ? { businessId } : {};

      const employees = await prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      res.json(employees);
    } catch (error) {
      next(error);
    }
  }
);

// Get employee by ID
router.get(
  '/:id',
  authenticate,
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const employeeId = parseInt(req.params.id);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { business: true },
      });

      if (!employee) {
        throw NotFoundError('Employee', employeeId);
      }

      // Check access
      if (req.user!.role !== 'SuperAdmin' && req.user!.businessId !== employee.businessId) {
        throw ForbiddenError('Access denied');
      }

      res.json(employee);
    } catch (error) {
      next(error);
    }
  }
);

// Update employee
router.put(
  '/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  param('id').isInt(),
  [
    body('name').optional().notEmpty(),
    body('role').optional().isIn(['Owner', 'Manager', 'Staff']),
    body('status').optional().isIn(['Active', 'OnLeave', 'Terminated']),
  ],
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const employeeId = parseInt(req.params.id);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw NotFoundError('Employee', employeeId);
      }

      // Check permissions
      if (req.user!.role !== 'SuperAdmin') {
        if (req.user!.businessId !== employee.businessId) {
          throw ForbiddenError('Cannot edit employee from another business');
        }

        if (req.user!.role === 'Manager' && employee.role !== 'Staff') {
          throw ForbiddenError('Managers can only edit Staff accounts');
        }
      }

      const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: req.body,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Deactivate employee (soft delete)
router.delete(
  '/:id',
  authenticate,
  authorize('SuperAdmin', 'Owner', 'Manager'),
  param('id').isInt(),
  validateRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const employeeId = parseInt(req.params.id);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw NotFoundError('Employee', employeeId);
      }

      // Check permissions
      if (req.user!.role !== 'SuperAdmin') {
        if (req.user!.businessId !== employee.businessId) {
          throw ForbiddenError('Cannot deactivate employee from another business');
        }

        if (req.user!.role === 'Manager' && employee.role !== 'Staff') {
          throw ForbiddenError('Managers can only deactivate Staff accounts');
        }
      }

      const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: { status: 'Terminated' },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
