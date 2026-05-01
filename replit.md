# Overview

This project is a comprehensive logistics and order management system designed to optimize logistics, enhance profit tracking, and improve delivery coordination. Built with React, Express, and PostgreSQL, it offers role-based access for various staff roles (owner, customer service, receptionist, sorter, stock manager, shipping). The system enables robust management of orders, customers, inventory, profits, and delivery tasks. Key capabilities include modern authentication, real-time data, bilingual support (English/Arabic), a responsive UI, streamlined data entry, and a complete shipping/delivery task management system. It also features an owner-only performance report system with key KPIs and a comprehensive LYD currency conversion system tracking per-order exchange rates, and is optimized for high performance with large datasets.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is a React 18 TypeScript Single Page Application utilizing Wouter for routing, TanStack Query for server state management, and Tailwind CSS with shadcn/ui for styling. Form handling is managed with React Hook Form and Zod, and the build process uses Vite. Global state is managed via React Context. The UI/UX is designed for responsiveness, bilingual support, and streamlined data entry across all devices.

## Backend Architecture

The backend is an Express.js TypeScript REST API. It uses Passport.js for authentication and role-based access control. Data persistence and session management are handled by PostgreSQL with Drizzle ORM. API endpoints are organized by feature and include Zod for request validation. A critical design decision ensures transactional safety for all invoice and return operations using database transactions, row locking (`SELECT ... FOR UPDATE`), and idempotency keys to prevent race conditions and duplicate entries. An `operation_log` table provides a full audit trail. The system also includes a robust Partner Capital System for managing owner accounts and transactions, and a Goods Capital system that tracks product capital, identifies missing cost prices, and displays both cost and selling values.

## Data Storage Solutions

PostgreSQL is the primary database, accessed via Drizzle ORM, with Neon serverless PostgreSQL for cloud deployment. The schema is relational, employing foreign keys and enums for roles and statuses, and numeric types for currency.

## Authentication and Authorization Mechanisms

Security is implemented through session-based authentication with Passport.js and bcrypt-hashed passwords. Role-based middleware enforces authorization. Sessions are persistent and stored in PostgreSQL, with both frontend and backend implementing route guards for security.

## UI/UX Decisions & Feature Specifications

The system provides comprehensive functionality with a responsive, bilingual (English/Arabic) interface:

-   **Comprehensive Shipping/Delivery Task Management**: A dedicated "shipping_staff" role dashboard with task assignment, status updates, payment collection, and performance tracking.
-   **Internal Messaging System**: Features conversation threading, real-time notifications, and a chat-style UI.
-   **User Profile Management**: Allows users to securely edit their username, name, and password.
-   **Enhanced Profit Page & Unified Reports**: Detailed profit metrics, average order value, country-specific filtering, and an owner-only unified profit reports page with 10 KPIs, advanced filtering (time range, country, custom dates), and visual growth indicators.
-   **Credit System - Customer Receivables & Supplier Payables**: Supports credit invoices with `paymentStatus`, `paidAmount`, `remainingAmount`, and a dedicated "Credits & Debts" page for managing receivables, payables, and payment history.
-   **Global Price Markup System**: An owner-controlled percentage markup system applied dynamically to product prices for exchange rate stability, without modifying base prices in the database.
-   **LYD Currency Conversion System with Dual Exchange Rates**: Implements dual-currency display (USD/LYD) across the system. It tracks separate purchase and sale exchange rates globally and per-order, enabling accurate profit calculation and exchange rate profit/loss tracking.
-   **Order Management**: Includes new order statuses, dynamic country and LYD exchange rate filters, calendar date range filters, flexible order creation, and automatic order status routing for "Ready to Buy" items.
-   **Ready to Buy Dashboard**: A dedicated dashboard for orders awaiting purchase, with automatic routing based on down payment status.
-   **Customer Management**: Features customer-level down payment management, multi-field search, enhanced visibility of customer codes, and streamlined customer creation.
-   **Order Image Upload System**: Supports direct device file selection and cloud-based object storage for up to 3 images per order.
-   **Complete Arabic Translation Coverage**: All UI elements, modals, and reports are fully translated with proper RTL layout.
-   **Responsive Design Implementation**: Fully responsive UI across all devices, with specific fixes for RTL and mobile experiences.
-   **Persistent Dark Mode**: ThemeProvider with localStorage sync for dark mode preferences.

# External Dependencies

## Third-Party Services

-   **Neon Database**: Serverless PostgreSQL hosting.

## Key Libraries and Frameworks

-   **Frontend**: React, TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, React Hook Form, Zod.
-   **Backend**: Express.js, Passport.js, Drizzle ORM, connect-pg-simple.
-   **UI Components**: Radix UI primitives.
-   **Utilities**: date-fns, class-variance-authority, clsx.