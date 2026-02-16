# Overview

This project is a comprehensive logistics and order management system built with React, Express, and PostgreSQL. It offers role-based access for various staff (owner, customer service, receptionist, sorter, stock manager, shipping), enabling management of orders, customers, inventory, profits, and delivery tasks. Key features include modern authentication, real-time data, bilingual support (English/Arabic), a responsive UI, streamlined data entry, and a complete shipping/delivery task management system. The system aims to optimize logistics, enhance profit tracking, and improve delivery coordination. It includes advanced features like an owner-only performance report system with key KPIs and a comprehensive LYD currency conversion system tracking per-order exchange rates.

**Performance**: Optimized for 100,000+ products with server-side pagination (50 items/page, max 200), pg_trgm GIN trigram indexes for fast text search, pure SQL stats aggregation, and debounced search (400ms). All product endpoints are paginated - no full-table loads.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is a React 18 TypeScript SPA using Wouter for routing, TanStack Query for server state, and Tailwind CSS with shadcn/ui for styling. React Hook Form with Zod handles forms, and Vite is used for building. Global state is managed via React Context. The UI/UX emphasizes responsiveness, bilingual support, and streamlined data entry across desktop and mobile.

## Backend Architecture

The backend is an Express.js TypeScript REST API. It uses Passport.js for authentication and role-based access control. PostgreSQL with Drizzle ORM handles data persistence and session management. API endpoints are feature-organized with Zod for request validation.

## Data Storage Solutions

PostgreSQL is the primary database, accessed via Drizzle ORM. Neon serverless PostgreSQL provides cloud deployment. The schema is relational, with foreign keys across users, customers, orders, inventory, and shipping rates, utilizing enums for roles/statuses and numeric types for currency.

## Authentication and Authorization Mechanisms

Security involves session-based authentication with Passport.js and bcrypt-hashed passwords. Role-based middleware enforces authorization. Sessions are persistent and stored in PostgreSQL. Both frontend and backend implement route guards for authentication and authorization.

## UI/UX Decisions & Feature Specifications

The system features comprehensive functionality with responsive interface, bilingual support (English/Arabic), and streamlined data entry:

- **Comprehensive Shipping/Delivery Task Management**: Dedicated "shipping_staff" role with dashboard, task assignment interface, status updates (completed, to collect with customer code), payment collection workflow, and performance tracking. Full bilingual support with RTL layout and smart search across all fields.

- **Internal Messaging System**: Conversation threading, real-time notifications, and chat-style UI for viewing full message history between users.

- **User Profile Management**: All users can edit their own username, name, and password with secure validation.

- **Enhanced Profit Page**: Detailed metrics, average order value, country-specific filtering, and customer shipping code reporting with comprehensive profit breakdown (items profit, shipping profit, total profit).

- **Unified Profit Reports Page (Owner-Only)**: 
  - Single-page unified view with all profit metrics and performance analytics in one scrollable page
  - Profit Metrics Section with profit trend analysis and country filtering
  - Report generation buttons (Profit, Financial)
  - Performance analytics with 10 KPIs (Total Orders, Sales, Profit, Discounted Orders, Average Order Value/Profit, Exchange Rate, Growth %)
  - Advanced filtering: time range (Daily, Weekly, Monthly), multi-select country filtering, custom date range with "from" and "to" date pickers
  - Visual growth indicators (TrendingUp/TrendingDown icons) with color-coded trends
  - Backend: GET `/api/reports/performance?range=daily|weekly|monthly&country[]=...&dateFrom=...&dateTo=...`
  - Bilingual display (English/Arabic) with proper RTL layout

