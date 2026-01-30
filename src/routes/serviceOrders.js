const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateServiceOrderPDF } = require('../utils/pdfGenerator');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createServiceOrderValidation = [
  body('objet').trim().notEmpty().withMessage('Objet is required'),
  body('marketNumber').optional().trim(),
  body('bcNumber').optional().trim(),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('clientRep').trim().notEmpty().withMessage('Client representative is required'),
  body('supplier').trim().notEmpty().withMessage('Supplier is required')
];

const updateServiceOrderValidation = [
  body('objet').optional().trim().notEmpty().withMessage('Objet cannot be empty'),
  body('marketNumber').optional().trim(),
  body('bcNumber').optional().trim(),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('clientRep').optional().trim().notEmpty().withMessage('Client representative cannot be empty'),
  body('supplier').optional().trim().notEmpty().withMessage('Supplier cannot be empty'),
  body('status').optional().isIn(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
];

// Get all service orders (Admin only)
router.get('/', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, supplier, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    // Build filter conditions
    const where = {};
    if (status) where.status = status;
    if (supplier) where.supplier = { contains: supplier, mode: 'insensitive' };
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.serviceOrder.count({ where })
    ]);

    res.json({
      serviceOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching service orders:', error);
    res.status(500).json({ error: 'Failed to fetch service orders' });
  }
});

// Get service order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!serviceOrder) {
      return res.status(404).json({ error: 'Service order not found' });
    }

    // Only admin or creator can view
    if (role !== 'ADMIN' && serviceOrder.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(serviceOrder);
  } catch (error) {
    console.error('Error fetching service order:', error);
    res.status(500).json({ error: 'Failed to fetch service order' });
  }
});

// Create new service order (Admin only)
router.post('/', authenticateToken, requireRole(['ADMIN']), createServiceOrderValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { objet, marketNumber, bcNumber, startDate, clientRep, supplier } = req.body;
    const { userId } = req.user;

    const serviceOrder = await prisma.serviceOrder.create({
      data: {
        objet,
        marketNumber,
        bcNumber,
        startDate: new Date(startDate),
        clientRep,
        supplier,
        createdById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(serviceOrder);
  } catch (error) {
    console.error('Error creating service order:', error);
    res.status(500).json({ error: 'Failed to create service order' });
  }
});

// Update service order
router.put('/:id', authenticateToken, requireRole(['ADMIN']), updateServiceOrderValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = { ...req.body };
    
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }

    const serviceOrder = await prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(serviceOrder);
  } catch (error) {
    console.error('Error updating service order:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service order not found' });
    }
    res.status(500).json({ error: 'Failed to update service order' });
  }
});

// Delete service order (Admin only)
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.serviceOrder.delete({
      where: { id }
    });

    res.json({ message: 'Service order deleted successfully' });
  } catch (error) {
    console.error('Error deleting service order:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service order not found' });
    }
    res.status(500).json({ error: 'Failed to delete service order' });
  }
});

// Generate PDF for service order
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!serviceOrder) {
      return res.status(404).json({ error: 'Service order not found' });
    }

    // Only admin or creator can generate PDF
    if (role !== 'ADMIN' && serviceOrder.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pdfBuffer = await generateServiceOrderPDF(serviceOrder);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="service-order-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get service order statistics
router.get('/stats/overview', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [total, inProgress, completed, cancelled] = await Promise.all([
      prisma.serviceOrder.count(),
      prisma.serviceOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.serviceOrder.count({ where: { status: 'COMPLETED' } }),
      prisma.serviceOrder.count({ where: { status: 'CANCELLED' } })
    ]);

    const monthlyStats = await prisma.serviceOrder.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    res.json({
      total,
      inProgress,
      completed,
      cancelled,
      monthlyStats
    });
  } catch (error) {
    console.error('Error fetching service order statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Update service order status
router.patch('/:id/status', authenticateToken, requireRole(['ADMIN']), [
  body('status').isIn(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const serviceOrder = await prisma.serviceOrder.update({
      where: { id },
      data: { status },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(serviceOrder);
  } catch (error) {
    console.error('Error updating service order status:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Service order not found' });
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router; 