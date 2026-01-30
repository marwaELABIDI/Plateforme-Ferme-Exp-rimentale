const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to generate CSV
const generateCSV = async (data, headers, filename) => {
  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: headers
  });
  
  await csvWriter.writeRecords(data);
  return filename;
};

// Helper function to generate PDF
const generatePDF = (data, title, filename) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filename);
    
    doc.pipe(stream);
    
    // Add title
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();
    
    // Add data
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        doc.fontSize(12).text(`${index + 1}. ${JSON.stringify(item)}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(12).text(JSON.stringify(data, null, 2));
    }
    
    doc.end();
    
    stream.on('finish', () => resolve(filename));
    stream.on('error', reject);
  });
};

// Export fields data
router.get('/fields', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const fields = await prisma.field.findMany({
      include: {
        projects: {
          include: {
            client: { select: { name: true, email: true } },
            supervisor: { select: { name: true, email: true } }
          }
        }
      }
    });

    const filename = `fields_export_${Date.now()}.${format}`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    if (format === 'csv') {
      const headers = [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'location', title: 'Location' },
        { id: 'totalSurfaceM2', title: 'Total Surface (m²)' },
        { id: 'freeSurfaceM2', title: 'Free Surface (m²)' },
        { id: 'status', title: 'Status' },
        { id: 'notes', title: 'Notes' },
        { id: 'createdAt', title: 'Created At' }
      ];

      const csvData = fields.map(field => ({
        id: field.id,
        name: field.name,
        location: field.location,
        totalSurfaceM2: field.totalSurfaceM2,
        freeSurfaceM2: field.freeSurfaceM2,
        status: field.status,
        notes: field.notes || '',
        createdAt: field.createdAt.toISOString()
      }));

      await generateCSV(csvData, headers, filepath);
    } else if (format === 'pdf') {
      await generatePDF(fields, 'Fields Export', filepath);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export fields data' });
  }
});

// Export projects data
router.get('/projects', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { format = 'csv', status, startDate, endDate } = req.query;
    const { role, userId } = req.user;

    // Build filter conditions
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }
    
    // Supervisors can only see their assigned projects
    if (role === 'SUPERVISOR') {
      where.supervisorId = userId;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        field: true,
        client: { select: { name: true, email: true } },
        supervisor: { select: { name: true, email: true } },
        activityType: true
      }
    });

    const filename = `projects_export_${Date.now()}.${format}`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    if (format === 'csv') {
      const headers = [
        { id: 'id', title: 'ID' },
        { id: 'title', title: 'Title' },
        { id: 'fieldName', title: 'Field' },
        { id: 'clientName', title: 'Client' },
        { id: 'supervisorName', title: 'Supervisor' },
        { id: 'activityType', title: 'Activity Type' },
        { id: 'surfaceM2', title: 'Surface (m²)' },
        { id: 'startDate', title: 'Start Date' },
        { id: 'endDate', title: 'End Date' },
        { id: 'status', title: 'Status' },
        { id: 'progressNotes', title: 'Progress Notes' }
      ];

      const csvData = projects.map(project => ({
        id: project.id,
        title: project.title,
        fieldName: project.field.name,
        clientName: project.client.name,
        supervisorName: project.supervisor.name,
        activityType: project.activityType?.label || '',
        surfaceM2: project.surfaceM2,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() || '',
        status: project.status,
        progressNotes: project.progressNotes || ''
      }));

      await generateCSV(csvData, headers, filepath);
    } else if (format === 'pdf') {
      await generatePDF(projects, 'Projects Export', filepath);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export projects data' });
  }
});

// Export inventory data
router.get('/inventory', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { format = 'csv', condition, family } = req.query;
    
    const where = {};
    if (condition) where.condition = condition;
    if (family) where.family = { contains: family, mode: 'insensitive' };

    const inventory = await prisma.inventoryItem.findMany({ where });

    const filename = `inventory_export_${Date.now()}.${format}`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    if (format === 'csv') {
      const headers = [
        { id: 'id', title: 'ID' },
        { id: 'owner', title: 'Owner' },
        { id: 'family', title: 'Family' },
        { id: 'subFamily', title: 'Sub Family' },
        { id: 'designation', title: 'Designation' },
        { id: 'stockQty', title: 'Stock Quantity' },
        { id: 'unit', title: 'Unit' },
        { id: 'condition', title: 'Condition' },
        { id: 'location', title: 'Location' },
        { id: 'lastChecked', title: 'Last Checked' }
      ];

      const csvData = inventory.map(item => ({
        id: item.id,
        owner: item.owner,
        family: item.family,
        subFamily: item.subFamily || '',
        designation: item.designation,
        stockQty: item.stockQty,
        unit: item.unit,
        condition: item.condition,
        location: item.location,
        lastChecked: item.lastChecked.toISOString()
      }));

      await generateCSV(csvData, headers, filepath);
    } else if (format === 'pdf') {
      await generatePDF(inventory, 'Inventory Export', filepath);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export inventory data' });
  }
});

// Export reservations data
router.get('/reservations', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { format = 'csv', status, startDate, endDate } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startRequested = {};
      if (startDate) where.startRequested.gte = new Date(startDate);
      if (endDate) where.startRequested.lte = new Date(endDate);
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        client: { select: { name: true, email: true } },
        field: true,
        supervisor: { select: { name: true, email: true } }
      }
    });

    const filename = `reservations_export_${Date.now()}.${format}`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    if (format === 'csv') {
      const headers = [
        { id: 'id', title: 'ID' },
        { id: 'clientName', title: 'Client' },
        { id: 'fieldName', title: 'Field' },
        { id: 'surfaceM2Requested', title: 'Surface Requested (m²)' },
        { id: 'startRequested', title: 'Start Date Requested' },
        { id: 'endRequested', title: 'End Date Requested' },
        { id: 'status', title: 'Status' },
        { id: 'supervisorName', title: 'Supervisor' },
        { id: 'decisionDate', title: 'Decision Date' },
        { id: 'createdAt', title: 'Created At' }
      ];

      const csvData = reservations.map(reservation => ({
        id: reservation.id,
        clientName: reservation.client.name,
        fieldName: reservation.field.name,
        surfaceM2Requested: reservation.surfaceM2Requested,
        startRequested: reservation.startRequested.toISOString(),
        endRequested: reservation.endRequested.toISOString(),
        status: reservation.status,
        supervisorName: reservation.supervisor?.name || '',
        decisionDate: reservation.decisionDate?.toISOString() || '',
        createdAt: reservation.createdAt.toISOString()
      }));

      await generateCSV(csvData, headers, filepath);
    } else if (format === 'pdf') {
      await generatePDF(reservations, 'Reservations Export', filepath);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export reservations data' });
  }
});

// Export users data
router.get('/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { format = 'csv', role } = req.query;
    
    const where = {};
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      include: {
        entity: true
      }
    });

    const filename = `users_export_${Date.now()}.${format}`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    if (format === 'csv') {
      const headers = [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'role', title: 'Role' },
        { id: 'entityName', title: 'Entity' },
        { id: 'isVerified', title: 'Verified' },
        { id: 'createdAt', title: 'Created At' }
      ];

      const csvData = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        entityName: user.entity?.name || '',
        isVerified: user.isVerified,
        createdAt: user.createdAt.toISOString()
      }));

      await generateCSV(csvData, headers, filepath);
    } else if (format === 'pdf') {
      await generatePDF(users, 'Users Export', filepath);
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export users data' });
  }
});

// Export comprehensive report
router.get('/comprehensive-report', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
    }

    const [fields, projects, reservations, inventory, users] = await Promise.all([
      prisma.field.findMany(),
      prisma.project.findMany({
        where: { createdAt: dateFilter },
        include: {
          field: true,
          client: { select: { name: true } },
          supervisor: { select: { name: true } }
        }
      }),
      prisma.reservation.findMany({
        where: { createdAt: dateFilter },
        include: {
          client: { select: { name: true } },
          field: true
        }
      }),
      prisma.inventoryItem.findMany(),
      prisma.user.findMany({
        include: { entity: true }
      })
    ]);

    const report = {
      summary: {
        totalFields: fields.length,
        totalProjects: projects.length,
        totalReservations: reservations.length,
        totalInventoryItems: inventory.length,
        totalUsers: users.length,
        activeFields: fields.filter(f => f.status === 'ACTIVE').length,
        completedProjects: projects.filter(p => p.status === 'FINALISE').length,
        pendingReservations: reservations.filter(r => r.status === 'PENDING').length
      },
      fields,
      projects,
      reservations,
      inventory,
      users
    };

    const filename = `comprehensive_report_${Date.now()}.pdf`;
    const filepath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

    await generatePDF(report, 'Comprehensive Farm Management Report', filepath);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export comprehensive report' });
  }
});

module.exports = router; 