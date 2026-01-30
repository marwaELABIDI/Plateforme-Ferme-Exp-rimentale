const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createFieldValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('Field name must be at least 2 characters'),
  body('location').trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('totalSurfaceM2').isFloat({ min: 0.1 }).withMessage('Total surface area must be greater than 0'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE')
];

const updateFieldValidation = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Field name must be at least 2 characters'),
  body('location').optional().trim().isLength({ min: 2 }).withMessage('Location must be at least 2 characters'),
  body('totalSurfaceM2').optional().isFloat({ min: 0.1 }).withMessage('Total surface area must be greater than 0'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE')
];

// Get all fields
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    // Search functionality
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } }
      ];
    }

    const fields = await prisma.field.findMany({
      where: whereClause,
      include: {
        projects: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                entity: {
                  select: {
                    id: true,
                    name: true,
                    notes: true
                  }
                }
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            activityType: {
              select: {
                id: true,
                label: true
              }
            }
          }
        },
        reservations: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                entity: {
                  select: {
                    id: true,
                    name: true,
                    notes: true
                  }
                }
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            field: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            projects: true,
            reservations: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.field.count({ where: whereClause });

    // Calculate utilization percentage for each field
    const fieldsWithUtilization = fields.map(field => {
      const usedSurface = field.projects.reduce((sum, project) => sum + project.surfaceM2, 0);
      const utilizationPercentage = (usedSurface / field.totalSurfaceM2) * 100;
      
      return {
        ...field,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        usedSurfaceM2: usedSurface
      };
    });

    res.json({
      fields: fieldsWithUtilization,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get fields error:', error);
    res.status(500).json({
      error: 'Failed to retrieve fields',
      message: 'An error occurred while fetching fields'
    });
  }
});

// Get single field
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const field = await prisma.field.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            activityType: {
              select: {
                id: true,
                label: true
              }
            }
          },
          orderBy: {
            startDate: 'desc'
          }
        },
        reservations: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            supervisor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            field: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({
        error: 'Field Not Found',
        message: 'The requested field was not found'
      });
    }

    // Calculate utilization
    const usedSurface = field.projects
      .filter(project => ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(project.status))
      .reduce((sum, project) => sum + project.surfaceM2, 0);
    
    const utilizationPercentage = (usedSurface / field.totalSurfaceM2) * 100;

    res.json({
      field: {
        ...field,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        usedSurfaceM2: usedSurface
      }
    });
  } catch (error) {
    console.error('Get field error:', error);
    res.status(500).json({
      error: 'Failed to retrieve field',
      message: 'An error occurred while fetching the field'
    });
  }
});

// Create new field
router.post('/', authenticateToken, requireRole('ADMIN'), createFieldValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { name, location, totalSurfaceM2, status = 'ACTIVE', notes } = req.body;

    // Check if field with same name already exists
    const existingField = await prisma.field.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    if (existingField) {
      return res.status(409).json({
        error: 'Field Already Exists',
        message: 'A field with this name already exists'
      });
    }

    const field = await prisma.field.create({
      data: {
        name,
        location,
        totalSurfaceM2,
        freeSurfaceM2: totalSurfaceM2, // Initially, all surface is free
        status,
        notes
      }
    });

    res.status(201).json({
      message: 'Field created successfully',
      field
    });
  } catch (error) {
    console.error('Create field error:', error);
    res.status(500).json({
      error: 'Failed to create field',
      message: 'An error occurred while creating the field'
    });
  }
});

