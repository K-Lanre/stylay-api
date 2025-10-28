# Project Context

## Purpose
Stylay is a comprehensive multi-vendor e-commerce API platform built with Node.js that powers modern online marketplaces. It provides robust backend services for:

- **Multi-vendor marketplace**: Vendors can onboard, manage products/inventory, and track sales
- **Complete e-commerce workflow**: From product browsing to order fulfillment across multiple vendors
- **Advanced authentication system**: JWT-based auth with role-based access control (Customer, Vendor, Admin) including granular permissions
- **Complex order processing**: Multi-vendor order coordination, payment reconciliation, and fulfillment tracking
- **Inventory & supply management**: Stock tracking, bulk supply operations, and vendor coordination
- **Comprehensive notification system**: Automated email notifications for orders, shipping, payments, and vendor communications
- **Administrative oversight**: Dashboard analytics, user management, and business intelligence tools

The platform serves as the backbone for e-commerce applications, supporting both web and mobile clients through versioned REST APIs with comprehensive validation and error handling.

## Tech Stack
- **Runtime:** Node.js (v14.x+)
- **Web Framework:** Express.js
- **Database:** MySQL (v8.0+) with Sequelize ORM
- **Authentication:** JWT (JSON Web Tokens) with Passport.js
- **Security:** Helmet, CORS, XSS protection, HPP, rate limiting
- **File Storage:** AWS S3 with Multer for file uploads
- **Email:** Nodemailer for transactional emails
- **Payment:** External payment gateway integration
- **Validation:** Express-validator with custom validation middleware
- **Logging:** Winston for structured logging
- **Development:** Nodemon, ESLint, Prettier

## Project Conventions

### Code Style
- **JavaScript Standard:** ES6+ with modern async/await patterns
- **Linting:** Airbnb ESLint configuration (`eslint-config-airbnb-base`)
- **Formatting:** Prettier for consistent code formatting
- **Naming:** camelCase for variables/functions, PascalCase for classes, snake_case for database columns (Sequelize convention)
- **File Structure:** Feature-based organization with clear separation of concerns

### Architecture Patterns
- **MVC-Inspired:** Routes → Controllers → Models/Services pattern
- **Service Layer:** Business logic extracted into service files (email, payment, permissions)
- **Middleware Chain:** Extensive use of Express middleware for cross-cutting concerns
- **Validation:** Centralized validation logic in validators directory
- **Error Handling:** Custom error classes with centralized error middleware
- **Database Patterns:** Sequelize models with associations, migrations, and seeders

### Testing Strategy
- **Framework:** Jest with Supertest for API testing
- **Coverage Goals:** High test coverage targeting core business logic
- **Testing Focus:** Unit tests for services, integration tests for API endpoints
- **Mocking:** External dependencies (email, payment) are mocked for reliable testing

### Git Workflow
- **Branching:** Feature branches from main, reviewed via pull requests
- **Commits:** Conventional commits with descriptive messages
- **Repository:** GitHub repository with CI/CD pipeline
- **Version Control:** Standard Git flow with protected main branch

## Domain Context
**E-commerce Domain Knowledge Required:**

- **Multi-vendor Marketplace:** Vendors onboard, manage products, track sales, receive payouts
- **Order Fulfillment:** Complex order states, vendor coordination, payment reconciliation
- **Inventory Management:** Stock tracking, supply chain coordination, variant management
- **Payment Processing:** Secure payment flows, webhook handling, transaction reconciliation
- **User Roles:** Customer journey, vendor operations, administrative oversight

**Business Rules:**
- Orders span multiple vendors requiring coordinated fulfillment
- Vendors maintain separate product catalogs with approval workflows
- Inventory levels must sync with supply chain and sales data
- Payment reconciliation affects multiple stakeholders (customers, vendors, platform)

## Important Constraints
- **Database:** MySQL transaction handling and foreign key relationships
- **Security:** PCI compliance considerations for payment data
- **Performance:** Rate limiting to prevent API abuse (100 req/15min default)
- **File Uploads:** 10MB size limits, secure temporary file handling
- **CORS:** Configurable origins for web/mobile client access

## External Dependencies
- **AWS Services:** S3 for file storage, SES for email delivery
- **Payment Gateway:** External payment processing (webhook integration)
- **SMS Services:** Phone verification for user registration
- **Email Services:** SMTP configuration for transactional emails
- **Database:** MySQL hosting and connection management
