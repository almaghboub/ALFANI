import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["owner", "customer_service", "receptionist", "sorter", "stock_manager", "shipping_staff"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "partially_arrived", "ready_to_collect", "with_shipping_company", "ready_to_buy"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "completed", "to_collect"]);
export const taskTypeEnum = pgEnum("task_type", ["task", "delivery", "pickup", "receive_payment"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["employee_salaries", "supplier_expenses", "marketing_commission", "rent", "cleaning_salaries", "other"]);
export const currencyEnum = pgEnum("currency", ["USD", "LYD"]);
export const accountTypeEnum = pgEnum("account_type", ["debit", "credit"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["deposit", "withdrawal", "transfer", "settlement", "currency_adjustment"]);
export const receiptTypeEnum = pgEnum("receipt_type", ["payment", "collection"]);

// ============ FINANCIAL MODULES ============

// Revenue Accounts (Main and Sub)
export const revenueAccounts = pgTable("revenue_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  parentId: varchar("parent_id").references((): any => revenueAccounts.id),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Safes (Cash Boxes) - Multi-Level & Multi-Currency
export const safes = pgTable("safes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  parentId: varchar("parent_id").references((): any => safes.id),
  currency: text("currency").notNull().default("USD"),
  isMultiCurrency: boolean("is_multi_currency").notNull().default(false),
  balanceUSD: decimal("balance_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceLYD: decimal("balance_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Safe Transactions
export const safeTransactions = pgTable("safe_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  safeId: varchar("safe_id").notNull().references(() => safes.id),
  type: transactionTypeEnum("type").notNull(),
  amountUSD: decimal("amount_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  amountLYD: decimal("amount_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Banks
export const banks = pgTable("banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  accountNumber: text("account_number"),
  currency: text("currency").notNull().default("USD"),
  balanceUSD: decimal("balance_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceLYD: decimal("balance_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  linkedSafeId: varchar("linked_safe_id").references(() => safes.id),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Bank Transactions
export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankId: varchar("bank_id").notNull().references(() => banks.id),
  type: transactionTypeEnum("type").notNull(),
  amountUSD: decimal("amount_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  amountLYD: decimal("amount_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Currency Difference Settlements
export const currencySettlements = pgTable("currency_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  safeId: varchar("safe_id").references(() => safes.id),
  bankId: varchar("bank_id").references(() => banks.id),
  previousExchangeRate: decimal("previous_exchange_rate", { precision: 10, scale: 4 }).notNull(),
  newExchangeRate: decimal("new_exchange_rate", { precision: 10, scale: 4 }).notNull(),
  previousValueLYD: decimal("previous_value_lyd", { precision: 15, scale: 2 }).notNull(),
  newValueLYD: decimal("new_value_lyd", { precision: 15, scale: 2 }).notNull(),
  differenceAmount: decimal("difference_amount", { precision: 15, scale: 2 }).notNull(),
  isGain: boolean("is_gain").notNull(),
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Warehouses
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  parentId: varchar("parent_id").references((): any => warehouses.id),
  location: text("location"),
  linkedSafeId: varchar("linked_safe_id").references(() => safes.id),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Warehouse Stock (for average cost calculation)
export const warehouseStock = pgTable("warehouse_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warehouseId: varchar("warehouse_id").notNull().references(() => warehouses.id),
  productName: text("product_name").notNull(),
  productCode: text("product_code"),
  quantity: integer("quantity").notNull().default(0),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }).notNull().default("0"),
  averageCost: decimal("average_cost", { precision: 15, scale: 4 }).notNull().default("0"),
  lastPurchasePrice: decimal("last_purchase_price", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  balanceOwed: decimal("balance_owed", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Receipts (Payment & Collection)
export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptNumber: text("receipt_number").notNull().unique(),
  type: receiptTypeEnum("type").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  safeId: varchar("safe_id").references(() => safes.id),
  bankId: varchar("bank_id").references(() => banks.id),
  amountUSD: decimal("amount_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  amountLYD: decimal("amount_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  currency: text("currency").notNull().default("USD"),
  description: text("description"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Accounting Entries (Audit Trail)
export const accountingEntries = pgTable("accounting_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryNumber: text("entry_number").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  description: text("description").notNull(),
  debitAccountType: text("debit_account_type").notNull(),
  debitAccountId: varchar("debit_account_id").notNull(),
  creditAccountType: text("credit_account_type").notNull(),
  creditAccountId: varchar("credit_account_id").notNull(),
  amountUSD: decimal("amount_usd", { precision: 15, scale: 2 }).notNull().default("0"),
  amountLYD: decimal("amount_lyd", { precision: 15, scale: 2 }).notNull().default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Main Office Account
export const mainOfficeAccount = pgTable("main_office_account", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Main Office"),
  totalAssets: decimal("total_assets", { precision: 15, scale: 2 }).notNull().default("0"),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }).notNull().default("0"),
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).notNull().default("0"),
  totalExpenses: decimal("total_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  lastReconciliationDate: timestamp("last_reconciliation_date"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User Permissions (Extended)
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  permission: text("permission").notNull(),
  isGranted: boolean("is_granted").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ END FINANCIAL MODULES ============

// ============ CAR ACCESSORIES PRODUCTS ============

// Branch enum for ALFANI1 and ALFANI2
export const branchEnum = pgEnum("branch", ["ALFANI1", "ALFANI2"]);

// Products catalog (shared across all branches)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  category: text("category"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Branch-specific inventory (stock per branch)
export const branchInventory = pgTable("branch_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  branch: branchEnum("branch").notNull(),
  quantity: integer("quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sales Invoices
export const salesInvoices = pgTable("sales_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  branch: branchEnum("branch").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoice Items
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
});

// ============ END CAR ACCESSORIES PRODUCTS ============

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("customer_service"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull().unique(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  postalCode: text("postal_code"),
  shippingCode: text("shipping_code"),
  balanceOwed: decimal("balance_owed", { precision: 15, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 10, scale: 2 }).notNull().default("0"),
  downPaymentCurrency: currencyEnum("down_payment_currency").notNull().default("USD"),
  shippingDownPayment: decimal("shipping_down_payment", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingDownPaymentCurrency: currencyEnum("shipping_down_payment_currency").notNull().default("USD"),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingWeight: decimal("shipping_weight", { precision: 10, scale: 2 }).notNull().default("1"),
  shippingCountry: text("shipping_country"),
  shippingCity: text("shipping_city"),
  shippingCategory: text("shipping_category"),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingProfit: decimal("shipping_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  itemsProfit: decimal("items_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalProfit: decimal("total_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  lydExchangeRate: decimal("lyd_exchange_rate", { precision: 10, scale: 4 }),
  lydPurchaseExchangeRate: decimal("lyd_purchase_exchange_rate", { precision: 10, scale: 4 }),
  trackingNumber: text("tracking_number"),
  darbAssabilOrderId: text("darb_assabil_order_id"),
  darbAssabilReference: text("darb_assabil_reference"),
  revenueAccountId: varchar("revenue_account_id").references(() => revenueAccounts.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productCode: text("product_code"),
  productUrl: text("product_url"),
  quantity: integer("quantity").notNull(),
  numberOfPieces: integer("number_of_pieces").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  discountedPrice: decimal("discounted_price", { precision: 10, scale: 2 }),
  markupProfit: decimal("markup_profit", { precision: 10, scale: 2 }).notNull().default("0"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(),
  category: text("category").notNull(), // e.g., normal, perfumes, household, etc.
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"), // USD, GBP, LYD, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const commissionRules = pgTable("commission_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(),
  minValue: decimal("min_value", { precision: 10, scale: 2 }).notNull(),
  maxValue: decimal("max_value", { precision: 10, scale: 2 }), // NULL = no max
  percentage: decimal("percentage", { precision: 5, scale: 4 }).notNull(),
  fixedFee: decimal("fixed_fee", { precision: 10, scale: 2 }).notNull().default("0"), // for cases like "$1 purchase tax"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, boolean, number, json
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderImages = pgTable("order_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  position: integer("position").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliveryTasks = pgTable("delivery_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: taskTypeEnum("task_type").notNull().default("task"),
  orderId: varchar("order_id").references(() => orders.id),
  assignedToUserId: varchar("assigned_to_user_id").notNull().references(() => users.id),
  assignedByUserId: varchar("assigned_by_user_id").notNull().references(() => users.id),
  pickupLocation: text("pickup_location"),
  deliveryLocation: text("delivery_location"),
  customerCode: text("customer_code"),
  paymentType: text("payment_type"), // "collect" or "delivered"
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  address: text("address"),
  value: decimal("value", { precision: 10, scale: 2 }),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  status: taskStatusEnum("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: expenseCategoryEnum("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  personName: text("person_name").notNull(),
  description: text("description"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  orderNumber: z.string().optional(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertShippingRateSchema = createInsertSchema(shippingRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionRuleSchema = createInsertSchema(commissionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderImageSchema = createInsertSchema(orderImages).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertDeliveryTaskSchema = createInsertSchema(deliveryTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  paymentAmount: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  value: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
  weight: z.union([z.string(), z.number()]).optional().transform(val => val?.toString()),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

// Financial Module Insert Schemas
export const insertRevenueAccountSchema = createInsertSchema(revenueAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSafeSchema = createInsertSchema(safes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSafeTransactionSchema = createInsertSchema(safeTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertBankSchema = createInsertSchema(banks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertCurrencySettlementSchema = createInsertSchema(currencySettlements).omit({
  id: true,
  createdAt: true,
});

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarehouseStockSchema = createInsertSchema(warehouseStock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
});

export const insertAccountingEntrySchema = createInsertSchema(accountingEntries).omit({
  id: true,
  createdAt: true,
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Product Insert Schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBranchInventorySchema = createInsertSchema(branchInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type InsertShippingRate = z.infer<typeof insertShippingRateSchema>;
export type ShippingRate = typeof shippingRates.$inferSelect;

export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type CommissionRule = typeof commissionRules.$inferSelect;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

export type InsertOrderImage = z.infer<typeof insertOrderImageSchema>;
export type OrderImage = typeof orderImages.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertDeliveryTask = z.infer<typeof insertDeliveryTaskSchema>;
export type DeliveryTask = typeof deliveryTasks.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Financial Module Types
export type InsertRevenueAccount = z.infer<typeof insertRevenueAccountSchema>;
export type RevenueAccount = typeof revenueAccounts.$inferSelect;

export type InsertSafe = z.infer<typeof insertSafeSchema>;
export type Safe = typeof safes.$inferSelect;

export type InsertSafeTransaction = z.infer<typeof insertSafeTransactionSchema>;
export type SafeTransaction = typeof safeTransactions.$inferSelect;

export type InsertBank = z.infer<typeof insertBankSchema>;
export type Bank = typeof banks.$inferSelect;

export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type BankTransaction = typeof bankTransactions.$inferSelect;

export type InsertCurrencySettlement = z.infer<typeof insertCurrencySettlementSchema>;
export type CurrencySettlement = typeof currencySettlements.$inferSelect;

export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

export type InsertWarehouseStock = z.infer<typeof insertWarehouseStockSchema>;
export type WarehouseStock = typeof warehouseStock.$inferSelect;

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

export type InsertAccountingEntry = z.infer<typeof insertAccountingEntrySchema>;
export type AccountingEntry = typeof accountingEntries.$inferSelect;

export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;

export type MainOfficeAccountType = typeof mainOfficeAccount.$inferSelect;

// Product Types
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertBranchInventory = z.infer<typeof insertBranchInventorySchema>;
export type BranchInventory = typeof branchInventory.$inferSelect;

export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoice = typeof salesInvoices.$inferSelect;

export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// Extended product type with inventory
export type ProductWithInventory = Product & {
  inventory: BranchInventory[];
};

// Extended invoice type with items
export type SalesInvoiceWithItems = SalesInvoice & {
  items: InvoiceItem[];
};

export type LoginCredentials = z.infer<typeof loginSchema>;

// Extended types for API responses
export type OrderWithCustomer = Order & {
  customer: Customer;
  items: OrderItem[];
  images: OrderImage[];
};

export type CustomerWithOrders = Customer & {
  orders: Order[];
};

export type DeliveryTaskWithDetails = DeliveryTask & {
  order?: OrderWithCustomer;
  assignedTo: User;
  assignedBy: User;
};
