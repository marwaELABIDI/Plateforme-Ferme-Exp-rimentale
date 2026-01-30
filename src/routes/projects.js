const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireOwnershipOrAdmin, requireSupervisorAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createProjectValidation = [
  body('title').trim().isLength({ min: 3 }).withMessage('Project title must be at least 3 characters'),
  body('fieldId').notEmpty().withMessage('Field ID is required'),
  body('clientId').notEmpty().withMessage('Client ID is required'),
  body('supervisorId').notEmpty().withMessage('Supervisor ID is required'),
  body('surfaceM2').isFloat({ min: 0.1 }).withMessage('Surface area must be greater than 0'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('activityTypeId').optional().isUUID().withMessage('Activity type ID must be a valid UUID')
];

const updateProjectValidation = [
  body('title').optional().trim().isLength({ min: 3 }).withMessage('Project title must be at least 3 characters'),
  body('surfaceM2').optional().isFloat({ min: 0.1 }).withMessage('Surface area must be greater than 0'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('status').optional().isIn(['EN_COURS', 'FINALISE', 'PROGRAMME', 'A_LANCER']).withMessage('Invalid project status'),
  body('activityTypeId').optional().isUUID().withMessage('Activity type ID must be a valid UUID')
];

// Get all projects (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, fieldId, activityTypeId, search } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    // Filter by field if provided
    if (fieldId) {
      whereClause.fieldId = fieldId;
    }

    // Filter by activity type if provided
    if (activityTypeId) {
      whereClause.activityTypeId = activityTypeId;
    }

    // Search functionality
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { supervisor: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Role-based filtering
    if (req.user.role === 'CLIENT') {
      whereClause.clientId = req.user.id;
    } else if (req.user.role === 'SUPERVISOR') {
      whereClause.supervisorId = req.user.id;
    }
    // ADMIN can see all projects

    const projects = await prisma.project.findMany({
      where: whereClause,
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
            name: true,
            location: true,
            totalSurfaceM2: true,
            freeSurfaceM2: true
          }
        },
        activityType: {
          select: {
            id: true,
            label: true,
            description: true
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.project.count({ where: whereClause });

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: 'Failed to retrieve projects',
      message: 'An error occurred while fetching projects'
    });
  }
});

// Get single project
router.get('/:id', authenticateToken, requireOwnershipOrAdmin('project'), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            entity: {
              select: {
                id: true,
                name: true
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
            name: true,
            location: true,
            totalSurfaceM2: true,
            freeSurfaceM2: true,
            status: true
          }
        },
        activityType: {
          select: {
            id: true,
            label: true,
            description: true
          }
        },
        reservation: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        error: 'Project Not Found',
        message: 'The requested project was not found'
      });
    }

    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      error: 'Failed to retrieve project',
      message: 'An error occurred while fetching the project'
    });
  }
});

// Create new project (Admin only)
router.post('/', authenticateToken, requireRole('ADMIN'), createProjectValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { title, fieldId, clientId, supervisorId, surfaceM2, startDate, endDate, activityTypeId, status = 'A_LANCER' } = req.body;

    // Check if field exists and has sufficient free surface
    const field = await prisma.field.findUnique({
      where: { id: fieldId }
    });

    if (!field) {
      return res.status(404).json({
        error: 'Field Not Found',
        message: 'The specified field was not found'
      });
    }

    if (field.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Field Not Available',
        message: 'The specified field is not available for projects'
      });
    }

    if (surfaceM2 > field.freeSurfaceM2) {
      return res.status(400).json({
        error: 'Insufficient Surface Area',
        message: `Requested surface area (${surfaceM2} m²) exceeds available area (${field.freeSurfaceM2} m²)`
      });
    }

    // Check if client exists
    const client = await prisma.user.findUnique({
      where: { id: clientId }
    });

    if (!client || client.role !== 'CLIENT') {
      return res.status(400).json({
        error: 'Invalid Client',
        message: 'The specified client is not valid'
      });
    }

    // Check if supervisor exists
    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId }
    });

    if (!supervisor || supervisor.role !== 'SUPERVISOR') {
      return res.status(400).json({
        error: 'Invalid Supervisor',
        message: 'The specified supervisor is not valid'
      });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create project
      const project = await tx.project.create({
        data: {
          title,
          fieldId,
          clientId,
          supervisorId,
          activityTypeId,
          surfaceM2,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          status
        },
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
              name: true,
              location: true
            }
          }
        }
      });

      // Update field free surface if project is active
      if (['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(status)) {
        await tx.field.update({
          where: { id: fieldId },
          data: {
            freeSurfaceM2: {
              decrement: surfaceM2
            }
          }
        });
      }

      return project;
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: result
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      error: 'Failed to create project',
      message: 'An error occurred while creating the project'
    });
  }
});

