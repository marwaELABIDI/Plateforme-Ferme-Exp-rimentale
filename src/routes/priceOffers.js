const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createPriceOfferValidation = [
  body('destinataire').trim().isLength({ min: 2 }).withMessage('Destinataire must be at least 2 characters'),
  body('demandeur').trim().isLength({ min: 2 }).withMessage('Demandeur must be at least 2 characters'),
  body('address').trim().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('itemDesignation').trim().isLength({ min: 3 }).withMessage('Item designation must be at least 3 characters'),
  body('unit').trim().isLength({ min: 1 }).withMessage('Unit is required'),
  body('quantity').isFloat({ min: 0.1 }).withMessage('Quantity must be greater than 0'),
  body('contact').optional().trim(),
  body('orderNumber').optional().trim(),
  body('techDescription').optional().trim()
];

const updatePriceOfferValidation = [
  body('destinataire').optional().trim().isLength({ min: 2 }).withMessage('Destinataire must be at least 2 characters'),
  body('demandeur').optional().trim().isLength({ min: 2 }).withMessage('Demandeur must be at least 2 characters'),
  body('address').optional().trim().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('itemDesignation').optional().trim().isLength({ min: 3 }).withMessage('Item designation must be at least 3 characters'),
  body('unit').optional().trim().isLength({ min: 1 }).withMessage('Unit cannot be empty'),
  body('quantity').optional().isFloat({ min: 0.1 }).withMessage('Quantity must be greater than 0'),
  body('contact').optional().trim(),
  body('orderNumber').optional().trim(),
  body('techDescription').optional().trim(),
  body('status').optional().isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED']).withMessage('Invalid status')
];

// Get all price offers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    // Filter by date range if provided
    if (startDate && endDate) {
      whereClause.dateSent = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Search functionality
    if (search) {
      whereClause.OR = [
        { destinataire: { contains: search, mode: 'insensitive' } },
        { demandeur: { contains: search, mode: 'insensitive' } },
        { itemDesignation: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Role-based filtering
    if (req.user.role === 'CLIENT') {
      whereClause.createdById = req.user.id;
    }
    // ADMIN and SUPERVISOR can see all offers

    const priceOffers = await prisma.priceOffer.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dateSent: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.priceOffer.count({ where: whereClause });

    res.json({
      priceOffers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get price offers error:', error);
    res.status(500).json({
      error: 'Failed to retrieve price offers',
      message: 'An error occurred while fetching price offers'
    });
  }
});

// Get single price offer
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const priceOffer = await prisma.priceOffer.findUnique({
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

    if (!priceOffer) {
      return res.status(404).json({
        error: 'Price Offer Not Found',
        message: 'The requested price offer was not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'CLIENT' && priceOffer.createdById !== req.user.id) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only access your own price offers'
      });
    }

    res.json({ priceOffer });
  } catch (error) {
    console.error('Get price offer error:', error);
    res.status(500).json({
      error: 'Failed to retrieve price offer',
      message: 'An error occurred while fetching the price offer'
    });
  }
});

// Create new price offer
router.post('/', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), createPriceOfferValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const {
      destinataire,
      demandeur,
      contact,
      address,
      orderNumber,
      itemDesignation,
      unit,
      techDescription,
      quantity
    } = req.body;

    const priceOffer = await prisma.priceOffer.create({
      data: {
        destinataire,
        demandeur,
        contact,
        address,
        orderNumber,
        itemDesignation,
        unit,
        techDescription,
        quantity,
        dateSent: new Date(),
        status: 'PENDING',
        createdById: req.user.id
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

    res.status(201).json({
      message: 'Price offer created successfully',
      priceOffer
    });
  } catch (error) {
    console.error('Create price offer error:', error);
    res.status(500).json({
      error: 'Failed to create price offer',
      message: 'An error occurred while creating the price offer'
    });
  }
});

// Update price offer
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), updatePriceOfferValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if price offer exists
    const existingOffer = await prisma.priceOffer.findUnique({
      where: { id }
    });

    if (!existingOffer) {
      return res.status(404).json({
        error: 'Price Offer Not Found',
        message: 'The requested price offer was not found'
      });
    }

    const priceOffer = await prisma.priceOffer.update({
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

    res.json({
      message: 'Price offer updated successfully',
      priceOffer
    });
  } catch (error) {
    console.error('Update price offer error:', error);
    res.status(500).json({
      error: 'Failed to update price offer',
      message: 'An error occurred while updating the price offer'
    });
  }
});

