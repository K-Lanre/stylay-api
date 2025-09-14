# STYLAY E-Commerce API

A robust, scalable, and secure e-commerce API built with Node.js, Express, and MySQL. This API powers the STYLAY e-commerce platform, providing all the necessary endpoints for a modern online shopping experience.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Admin, Vendor, Customer)
  - Email verification
  - Password reset functionality

- **Product Management**
  - CRUD operations for products
  - Product categories and tags
  - Product variants and inventory management
  - Product search and filtering

- **Supply Management**
  - Track product supplies from vendors
  - Bulk supply creation
  - Inventory updates on supply
  - Supply history and reporting

- **Shopping Experience**
  - Shopping cart functionality
  - Wishlist management
  - Product reviews and ratings
  - Related products

- **Order Processing**
  - Checkout process
  - Order tracking
  - Order history
  - Payment integration
## 📦 Order API Endpoints

This section details the API endpoints for managing orders, including their methods, paths, descriptions, required authentication/authorization, and applied validation middleware.

### Customer Endpoints

-   **Create a new order**
    -   **Method:** `POST`
    -   **Path:** `/api/orders`
    -   **Description:** Allows an authenticated customer to create a new order.
    -   **Authentication:** Required (Customer)
    -   **Validation:** `createOrderValidation`, `validate`

-   **Get authenticated user's orders**
    -   **Method:** `GET`
    -   **Path:** `/api/orders/my-orders`
    -   **Description:** Retrieves a paginated list of orders for the authenticated customer.
    -   **Authentication:** Required (Customer)
    -   **Validation:** `getOrdersValidation`, `validate`

-   **Get a specific order by ID**
    -   **Method:** `GET`
    -   **Path:** `/api/orders/:id`
    -   **Description:** Retrieves details of a specific order belonging to the authenticated customer.
    -   **Authentication:** Required (Customer)
    -   **Validation:** `getOrderValidation`, `validate`

-   **Cancel an order**
    -   **Method:** `PATCH`
    -   **Path:** `/api/orders/:id/cancel`
    -   **Description:** Allows an authenticated customer to cancel an order if it's in a cancellable state.
    -   **Authentication:** Required (Customer)
    -   **Validation:** `cancelOrderValidation`, `validate`

### Payment Endpoints

-   **Verify payment for an order**
    -   **Method:** `GET`
    -   **Path:** `/api/orders/verify-payment/:reference`
    -   **Description:** Verifies the status of a payment with the payment gateway using a reference.
    -   **Authentication:** Required (Customer)
    -   **Validation:** `verifyPaymentValidation`, `validate`

-   **Handle payment gateway webhook**
    -   **Method:** `POST`
    -   **Path:** `/api/orders/webhook/payment`
    -   **Description:** Endpoint for payment gateway callbacks to update payment status.
    -   **Authentication:** None (Public)
    -   **Validation:** None (raw body parsing handled by Express)

### Vendor Endpoints

-   **Get vendor's orders**
    -   **Method:** `GET`
    -   **Path:** `/api/orders/vendor/orders`
    -   **Description:** Retrieves a paginated list of orders containing products from the authenticated vendor.
    -   **Authentication:** Required (Vendor)
    -   **Validation:** None (query parameters handled by controller)

-   **Update order item status**
    -   **Method:** `PATCH`
    -   **Path:** `/api/orders/items/:id/status`
    -   **Description:** Allows an authenticated vendor to update the status of a specific order item.
    -   **Authentication:** Required (Vendor)
    -   **Validation:** `updateOrderStatusValidation`, `validate`

### Admin Endpoints

-   **Get all orders**
    -   **Method:** `GET`
    -   **Path:** `/api/orders`
    -   **Description:** Retrieves a paginated list of all orders in the system.
    -   **Authentication:** Required (Admin)
    -   **Validation:** None (query parameters handled by controller)

-   **Update overall order status**
    -   **Method:** `PATCH`
    -   **Path:** `/api/orders/:id/status`
    -   **Description:** Allows an authenticated admin to update the overall status of an order.
    -   **Authentication:** Required (Admin)
    -   **Validation:** `updateOrderStatusValidation`, `validate`


- **Vendor Management**
  - Vendor registration and management
  - Product listing management
  - Sales analytics

## 🛠 Technologies Used

- **Backend Framework:** Node.js with Express.js
- **Database:** Mysql with Sequelize ODM
- **Authentication:** JSON Web Tokens (JWT)
- **File Upload:** Multer
- **Email Service:** Nodemailer
- **API Documentation:** Swagger/OpenAPI
- **Testing:** Jest, Supertest
- **Containerization:** Docker
- **CI/CD:** GitHub Actions

## 📦 Prerequisites

- Node.js (v14.x or higher)
- MySQL (v8.0 or higher) - *Note: The Dockerized setup will use port 3307 on the host to avoid conflicts with local MySQL installations.*
- npm (v7.x or higher) or yarn
- Git

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/K-Lanre/stylay-api.git](https://github.com/K-Lanre/stylay-api.git)
   cd stylay-api