// Update field
router.put('/:id', authenticateToken, requireRole('ADMIN'), updateFieldValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { name, location, totalSurfaceM2, status, notes } = req.body;

    // Check if field exists
    const existingField = await prisma.field.findUnique({
      where: { id },
      include: {
        projects: {
          where: {
            status: {
              in: ['EN_COURS', 'PROGRAMME', 'A_LANCER']
            }
          }
        }
      }
    });

    if (!existingField) {
      return res.status(404).json({
        error: 'Field Not Found',
        message: 'The requested field was not found'
      });
    }

    // Check if field has active projects and is being deactivated
    if (status === 'INACTIVE' && existingField.projects.length > 0) {
      return res.status(400).json({
        error: 'Cannot Deactivate Field',
        message: 'Cannot deactivate field with active projects'
      });
    }

    // Check if new total surface is sufficient for existing projects
    if (totalSurfaceM2) {
      const usedSurface = existingField.projects.reduce((sum, project) => sum + project.surfaceM2, 0);
      if (totalSurfaceM2 < usedSurface) {
        return res.status(400).json({
          error: 'Insufficient Surface Area',
          message: `New total surface area (${totalSurfaceM2} m²) is less than currently used area (${usedSurface} m²)`
        });
      }
    }

    // Check if name is being changed and if it conflicts with existing field
    if (name && name !== existingField.name) {
      const nameConflict = await prisma.field.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive'
          },
          id: {
            not: id
          }
        }
      });

      if (nameConflict) {
        return res.status(409).json({
          error: 'Field Name Conflict',
          message: 'A field with this name already exists'
        });
      }
    }

    // Calculate new free surface if total surface is being updated
    let freeSurfaceM2 = existingField.freeSurfaceM2;
    if (totalSurfaceM2 && totalSurfaceM2 !== existingField.totalSurfaceM2) {
      const usedSurface = existingField.projects.reduce((sum, project) => sum + project.surfaceM2, 0);
      freeSurfaceM2 = totalSurfaceM2 - usedSurface;
    }

    const updatedField = await prisma.field.update({
      where: { id },
      data: {
        name,
        location,
        totalSurfaceM2,
        freeSurfaceM2,
        status,
        notes
      }
    });

    res.json({
      message: 'Field updated successfully',
      field: updatedField
    });
  } catch (error) {
    console.error('Update field error:', error);
    res.status(500).json({
      error: 'Failed to update field',
      message: 'An error occurred while updating the field'
    });
  }
});

// Delete field
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if field exists and has active projects
    const field = await prisma.field.findUnique({
      where: { id },
      include: {
        projects: {
          where: {
            status: {
              in: ['EN_COURS', 'PROGRAMME', 'A_LANCER']
            }
          }
        },
        reservations: {
          where: {
            status: 'PENDING'
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({
        error: 'Field Not Found',
        message: 'The requested field was not found'
      });
    }

    if (field.projects.length > 0) {
      return res.status(400).json({
        error: 'Cannot Delete Field',
        message: 'Cannot delete field with active projects'
      });
    }

    if (field.reservations.length > 0) {
      return res.status(400).json({
        error: 'Cannot Delete Field',
        message: 'Cannot delete field with pending reservations'
      });
    }

    await prisma.field.delete({
      where: { id }
    });

    res.json({
      message: 'Field deleted successfully'
    });
  } catch (error) {
    console.error('Delete field error:', error);
    res.status(500).json({
      error: 'Failed to delete field',
      message: 'An error occurred while deleting the field'
    });
  }
});

// Get field statistics
router.get('/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const field = await prisma.field.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            activityType: true
          }
        }
      }
    });

    if (!field) {
      return res.status(404).json({
        error: 'Field Not Found',
        message: 'The requested field was not found'
      });
    }

    // Calculate statistics
    const totalProjects = field.projects.length;
    const activeProjects = field.projects.filter(p => ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status)).length;
    const completedProjects = field.projects.filter(p => p.status === 'FINALISE').length;
    
    const usedSurface = field.projects
      .filter(p => ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status))
      .reduce((sum, p) => sum + p.surfaceM2, 0);
    
    const utilizationPercentage = (usedSurface / field.totalSurfaceM2) * 100;

    // Activity type distribution
    const activityTypeStats = {};
    field.projects.forEach(project => {
      if (project.activityType) {
        const label = project.activityType.label;
        activityTypeStats[label] = (activityTypeStats[label] || 0) + 1;
      }
    });

    // Monthly project timeline
    const monthlyStats = {};
    field.projects.forEach(project => {
      const startMonth = new Date(project.startDate).toISOString().slice(0, 7); // YYYY-MM
      monthlyStats[startMonth] = (monthlyStats[startMonth] || 0) + 1;
    });

    res.json({
      statistics: {
        totalProjects,
        activeProjects,
        completedProjects,
        usedSurfaceM2: usedSurface,
        freeSurfaceM2: field.freeSurfaceM2,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        activityTypeDistribution: activityTypeStats,
        monthlyTimeline: monthlyStats
      }
    });
  } catch (error) {
    console.error('Get field statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve field statistics',
      message: 'An error occurred while fetching field statistics'
    });
  }
});

module.exports = router; 