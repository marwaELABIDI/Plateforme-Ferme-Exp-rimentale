const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access Token Required',
      message: 'No authentication token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are verified
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        entityId: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'User not found'
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Account Not Verified',
        message: 'Please verify your email address before accessing the system'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: 'Authentication token has expired'
      });
    }
    
    return res.status(403).json({
      error: 'Invalid Token',
      message: 'Invalid authentication token'
    });
  }
};

// Middleware to check if user has required role(s)
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'User must be authenticated'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// Middleware to check if user can access their own data or is admin
const requireOwnershipOrAdmin = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'User must be authenticated'
      });
    }

    // Admin can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const resourceId = req.params.id || req.params.userId;
    
    if (!resourceId) {
      return res.status(400).json({
        error: 'Resource ID Required',
        message: 'Resource ID is required for ownership verification'
      });
    }

    try {
      let resource;
      
      switch (resourceType) {
        case 'user':
          resource = await prisma.user.findUnique({
            where: { id: resourceId },
            select: { id: true, role: true }
          });
          break;
        case 'reservation':
          resource = await prisma.reservation.findUnique({
            where: { id: resourceId },
            select: { id: true, clientId: true }
          });
          break;
        case 'project':
          resource = await prisma.project.findUnique({
            where: { id: resourceId },
            select: { id: true, clientId: true, supervisorId: true }
          });
          break;
        default:
          return res.status(400).json({
            error: 'Invalid Resource Type',
            message: 'Invalid resource type for ownership verification'
          });
      }

      if (!resource) {
        return res.status(404).json({
          error: 'Resource Not Found',
          message: 'The requested resource was not found'
        });
      }

      // Check ownership based on resource type
      let hasAccess = false;
      
      switch (resourceType) {
        case 'user':
          hasAccess = resource.id === req.user.id;
          break;
        case 'reservation':
          hasAccess = resource.clientId === req.user.id;
          break;
        case 'project':
          hasAccess = resource.clientId === req.user.id || resource.supervisorId === req.user.id;
          break;
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership verification error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Error verifying resource ownership'
      });
    }
  };
};

// Middleware to check if user is supervisor for a project
const requireSupervisorAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'User must be authenticated'
    });
  }

  const projectId = req.params.projectId || req.params.id;
  
  if (!projectId) {
    return res.status(400).json({
      error: 'Project ID Required',
      message: 'Project ID is required for supervisor verification'
    });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, supervisorId: true }
    });

    if (!project) {
      return res.status(404).json({
        error: 'Project Not Found',
        message: 'The requested project was not found'
      });
    }

    // Admin can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check if user is the supervisor for this project
    if (project.supervisorId !== req.user.id) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only access projects you are supervising'
      });
    }

    next();
  } catch (error) {
    console.error('Supervisor verification error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error verifying supervisor access'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnershipOrAdmin,
  requireSupervisorAccess
}; 