// Update price offer status
router.patch('/:id/status', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'SENT', 'ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Status must be PENDING, SENT, ACCEPTED, or REJECTED'
      });
    }

    const priceOffer = await prisma.priceOffer.update({
      where: { id },
      data: {
        status,
        dateSent: status === 'SENT' ? new Date() : undefined
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

    res.json({
      message: 'Price offer status updated successfully',
      priceOffer
    });
  } catch (error) {
    console.error('Update price offer status error:', error);
    res.status(500).json({
      error: 'Failed to update price offer status',
      message: 'An error occurred while updating the price offer status'
    });
  }
});

// Delete price offer
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const priceOffer = await prisma.priceOffer.findUnique({
      where: { id }
    });

    if (!priceOffer) {
      return res.status(404).json({
        error: 'Price Offer Not Found',
        message: 'The requested price offer was not found'
      });
    }

    await prisma.priceOffer.delete({
      where: { id }
    });

    res.json({
      message: 'Price offer deleted successfully'
    });
  } catch (error) {
    console.error('Delete price offer error:', error);
    res.status(500).json({
      error: 'Failed to delete price offer',
      message: 'An error occurred while deleting the price offer'
    });
  }
});

// Generate PDF for price offer
router.get('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const priceOffer = await prisma.priceOffer.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            name: true
          }
        }
      }
    });

    if (!priceOffer) {
      return res.status(404).json({
        error: 'Price Offer Not Found',
        message: 'The requested price offer was not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'CLIENT' && priceOffer.createdById !== req.user.id) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only access your own price offers'
      });
    }

    // Create PDF
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="price-offer-${id}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(18).text('AITTC / UM6P', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Ferme expérimentale site Ben Guérir', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Fiche : offre de prix', { align: 'center' });
    doc.moveDown();

    // Form details
    doc.fontSize(10);
    doc.text(`Code : F.47`);
    doc.text(`Version : 01`);
    doc.text(`Date : ${new Date(priceOffer.dateSent).toLocaleDateString()}`);
    doc.moveDown();

    doc.text(`Demande N° : ${priceOffer.orderNumber || 'N/A'}`);
    doc.text(`Date : ${new Date(priceOffer.dateSent).toLocaleDateString()}`);
    doc.moveDown();

    doc.text(`Destinataire : ${priceOffer.destinataire}`);
    doc.text(`Demandeur : ${priceOffer.demandeur}`);
    if (priceOffer.contact) {
      doc.text(`Contacts : ${priceOffer.contact}`);
    }
    doc.text(`Adresse : ${priceOffer.address}`);
    doc.moveDown();

    // Item details
    doc.text('Numéro d\'ordre : 1');
    doc.text(`Désignation article : ${priceOffer.itemDesignation}`);
    if (priceOffer.techDescription) {
      doc.text(`Description technique : ${priceOffer.techDescription}`);
    }
    doc.text(`Unité : ${priceOffer.unit}`);
    doc.text(`Quantité : ${priceOffer.quantity}`);
    doc.moveDown();

    // Footer
    doc.text('Centre AITTC de l\'Université Mohamed 6 Polytechniques (UM6P)');
    doc.text('Adresse : Lot 660,Hay Moulay Rachid 43150, Ben Guérir - www.um6p.ma');
    doc.text('R.C.n° 1037-Patente n° 45408944-I.F. 14437938-CNSS n° 9515919-ICE n° 000189568000063');
    doc.text('Morocco');

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: 'An error occurred while generating the PDF'
    });
  }
});

// Get price offer statistics
router.get('/statistics/overview', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};

    // Role-based filtering
    if (req.user.role === 'CLIENT') {
      whereClause.createdById = req.user.id;
    }

    // Get total counts
    const totalOffers = await prisma.priceOffer.count({ where: whereClause });
    const pendingOffers = await prisma.priceOffer.count({
      where: { ...whereClause, status: 'PENDING' }
    });
    const sentOffers = await prisma.priceOffer.count({
      where: { ...whereClause, status: 'SENT' }
    });
    const acceptedOffers = await prisma.priceOffer.count({
      where: { ...whereClause, status: 'ACCEPTED' }
    });
    const rejectedOffers = await prisma.priceOffer.count({
      where: { ...whereClause, status: 'REJECTED' }
    });

    // Get status distribution
    const statusStats = await prisma.priceOffer.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: whereClause
    });

    // Get monthly trends
    const monthlyStats = await prisma.priceOffer.groupBy({
      by: ['dateSent'],
      _count: {
        id: true
      },
      where: {
        ...whereClause,
        dateSent: {
          gte: new Date(new Date().getFullYear(), 0, 1) // From January 1st of current year
        }
      }
    });

    res.json({
      overview: {
        totalOffers,
        pendingOffers,
        sentOffers,
        acceptedOffers,
        rejectedOffers
      },
      distributions: {
        status: statusStats,
        monthly: monthlyStats
      }
    });
  } catch (error) {
    console.error('Get price offer statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve price offer statistics',
      message: 'An error occurred while fetching price offer statistics'
    });
  }
});

module.exports = router; 