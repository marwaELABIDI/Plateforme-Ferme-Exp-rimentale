# AITTC Experimental Farm Management System

## Project Overview
This project digitizes the paper-based management system of the AITTC Experimental Farm, providing a comprehensive web application for field reservations, project management, inventory tracking, and administrative workflows.

## Objectives
- Enable external clients to register and request field reservations
- Provide admin control over users, fields, projects, inventory, and documents
- Track real-time field utilization and project status
- Digitize forms F.10 (inventory), F.47 (price offers), and F.84 (service orders)
- Implement role-based access control (Admin, Supervisor, Client)

## System Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React with TypeScript
- **Authentication**: JWT with email verification
- **File Storage**: Local file system for PDF generation
- **Email**: Nodemailer for notifications

### Database Schema
The system uses a relational database with the following core entities:
- Users (Admin, Supervisor, Client roles)
- Entities (organizations)
- Fields (with surface area tracking)
- Projects (linked to fields and users)
- Reservations (client requests)
- ActivityTypes (categorization)
- InventoryItems (F.10 form data)
- PriceOffers (F.47 form data)
- ServiceOrders (F.84 form data)

## Installation and Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation Steps
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run database migrations: `npm run db:migrate`
5. Seed initial data: `npm run db:seed`
6. Start the development server: `npm run dev`

## User Roles and Permissions

### Admin
- Full CRUD access to all entities
- Approve/reject reservations
- Assign supervisors to projects
- Manage inventory and alerts
- Generate reports and exports

### Supervisor
- View assigned projects
- Update project status and progress
- Cannot modify approvals or field allocations

### Client
- Register with email verification
- Submit field reservation requests
- View own reservations and projects
- Cannot access other users' data

## Core Features

### Field Management
- Real-time surface area tracking
- Visual utilization indicators
- Status management (Active/Inactive)
- Location and notes

### Reservation System
- Client request workflow
- Admin approval/rejection
- Automatic surface area deduction
- Supervisor assignment

### Project Tracking
- Timeline visualization
- Status updates (En cours, Finalisé, Programme, A lancer)
- Progress notes and documentation

### Document Management
- Digital forms for F.10, F.47, F.84
- PDF generation and archiving
- Search and filtering capabilities
- Export functionality (CSV/PDF)

### Inventory Management
- Stock tracking with alerts
- Condition monitoring
- Location management
- Weekly inventory updates

## Business Rules
- Reservations cannot exceed available field surface
- Project completion releases surface area back to fields
- Fields with active projects cannot be deleted
- Inventory alerts for non-conforming items
- Form versioning for audit trails

## API Documentation
The system provides RESTful APIs for all operations with proper authentication and authorization.

## Testing
Comprehensive test suite covering:
- User authentication and authorization
- Business rule validation
- API endpoints
- User workflows
- Data integrity

## Deployment
The application can be deployed using Docker containers with proper environment configuration.

## Support
For technical support or questions, please contact the development team. 