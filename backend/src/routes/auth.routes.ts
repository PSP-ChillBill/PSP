import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { ApiError, UnauthorizedError } from '../middleware/errorHandler';

const router = Router();
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google OAuth login
router.post('/google', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Token is required');
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw UnauthorizedError('Invalid Google token');
    }

    const { sub: googleId, email, name } = payload;

    // Find or create employee
    let employee = await prisma.employee.findUnique({
      where: { googleId },
      include: { business: true },
    });

    if (!employee && email) {
      // Try to find by email (for pending invitations)
      employee = await prisma.employee.findUnique({
        where: { email },
        include: { business: true },
      });

      if (employee) {
        // Link Google ID to existing account
        employee = await prisma.employee.update({
          where: { id: employee.id },
          data: { googleId },
          include: { business: true },
        });
      }
    }

    if (!employee) {
      throw UnauthorizedError('No account found. Please contact your administrator.');
    }

    if (employee.status !== 'Active') {
      throw UnauthorizedError('Your account is not active');
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET!;
    const jwtToken = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        businessId: employee.businessId,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        businessId: employee.businessId,
        business: employee.business,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as { id: number };

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      include: { business: true },
    });

    if (!employee) {
      throw UnauthorizedError('User not found');
    }

    res.json({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
      businessId: employee.businessId,
      business: employee.business,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