// Update project
router.put('/:id', authenticateToken, requireOwnershipOrAdmin('project'), updateProjectValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { title, surfaceM2, startDate, endDate, status, activityTypeId, progressNotes } = req.body;

    // Get existing project
    const existingProject = await prisma.project.findUnique({
      where: { id },
      include: {
        field: true
      }
    });

    if (!existingProject) {
      return res.status(404).json({
        error: 'Project Not Found',
        message: 'The requested project was not found'
      });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      let updatedData = {};

      // Handle surface area changes
      if (surfaceM2 && surfaceM2 !== existingProject.surfaceM2) {
        const surfaceDifference = surfaceM2 - existingProject.surfaceM2;
        
        // Check if field has sufficient free surface for increase
        if (surfaceDifference > 0 && surfaceDifference > existingProject.field.freeSurfaceM2) {
          throw new Error(`Insufficient surface area. Available: ${existingProject.field.freeSurfaceM2} m², Required: ${surfaceDifference} m²`);
        }

        updatedData.surfaceM2 = surfaceM2;

        // Update field free surface
        await tx.field.update({
          where: { id: existingProject.fieldId },
          data: {
            freeSurfaceM2: {
              decrement: surfaceDifference
            }
          }
        });
      }

      // Handle status changes
      if (status && status !== existingProject.status) {
        updatedData.status = status;

        // If project is being finalized, release surface area back to field
        if (status === 'FINALISE' && existingProject.status !== 'FINALISE') {
          await tx.field.update({
            where: { id: existingProject.fieldId },
            data: {
              freeSurfaceM2: {
                increment: existingProject.surfaceM2
              }
            }
          });
        }
        // If project is being reactivated, reserve surface area again
        else if (existingProject.status === 'FINALISE' && status !== 'FINALISE') {
          await tx.field.update({
            where: { id: existingProject.fieldId },
            data: {
              freeSurfaceM2: {
                decrement: existingProject.surfaceM2
              }
            }
          });
        }
      }

      // Add other updates
      if (title) updatedData.title = title;
      if (startDate) updatedData.startDate = new Date(startDate);
      if (endDate) updatedData.endDate = new Date(endDate);
      if (activityTypeId) updatedData.activityTypeId = activityTypeId;
      if (progressNotes !== undefined) updatedData.progressNotes = progressNotes;

      // Update project
      const updatedProject = await tx.project.update({
        where: { id },
        data: updatedData,
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
              name: true,
              location: true
            }
          },
          activityType: {
            select: {
              id: true,
              label: true
            }
          }
        }
      });

      return updatedProject;
    });

    res.json({
      message: 'Project updated successfully',
      project: result
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      error: 'Failed to update project',
      message: error.message || 'An error occurred while updating the project'
    });
  }
});

// Update project progress notes (Supervisor only)
router.patch('/:id/progress', authenticateToken, requireSupervisorAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { progressNotes } = req.body;

    if (!progressNotes || typeof progressNotes !== 'string') {
      return res.status(400).json({
        error: 'Invalid Progress Notes',
        message: 'Progress notes are required and must be a string'
      });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        progressNotes
      },
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
            name: true,
            location: true
          }
        }
      }
    });

    res.json({
      message: 'Progress notes updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project progress error:', error);
    res.status(500).json({
      error: 'Failed to update progress notes',
      message: 'An error occurred while updating progress notes'
    });
  }
});

// Delete project (Admin only)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        field: true
      }
    });

    if (!project) {
      return res.status(404).json({
        error: 'Project Not Found',
        message: 'The requested project was not found'
      });
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Release surface area back to field if project is active
      if (['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(project.status)) {
        await tx.field.update({
          where: { id: project.fieldId },
          data: {
            freeSurfaceM2: {
              increment: project.surfaceM2
            }
          }
        });
      }

      // Delete project
      await tx.project.delete({
        where: { id }
      });
    });

    res.json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      message: 'An error occurred while deleting the project'
    });
  }
});

// Get project statistics
router.get('/:id/statistics', authenticateToken, requireOwnershipOrAdmin('project'), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        field: {
          include: {
            projects: {
              where: {
                id: { not: id }
              }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({
        error: 'Project Not Found',
        message: 'The requested project was not found'
      });
    }

    // Calculate field utilization excluding this project
    const otherProjectsSurface = project.field.projects
      .filter(p => ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status))
      .reduce((sum, p) => sum + p.surfaceM2, 0);

    const fieldUtilizationPercentage = ((otherProjectsSurface + project.surfaceM2) / project.field.totalSurfaceM2) * 100;

    // Calculate project duration
    const startDate = new Date(project.startDate);
    const endDate = project.endDate ? new Date(project.endDate) : new Date();
    const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Calculate progress percentage based on time
    const totalDuration = project.endDate ? 
      Math.ceil((new Date(project.endDate) - startDate) / (1000 * 60 * 60 * 24)) : 
      durationDays;
    
    const progressPercentage = totalDuration > 0 ? Math.min((durationDays / totalDuration) * 100, 100) : 0;

    res.json({
      statistics: {
        projectDuration: durationDays,
        progressPercentage: Math.round(progressPercentage * 100) / 100,
        fieldUtilizationPercentage: Math.round(fieldUtilizationPercentage * 100) / 100,
        surfaceUtilizationPercentage: (project.surfaceM2 / project.field.totalSurfaceM2) * 100
      }
    });
  } catch (error) {
    console.error('Get project statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve project statistics',
      message: 'An error occurred while fetching project statistics'
    });
  }
});

module.exports = router; 