- **LYD Currency Conversion System with Dual Exchange Rates (November 2025)**: 
  - `useLydExchangeRate` hook for centralized management
  - Dual-currency display (USD/LYD) across dashboards, orders, customers, invoices, and profit reports
  - **Dual Exchange Rate System**: Separate purchase rate (cost to buy USD) and sale rate (price sold to customers) for tracking exchange profit margin
  - Global exchange rates stored in settings table:
    - `lyd_purchase_exchange_rate`: Rate paid to buy USD (default: 4.80)
    - `lyd_exchange_rate` (sale rate): Rate sold to customers (default: 4.85)
  - **Per-Order Exchange Rate Tracking (November 4, 2025)**:
    - Both purchase and sale rates saved per order in `orders.lyd_exchange_rate` and `orders.lyd_purchase_exchange_rate`
    - Dual exchange rate input fields in new order dialog with auto-population from global settings
    - Rates can be overridden per-order for real-time accuracy as rates change throughout the day
    - Historical rate tracking ensures accurate profit calculations even as global rates change
    - Order details modal displays both rates and calculated exchange profit/loss for each order
  - **Exchange Rate Profit/Loss Calculation**: `(sale_rate - purchase_rate) × order_total` calculated using per-order rates
  - Settings page UI for managing both global purchase and sale exchange rates with bilingual support
  - Exchange rate profit/loss integrated into profit page:
    - Dedicated line item showing profit (amber/gold) or loss (red) in LYD
    - USD mode: Shows "$XXX USD ± YYY LYD" to display both profit components
    - LYD mode: Single combined total including all profit/loss streams
    - Profit margin note in USD mode explains exclusion of LYD component
  - Financial reports show separate profit components (items, shipping, exchange rate)
  - Consistent currency conversion: values converted once at calculation level to prevent double-conversion
  - Color-coded LYD amounts with bold blue formatting
  - Locale-aware invoice numbering (Dinar/دينار)
  - Expenses page with dual currency support

- **Order Management**:
  - New order statuses: "Partially Arrived," "Ready to Collect," "With Shipping Company," "Ready to Buy"
  - Dynamic country filtering and LYD exchange rate filters
  - Calendar date range filters
  - Flexible order creation without prior shipping calculation
  - Number of pieces field (integer, default: 1) in order items
  - Automatic order status routing: orders without down payment automatically set to "ready_to_buy" status

- **Ready to Buy Dashboard (November 2025)**:
  - Dedicated dashboard for orders ready for purchasing
  - Automatic routing logic: orders WITHOUT down payment → automatically sent to "Ready to Buy" dashboard
  - Orders WITH down payment → remain in "pending" status until down payment collected
  - Full search functionality across order number, customer name, phone, and shipping code
  - Displays order details with dual currency (USD/LYD) support
  - View order details modal with customer and order information
  - Role-based access (owner, customer_service, receptionist)
  - Complete bilingual support (English/Arabic) with proper RTL layout
  - Orange status badge for visual identification

- **Customer Management**: 
  - Customer-level down payment management with proportional distribution
  - Multi-field customer search (phone, name, code)
  - Enhanced visibility of customer codes in invoices and tables
  - Customer creation form with 5 essential fields (First Name, Last Name, Phone Number, City, Customer Code)
  - Form layout with side-by-side name fields in 2-column grid

- **Order Image Upload System (October 28, 2025)**: 
  - Direct device file selection for order images
  - Cloud-based object storage integration
  - Support for up to 3 images per order with validation
  - Accepted formats: JPG, PNG, GIF (max 5MB)
  - Backend: POST `/api/upload-url` generates pre-signed URLs

- **Complete Arabic Translation Coverage**: 
  - All UI elements, modals, and reports fully translated
  - All edit order modal fields translated
  - All sales report types translated with Arabic table headers
  - Invoice and order details modals with locale-aware date formatting
  - Proper RTL layout throughout

- **Commission Functionality Removed (October 2025)**:
  - Complete removal of commission calculations and displays from all pages
  - Commission database fields remain but are not calculated or displayed
  - Simplified profit tracking focuses on items profit, shipping profit, and total profit

- **Mobile RTL (Arabic) Fixes (October 2025)**:
  - Fixed dialog/modal positioning in RTL mode with proper Tailwind RTL support
  - RTL-aware close button positioning in dialogs
  - Fixed text alignment in dialog headers with RTL support
  - Touch-action: none on dialog overlays to prevent mobile scroll issues
  - Fixed Select component padding and checkmark positioning for RTL
  - Resolved freezing issues with Arabic language and mobile zoom

- **Responsive Design Implementation**: 
  - Fully responsive UI across phones, tablets, and desktops
  - Responsive sidebar navigation with hamburger menu on mobile
  - Tables with horizontal scrolling
  - Specific fixes for iOS Safari RTL initialization
  - Dialogs perfectly centered in both LTR and RTL

- **Persistent Dark Mode**: ThemeProvider with localStorage sync for dark mode preferences

# External Dependencies

## Third-Party Services

- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit Integration**: Development environment plugins.

## Key Libraries and Frameworks

- **Frontend**: React, TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui, React Hook Form, Zod.
- **Backend**: Express.js, Passport.js, Drizzle ORM, connect-pg-simple.
- **UI Components**: Radix UI primitives.
- **Utilities**: date-fns, class-variance-authority, clsx.