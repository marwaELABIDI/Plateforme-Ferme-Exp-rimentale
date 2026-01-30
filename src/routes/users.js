const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, requireOwnershipOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createUserValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 }),
  body('role').isIn(['ADMIN', 'SUPERVISOR', 'CLIENT']),
  body('entityId').optional().isUUID()
];

const updateUserValidation = [
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional().trim().isLength({ min: 2 }),
  body('role').optional().isIn(['ADMIN', 'SUPERVISOR', 'CLIENT']),
  body('entityId').optional().isUUID()
];

const changePasswordValidation = [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
];

// Get all users (Admin only)
router.get('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, entityId } = req.query;
    const skip = (page - 1) * limit;

    let whereClause = {};

    // Filter by role if provided
    if (role) {
      whereClause.role = role;
    }

    // Filter by entity if provided
    if (entityId) {
      whereClause.entityId = entityId;
    }

    // Search functionality
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        entity: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            clientReservations: true,
            supervisorProjects: true,
            clientProjects: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const total = await prisma.user.count({ where: whereClause });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Failed to retrieve users',
      message: 'An error occurred while fetching users'
    });
  }
});

// Get single user
router.get('/:id', authenticateToken, requireOwnershipOrAdmin('user'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            notes: true
          }
        },
        clientReservations: {
          include: {
            field: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        supervisorProjects: {
          include: {
            client: {
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
          },
          orderBy: {
            startDate: 'desc'
          }
        },
        clientProjects: {
          include: {
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
          },
          orderBy: {
            startDate: 'desc'
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'The requested user was not found'
      });
    }

    // Remove sensitive information
    const { passwordHash, verificationToken, resetToken, resetTokenExpiry, ...safeUser } = user;

    res.json({ user: safeUser });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user',
      message: 'An error occurred while fetching the user'
    });
  }
});

// Create new user (Admin only)
router.post('/', authenticateToken, requireRole('ADMIN'), createUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { email, password, name, role, entityId } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User Already Exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        entityId,
        isVerified: true // Admin-created users are automatically verified
      },
      include: {
        entity: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Remove sensitive information
    const { passwordHash: _, ...safeUser } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: safeUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: 'An error occurred while creating the user'
    });
  }
});

// Update user
router.put('/:id', authenticateToken, requireOwnershipOrAdmin('user'), updateUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { email, name, role, entityId } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'The requested user was not found'
      });
    }

    // Check if email is being changed and if it conflicts with existing user
    if (email && email !== existingUser.email) {
      const emailConflict = await prisma.user.findFirst({
        where: {
          email,
          id: {
            not: id
          }
        }
      });

      if (emailConflict) {
        return res.status(409).json({
          error: 'Email Already Exists',
          message: 'A user with this email already exists'
        });
      }
    }

    // Only admin can change roles
    if (role && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: 'Only administrators can change user roles'
      });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email,
        name,
        role,
        entityId
      },
      include: {
        entity: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Remove sensitive information
    const { passwordHash, verificationToken, resetToken, resetTokenExpiry, ...safeUser } = updatedUser;

    res.json({
      message: 'User updated successfully',
      user: safeUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: 'An error occurred while updating the user'
    });
  }
});

// Change password
router.patch('/:id/password', authenticateToken, requireOwnershipOrAdmin('user'), changePasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'The requested user was not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid Current Password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash
      }
    });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: 'An error occurred while changing the password'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientReservations: true,
        supervisorProjects: true,
        clientProjects: true
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'The requested user was not found'
      });
    }

    // Check if user has active projects or reservations
    const hasActiveProjects = user.supervisorProjects.some(p => 
      ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status)
    ) || user.clientProjects.some(p => 
      ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status)
    );

    const hasPendingReservations = user.clientReservations.some(r => r.status === 'PENDING');

    if (hasActiveProjects) {
      return res.status(400).json({
        error: 'Cannot Delete User',
        message: 'Cannot delete user with active projects'
      });
    }

    if (hasPendingReservations) {
      return res.status(400).json({
        error: 'Cannot Delete User',
        message: 'Cannot delete user with pending reservations'
      });
    }

    // Delete user
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'An error occurred while deleting the user'
    });
  }
});

// Get supervisors (for dropdown selection)
router.get('/supervisors/list', authenticateToken, async (req, res) => {
  try {
    const supervisors = await prisma.user.findMany({
      where: {
        role: 'SUPERVISOR',
        isVerified: true
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({ supervisors });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      error: 'Failed to retrieve supervisors',
      message: 'An error occurred while fetching supervisors'
    });
  }
});

// Get clients (for dropdown selection)
router.get('/clients/list', authenticateToken, async (req, res) => {
  try {
    const clients = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        isVerified: true
      },
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
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      error: 'Failed to retrieve clients',
      message: 'An error occurred while fetching clients'
    });
  }
});

// Get user statistics
router.get('/:id/statistics', authenticateToken, requireOwnershipOrAdmin('user'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientReservations: {
          include: {
            field: {
              select: {
                name: true
              }
            }
          }
        },
        supervisorProjects: {
          include: {
            field: {
              select: {
                name: true
              }
            }
          }
        },
        clientProjects: {
          include: {
            field: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'The requested user was not found'
      });
    }

    // Calculate statistics based on user role
    let statistics = {};

    if (user.role === 'CLIENT') {
      const reservationStats = await prisma.reservation.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { clientId: id }
      });

      const projectStats = await prisma.project.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { clientId: id }
      });

      statistics = {
        reservationStatusDistribution: reservationStats,
        projectStatusDistribution: projectStats,
        totalReservations: user.clientReservations.length,
        totalProjects: user.clientProjects.length
      };
    } else if (user.role === 'SUPERVISOR') {
      const projectStats = await prisma.project.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { supervisorId: id }
      });

      const totalSurfaceSupervised = user.supervisorProjects
        .filter(p => ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status))
        .reduce((sum, p) => sum + p.surfaceM2, 0);

      statistics = {
        projectStatusDistribution: projectStats,
        totalProjects: user.supervisorProjects.length,
        totalSurfaceSupervised,
        activeProjects: user.supervisorProjects.filter(p => 
          ['EN_COURS', 'PROGRAMME', 'A_LANCER'].includes(p.status)
        ).length
      };
    }

    res.json({ statistics });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user statistics',
      message: 'An error occurred while fetching user statistics'
    });
  }
});

module.exports = router;