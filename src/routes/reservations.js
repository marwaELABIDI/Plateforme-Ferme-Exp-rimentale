// src/routes/reservations.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireOwnershipOrAdmin } = require('../middleware/auth');
const { sendReservationStatusEmail, sendProjectAssignmentEmail } = require('../utils/email');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createReservationValidation = [
  body('fieldId').notEmpty().withMessage('Field ID is required'),
  body('surfaceM2Requested').isFloat({ min: 0.1 }).withMessage('Surface area must be greater than 0'),
  body('startRequested').isISO8601().withMessage('Start date must be a valid date'),
  body('endRequested').isISO8601().withMessage('End date must be a valid date'),
];

const updateReservationValidation = [
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
  body('supervisorId').optional().isUUID().withMessage('Supervisor ID must be a valid UUID')
];

// Get all reservations (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, fieldId } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};
    if (status) whereClause.status = status;
    if (fieldId) whereClause.fieldId = fieldId;

    if (req.user.role === 'CLIENT') {
      whereClause.clientId = req.user.id;
    } else if (req.user.role === 'SUPERVISOR') {
      whereClause.supervisorId = req.user.id;
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        client: {
          select: { id: true, name: true, email: true, entity: { select: { id: true, name: true, notes: true } } }
        },
        field: {
          select: { id: true, name: true, location: true, totalSurfaceM2: true, freeSurfaceM2: true }
        },
        supervisor: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.reservation.count({ where: whereClause });

    res.json({
      reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Failed to retrieve reservations', message: 'An error occurred while fetching reservations' });
  }
});

// Get single reservation
router.get('/:id', authenticateToken, requireOwnershipOrAdmin('reservation'), async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, entity: { select: { id: true, name: true } } } },
        field: { select: { id: true, name: true, location: true, totalSurfaceM2: true, freeSurfaceM2: true, status: true } },
        supervisor: { select: { id: true, name: true, email: true } }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation Not Found', message: 'The requested reservation was not found' });
    }
    res.json({ reservation });
  } catch (error) {
    console.error('Get reservation error:', error);
    res.status(500).json({ error: 'Failed to retrieve reservation', message: 'An error occurred while fetching the reservation' });
  }
});

// Create new reservation
router.post('/', authenticateToken, requireRole('CLIENT'), createReservationValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', details: errors.array() });
    }

    const { fieldId, surfaceM2Requested, startRequested, endRequested } = req.body;
    const field = await prisma.field.findUnique({ where: { id: fieldId } });

    if (!field) {
      return res.status(404).json({ error: 'Field Not Found' });
    }
    if (field.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Field Not Available' });
    }
    if (surfaceM2Requested > field.freeSurfaceM2) {
      return res.status(400).json({ error: 'Insufficient Surface Area' });
    }
    
    const reservation = await prisma.reservation.create({
      data: {
        clientId: req.user.id,
        fieldId,
        surfaceM2Requested: parseFloat(surfaceM2Requested),
        startRequested: new Date(startRequested),
        endRequested: new Date(endRequested),
        status: 'PENDING'
      },
    });

    res.status(201).json({ message: 'Reservation request created successfully', reservation });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: 'Failed to create reservation', message: 'An error occurred while creating the reservation' });
  }
});

// Update reservation status (approve/reject) - SIMPLIFIED FOR DEMO
router.patch('/:id/status', authenticateToken, requireRole('ADMIN'), updateReservationValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation Error', details: errors.array() });
    }

    const { id } = req.params;
    const { status, supervisorId } = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true } },
        field: { select: { id: true, freeSurfaceM2: true } }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation Not Found' });
    }
    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending reservations can be changed' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: { status, decisionDate: new Date(), supervisorId: status === 'APPROVED' ? supervisorId : null }
      });

      if (status === 'APPROVED') {
        await tx.field.update({
          where: { id: reservation.fieldId },
          data: { freeSurfaceM2: { decrement: reservation.surfaceM2Requested } }
        });
      }

      try {
        await sendReservationStatusEmail(
          reservation.client.email,
          reservation,
          status,
          `Your reservation request for ${reservation.surfaceM2Requested}m²`
        );
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }

      return updatedReservation;
    });

    res.json({ message: `Reservation ${status.toLowerCase()} successfully`, reservation: result });
  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({ error: 'Failed to update reservation status', message: 'An error occurred while updating the reservation status' });
  }
});

// Delete reservation (only if pending)
router.delete('/:id', authenticateToken, requireOwnershipOrAdmin('reservation'), async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation Not Found' });
    }
    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cannot Delete Reservation' });
    }

    await prisma.reservation.delete({ where: { id } });
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ error: 'Failed to delete reservation', message: 'An error occurred while deleting the reservation' });
  }
});

module.exports = router;