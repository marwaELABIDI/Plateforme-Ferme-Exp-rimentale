const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createInventoryItemValidation = [
  body('owner').trim().isLength({ min: 1 }).withMessage('Owner is required'),
  body('family').trim().isLength({ min: 1 }).withMessage('Family is required'),
  body('designation').trim().isLength({ min: 1 }).withMessage('Designation is required'),
  body('stockQty').isFloat({ min: 0 }).withMessage('Stock quantity must be non-negative'),
  body('unit').trim().isLength({ min: 1 }).withMessage('Unit is required'),
  body('condition').isIn(['OK', 'NON_CONFORME', 'MAUVAIS']).withMessage('Invalid condition'),
  body('location').trim().isLength({ min: 1 }).withMessage('Location is required')
];

const updateInventoryItemValidation = [
  body('owner').optional().trim().isLength({ min: 1 }).withMessage('Owner cannot be empty'),
  body('family').optional().trim().isLength({ min: 1 }).withMessage('Family cannot be empty'),
  body('subFamily').optional().trim(),
  body('designation').optional().trim().isLength({ min: 1 }).withMessage('Designation cannot be empty'),
  body('stockQty').optional().isFloat({ min: 0 }).withMessage('Stock quantity must be non-negative'),
  body('unit').optional().trim().isLength({ min: 1 }).withMessage('Unit cannot be empty'),
  body('condition').optional().isIn(['OK', 'NON_CONFORME', 'MAUVAIS']).withMessage('Invalid condition'),
  body('location').optional().trim().isLength({ min: 1 }).withMessage('Location cannot be empty')
];

// Get all inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, condition, family, search, location } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Filter by condition if provided
    if (condition) {
      whereClause.condition = condition;
    }

    // Filter by family if provided
    if (family) {
      whereClause.family = family;
    }

    // Filter by location if provided
    if (location) {
      whereClause.location = {
        contains: location,
        mode: 'insensitive'
      };
    }

    // Search functionality
    if (search) {
      whereClause.OR = [
        { designation: { contains: search, mode: 'insensitive' } },
        { owner: { contains: search, mode: 'insensitive' } },
        { family: { contains: search, mode: 'insensitive' } },
        { subFamily: { contains: search, mode: 'insensitive' } }
      ];
    }

    const inventoryItems = await prisma.inventoryItem.findMany({
      where: whereClause,
      orderBy: [
        { family: 'asc' },
        { subFamily: 'asc' },
        { designation: 'asc' }
      ],
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.inventoryItem.count({ where: whereClause });

    res.json({
      inventoryItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get inventory items error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory items',
      message: 'An error occurred while fetching inventory items'
    });
  }
});

// Get single inventory item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id }
    });

    if (!inventoryItem) {
      return res.status(404).json({
        error: 'Inventory Item Not Found',
        message: 'The requested inventory item was not found'
      });
    }

    res.json({ inventoryItem });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory item',
      message: 'An error occurred while fetching the inventory item'
    });
  }
});

// Create new inventory item
router.post('/', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), createInventoryItemValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { owner, family, subFamily, designation, stockQty, unit, condition, location } = req.body;

    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        owner,
        family,
        subFamily,
        designation,
        stockQty,
        unit,
        condition,
        location,
        lastChecked: new Date()
      }
    });

    res.status(201).json({
      message: 'Inventory item created successfully',
      inventoryItem
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({
      error: 'Failed to create inventory item',
      message: 'An error occurred while creating the inventory item'
    });
  }
});

// Update inventory item
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), updateInventoryItemValidation, async (req, res) => {
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

    // Check if inventory item exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({
        error: 'Inventory Item Not Found',
        message: 'The requested inventory item was not found'
      });
    }

    // Update last checked date
    updateData.lastChecked = new Date();

    const inventoryItem = await prisma.inventoryItem.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Inventory item updated successfully',
      inventoryItem
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({
      error: 'Failed to update inventory item',
      message: 'An error occurred while updating the inventory item'
    });
  }
});

// Delete inventory item
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id }
    });

    if (!inventoryItem) {
      return res.status(404).json({
        error: 'Inventory Item Not Found',
        message: 'The requested inventory item was not found'
      });
    }

    await prisma.inventoryItem.delete({
      where: { id }
    });

    res.json({
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({
      error: 'Failed to delete inventory item',
      message: 'An error occurred while deleting the inventory item'
    });
  }
});

