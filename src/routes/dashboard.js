const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get admin dashboard overview
router.get('/admin', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    // Get pending reservations count
    const pendingReservations = await prisma.reservation.count({
      where: { status: 'PENDING' }
    });

    // Get inventory items that need attention
    const inventoryAlerts = await prisma.inventoryItem.count({
      where: {
        condition: {
          in: ['NON_CONFORME', 'MAUVAIS']
        }
      }
    });

    // Get outstanding price offers
    const outstandingOffers = await prisma.priceOffer.count({
      where: {
        status: {
          in: ['PENDING', 'SENT']
        }
      }
    });

    // Get service orders in progress
    const serviceOrdersInProgress = await prisma.serviceOrder.count({
      where: { status: 'IN_PROGRESS' }
    });

    // Get field utilization overview
    const fields = await prisma.field.findMany({
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

    const fieldUtilization = fields.map(field => {
      const usedSurface = field.projects.reduce((sum, project) => sum + project.surfaceM2, 0);
      const utilizationPercentage = (usedSurface / field.totalSurfaceM2) * 100;
      
      return {
        id: field.id,
        name: field.name,
        totalSurfaceM2: field.totalSurfaceM2,
        usedSurfaceM2: usedSurface,
        freeSurfaceM2: field.freeSurfaceM2,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        status: field.status
      };
    });

    // Get recent projects
    const recentProjects = await prisma.project.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
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
            name: true
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

    // Get project status distribution
    const projectStatusStats = await prisma.project.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get monthly project trends
    const monthlyTrends = await prisma.project.groupBy({
      by: ['startDate'],
      _count: {
        id: true
      },
      where: {
        startDate: {
          gte: new Date(new Date().getFullYear(), 0, 1) // From January 1st of current year
        }
      }
    });

    // Get activity type distribution
    const activityTypeStats = await prisma.project.groupBy({
      by: ['activityTypeId'],
      _count: {
        id: true
      },
      include: {
        activityType: {
          select: {
            label: true
          }
        }
      }
    });

    res.json({
      overview: {
        pendingReservations,
        inventoryAlerts,
        outstandingOffers,
        serviceOrdersInProgress
      },
      fieldUtilization,
      recentProjects,
      statistics: {
        projectStatusDistribution: projectStatusStats,
        monthlyTrends,
        activityTypeDistribution: activityTypeStats
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve admin dashboard',
      message: 'An error occurred while fetching dashboard data'
    });
  }
});

// Get supervisor dashboard
router.get('/supervisor', authenticateToken, requireRole('SUPERVISOR'), async (req, res) => {
  try {
    // Get assigned projects
    const assignedProjects = await prisma.project.findMany({
      where: {
        supervisorId: req.user.id
      },
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
    });

    // Get project statistics for supervisor
    const projectStats = await prisma.project.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: {
        supervisorId: req.user.id
      }
    });

    // Get upcoming deadlines (projects ending in next 30 days)
    const upcomingDeadlines = await prisma.project.findMany({
      where: {
        supervisorId: req.user.id,
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
        },
        status: {
          in: ['EN_COURS', 'PROGRAMME', 'A_LANCER']
        }
      },
      include: {
        client: {
          select: {
            name: true,
            email: true
          }
        },
        field: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        endDate: 'asc'
      }
    });

    res.json({
      assignedProjects,
      projectStatistics: projectStats,
      upcomingDeadlines
    });
  } catch (error) {
    console.error('Get supervisor dashboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve supervisor dashboard',
      message: 'An error occurred while fetching dashboard data'
    });
  }
});

// Get client dashboard
router.get('/client', authenticateToken, requireRole('CLIENT'), async (req, res) => {
  try {
    // Get client's reservations
    const reservations = await prisma.reservation.findMany({
      where: {
        clientId: req.user.id
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        supervisor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            progressNotes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get client's projects
    const projects = await prisma.project.findMany({
      where: {
        clientId: req.user.id
      },
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
    });

    // Get reservation statistics
    const reservationStats = await prisma.reservation.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: {
        clientId: req.user.id
      }
    });

    // Get project statistics
    const projectStats = await prisma.project.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: {
        clientId: req.user.id
      }
    });

    res.json({
      reservations,
      projects,
      statistics: {
        reservationStatusDistribution: reservationStats,
        projectStatusDistribution: projectStats
      }
    });
  } catch (error) {
    console.error('Get client dashboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve client dashboard',
      message: 'An error occurred while fetching dashboard data'
    });
  }
});

// Get general statistics (for all users)
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    // Get total counts
    const totalFields = await prisma.field.count();
    const totalProjects = await prisma.project.count();
    const totalUsers = await prisma.user.count();
    const totalReservations = await prisma.reservation.count();

    // Get active counts
    const activeFields = await prisma.field.count({
      where: { status: 'ACTIVE' }
    });

    const activeProjects = await prisma.project.count({
      where: {
        status: {
          in: ['EN_COURS', 'PROGRAMME', 'A_LANCER']
        }
      }
    });

    const pendingReservations = await prisma.reservation.count({
      where: { status: 'PENDING' }
    });

    // Get user role distribution
    const userRoleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });

    // Get project status distribution
    const projectStatusStats = await prisma.project.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get field utilization summary
    const fields = await prisma.field.findMany({
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

    const totalSurfaceM2 = fields.reduce((sum, field) => sum + field.totalSurfaceM2, 0);
    const usedSurfaceM2 = fields.reduce((sum, field) => {
      const usedSurface = field.projects.reduce((projectSum, project) => projectSum + project.surfaceM2, 0);
      return sum + usedSurface;
    }, 0);

    const overallUtilizationPercentage = totalSurfaceM2 > 0 ? (usedSurfaceM2 / totalSurfaceM2) * 100 : 0;

    res.json({
      overview: {
        totalFields,
        activeFields,
        totalProjects,
        activeProjects,
        totalUsers,
        totalReservations,
        pendingReservations,
        totalSurfaceM2,
        usedSurfaceM2,
        overallUtilizationPercentage: Math.round(overallUtilizationPercentage * 100) / 100
      },
      distributions: {
        userRoles: userRoleStats,
        projectStatus: projectStatusStats
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: 'An error occurred while fetching statistics'
    });
  }
});

// Get timeline data for projects
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause = {};
    
    if (startDate && endDate) {
      whereClause.OR = [
        {
          startDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        {
          endDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
      ];
    }

    // Add role-based filtering
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
            name: true
          }
        },
        supervisor: {
          select: {
            id: true,
            name: true
          }
        },
        field: {
          select: {
            id: true,
            name: true
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
        startDate: 'asc'
      }
    });

    // Format timeline data
    const timelineData = projects.map(project => ({
      id: project.id,
      title: project.title,
      start: project.startDate,
      end: project.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // If no end date, set to 1 year from now
      status: project.status,
      client: project.client.name,
      supervisor: project.supervisor.name,
      field: project.field.name,
      activityType: project.activityType?.label,
      surfaceM2: project.surfaceM2
    }));

    res.json({
      timeline: timelineData
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      error: 'Failed to retrieve timeline',
      message: 'An error occurred while fetching timeline data'
    });
  }
});

module.exports = router; 