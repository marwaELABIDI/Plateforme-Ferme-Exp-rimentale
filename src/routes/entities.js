const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all entities with users, projects, and fields
router.get('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const entities = await prisma.entity.findMany({
      include: {
        users: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // For each entity, collect all projects for all users (as clients), with full links
    const result = [];
    for (const entity of entities) {
      // Get all projects for all users in this entity
      const userIds = entity.users.map(u => u.id);
      const projects = await prisma.project.findMany({
        where: { clientId: { in: userIds } },
        include: {
          field: { select: { id: true, name: true } },
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              entity: { select: { id: true, name: true, notes: true } }
            }
          },
          supervisor: { select: { id: true, name: true, email: true } },
          activityType: { select: { id: true, label: true } }
        }
      });
      // Collect all fields used by this entity's projects
      const fields = projects.map(p => p.field).filter(Boolean);
      result.push({
        id: entity.id,
        name: entity.name,
        users: entity.users,
        projects,
        fields
      });
    }
    res.json({ entities: result });
  } catch (error) {
    console.error('Get entities error:', error);
    res.status(500).json({ error: 'Failed to retrieve entities' });
  }
});

module.exports = router; 