// Get inventory alerts (items with non-conforming condition)
router.get('/alerts/conditions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const alertItems = await prisma.inventoryItem.findMany({
      where: {
        condition: {
          in: ['NON_CONFORME', 'MAUVAIS']
        }
      },
      orderBy: [
        { condition: 'desc' },
        { lastChecked: 'asc' }
      ],
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.inventoryItem.count({
      where: {
        condition: {
          in: ['NON_CONFORME', 'MAUVAIS']
        }
      }
    });

    res.json({
      alertItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get inventory alerts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory alerts',
      message: 'An error occurred while fetching inventory alerts'
    });
  }
});

// Get inventory statistics
router.get('/statistics/overview', authenticateToken, async (req, res) => {
  try {
    // Get total counts
    const totalItems = await prisma.inventoryItem.count();
    const okItems = await prisma.inventoryItem.count({
      where: { condition: 'OK' }
    });
    const nonConformeItems = await prisma.inventoryItem.count({
      where: { condition: 'NON_CONFORME' }
    });
    const mauvaisItems = await prisma.inventoryItem.count({
      where: { condition: 'MAUVAIS' }
    });

    // Get family distribution
    const familyStats = await prisma.inventoryItem.groupBy({
      by: ['family'],
      _count: {
        family: true
      }
    });

    // Get condition distribution
    const conditionStats = await prisma.inventoryItem.groupBy({
      by: ['condition'],
      _count: {
        condition: true
      }
    });

    // Get location distribution
    const locationStats = await prisma.inventoryItem.groupBy({
      by: ['location'],
      _count: {
        location: true
      }
    });

    // Get items that need checking (not checked in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const itemsNeedingCheck = await prisma.inventoryItem.count({
      where: {
        lastChecked: {
          lt: thirtyDaysAgo
        }
      }
    });

    res.json({
      overview: {
        totalItems,
        okItems,
        nonConformeItems,
        mauvaisItems,
        itemsNeedingCheck
      },
      distributions: {
        families: familyStats,
        conditions: conditionStats,
        locations: locationStats
      }
    });
  } catch (error) {
    console.error('Get inventory statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory statistics',
      message: 'An error occurred while fetching inventory statistics'
    });
  }
});

// Bulk update inventory items
router.post('/bulk-update', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Invalid Data',
        message: 'Items array is required and must not be empty'
      });
    }

    const results = await prisma.$transaction(async (tx) => {
      const updates = [];

      for (const item of items) {
        const { id, stockQty, condition, location } = item;

        if (!id) {
          throw new Error('Item ID is required for bulk update');
        }

        const updateData = {
          lastChecked: new Date()
        };

        if (stockQty !== undefined) updateData.stockQty = stockQty;
        if (condition) updateData.condition = condition;
        if (location) updateData.location = location;

        const updatedItem = await tx.inventoryItem.update({
          where: { id },
          data: updateData
        });

        updates.push(updatedItem);
      }

      return updates;
    });

    res.json({
      message: `${results.length} inventory items updated successfully`,
      updatedItems: results
    });
  } catch (error) {
    console.error('Bulk update inventory error:', error);
    res.status(500).json({
      error: 'Failed to bulk update inventory items',
      message: error.message || 'An error occurred while updating inventory items'
    });
  }
});

// Get inventory families (for dropdown)
router.get('/families/list', authenticateToken, async (req, res) => {
  try {
    const families = await prisma.inventoryItem.groupBy({
      by: ['family'],
      _count: {
        family: true
      },
      orderBy: {
        family: 'asc'
      }
    });

    const familyList = families.map(f => ({
      family: f.family,
      count: f._count.family
    }));

    res.json({ families: familyList });
  } catch (error) {
    console.error('Get inventory families error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory families',
      message: 'An error occurred while fetching inventory families'
    });
  }
});

// Get inventory locations (for dropdown)
router.get('/locations/list', authenticateToken, async (req, res) => {
  try {
    const locations = await prisma.inventoryItem.groupBy({
      by: ['location'],
      _count: {
        location: true
      },
      orderBy: {
        location: 'asc'
      }
    });

    const locationList = locations.map(l => ({
      location: l.location,
      count: l._count.location
    }));

    res.json({ locations: locationList });
  } catch (error) {
    console.error('Get inventory locations error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inventory locations',
      message: 'An error occurred while fetching inventory locations'
    });
  }
});

module.exports = router; 