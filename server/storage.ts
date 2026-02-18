import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type OrderImage,
  type InsertOrderImage,
  type ShippingRate,
  type InsertShippingRate,
  type CommissionRule,
  type InsertCommissionRule,
  type Setting,
  type InsertSetting,
  type Message,
  type InsertMessage,
  type DeliveryTask,
  type InsertDeliveryTask,
  type Expense,
  type InsertExpense,
  type DeliveryTaskWithDetails,
  type OrderWithCustomer,
  type CustomerWithOrders,
  type RevenueAccount,
  type InsertRevenueAccount,
  type Safe,
  type InsertSafe,
  type SafeTransaction,
  type InsertSafeTransaction,
  type Bank,
  type InsertBank,
  type BankTransaction,
  type InsertBankTransaction,
  type CurrencySettlement,
  type InsertCurrencySettlement,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseStock,
  type InsertWarehouseStock,
  type Supplier,
  type InsertSupplier,
  type Receipt,
  type InsertReceipt,
  type AccountingEntry,
  type InsertAccountingEntry,
  type MainOfficeAccountType,
  users,
  customers,
  orders,
  orderItems,
  orderImages,
  shippingRates,
  commissionRules,
  settings,
  messages,
  deliveryTasks,
  expenses,
  revenueAccounts,
  safes,
  safeTransactions,
  banks,
  bankTransactions,
  currencySettlements,
  warehouses,
  warehouseStock,
  suppliers,
  receipts,
  accountingEntries,
  mainOfficeAccount,
  products,
  branchInventory,
  salesInvoices,
  invoiceItems,
  type Product,
  type InsertProduct,
  type BranchInventory,
  type InsertBranchInventory,
  type ProductWithInventory,
  type SalesInvoice,
  type InsertSalesInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type SalesInvoiceWithItems,
  expenseCategories,
  cashboxReconciliations,
  ownerAccounts,
  capitalTransactions,
  type InsertExpenseCategory,
  type ExpenseCategory,
  type InsertCashboxReconciliation,
  type CashboxReconciliation,
  type InsertOwnerAccount,
  type OwnerAccount,
  type InsertCapitalTransaction,
  type CapitalTransaction,
  type StockPurchase,
  type InsertStockPurchase,
  stockPurchases,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { hashPassword } from "./auth";
import { eq, desc, sql, or, ilike, and, count } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  searchCustomers(query: string): Promise<Customer[]>;
  getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;

  // Orders
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined>;
  getOrdersByCustomerId(customerId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  getAllOrders(): Promise<OrderWithCustomer[]>;

  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(id: string, item: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  deleteOrderItem(id: string): Promise<boolean>;

  // Order Images
  getOrderImages(orderId: string): Promise<OrderImage[]>;
  createOrderImage(image: InsertOrderImage): Promise<OrderImage>;
  deleteOrderImage(id: string): Promise<boolean>;

  // Shipping Rates
  getShippingRate(id: string): Promise<ShippingRate | undefined>;
  getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined>;
  createShippingRate(rate: InsertShippingRate): Promise<ShippingRate>;
  updateShippingRate(id: string, rate: Partial<InsertShippingRate>): Promise<ShippingRate | undefined>;
  deleteShippingRate(id: string): Promise<boolean>;
  getAllShippingRates(): Promise<ShippingRate[]>;

  // Commission Rules
  getCommissionRule(id: string): Promise<CommissionRule | undefined>;
  getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined>;
  createCommissionRule(rule: InsertCommissionRule): Promise<CommissionRule>;
  updateCommissionRule(id: string, rule: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined>;
  deleteCommissionRule(id: string): Promise<boolean>;
  getAllCommissionRules(): Promise<CommissionRule[]>;

  // Shipping Calculation
  calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined>;
  deleteSetting(key: string): Promise<boolean>;
  getAllSettings(): Promise<Setting[]>;

  // Analytics
  getTotalProfit(): Promise<number>;
  getTotalRevenue(): Promise<number>;
  getActiveOrdersCount(): Promise<number>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUserId(userId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  markMessageAsRead(messageId: string): Promise<Message | undefined>;
  deleteMessage(messageId: string): Promise<boolean>;

  // Delivery Tasks
  createDeliveryTask(task: InsertDeliveryTask): Promise<DeliveryTask>;
  getDeliveryTask(id: string): Promise<DeliveryTaskWithDetails | undefined>;
  getDeliveryTasksByUserId(userId: string): Promise<DeliveryTaskWithDetails[]>;
  getAllDeliveryTasks(): Promise<DeliveryTaskWithDetails[]>;
  updateDeliveryTask(id: string, task: Partial<InsertDeliveryTask>): Promise<DeliveryTask | undefined>;
  deleteDeliveryTask(id: string): Promise<boolean>;
  getShippingStaffUsers(): Promise<User[]>;

  // Expenses
  createExpense(expense: InsertExpense): Promise<Expense>;
  getAllExpenses(): Promise<Expense[]>;
  deleteExpense(id: string): Promise<boolean>;

  // ============ FINANCIAL MODULE METHODS ============

  // Revenue Accounts
  getAllRevenueAccounts(): Promise<RevenueAccount[]>;
  createRevenueAccount(account: InsertRevenueAccount): Promise<RevenueAccount>;
  updateRevenueAccount(id: string, account: Partial<InsertRevenueAccount>): Promise<RevenueAccount | undefined>;
  deleteRevenueAccount(id: string): Promise<boolean>;

  // Safes
  getAllSafes(): Promise<Safe[]>;
  createSafe(safe: InsertSafe): Promise<Safe>;
  updateSafe(id: string, safe: Partial<InsertSafe>): Promise<Safe | undefined>;
  deleteSafe(id: string): Promise<boolean>;
  getSafeTransactions(safeId: string): Promise<SafeTransaction[]>;
  getAllSafeTransactions(): Promise<SafeTransaction[]>;
  createSafeTransaction(transaction: InsertSafeTransaction): Promise<SafeTransaction>;

  // Banks
  getAllBanks(): Promise<Bank[]>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: string, bank: Partial<InsertBank>): Promise<Bank | undefined>;
  deleteBank(id: string): Promise<boolean>;
  getBankTransactions(bankId: string): Promise<BankTransaction[]>;
  createBankTransaction(transaction: InsertBankTransaction): Promise<BankTransaction>;

  // Currency Settlements
  getAllCurrencySettlements(): Promise<CurrencySettlement[]>;
  createCurrencySettlement(settlement: InsertCurrencySettlement): Promise<CurrencySettlement>;

  // Warehouses
  getAllWarehouses(): Promise<Warehouse[]>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, warehouse: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string): Promise<boolean>;
  getWarehouseStock(warehouseId: string): Promise<WarehouseStock[]>;
  addWarehouseStock(stock: InsertWarehouseStock): Promise<WarehouseStock>;
  updateWarehouseStock(id: string, stock: Partial<InsertWarehouseStock>): Promise<WarehouseStock | undefined>;

  // Suppliers
  getAllSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;

  // Stock Purchases
  getAllStockPurchases(): Promise<StockPurchase[]>;
  createStockPurchase(purchase: InsertStockPurchase): Promise<StockPurchase>;

  // Receipts
  getAllReceipts(): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;

  // Accounting Entries
  getAllAccountingEntries(): Promise<AccountingEntry[]>;
  createAccountingEntry(entry: InsertAccountingEntry): Promise<AccountingEntry>;

  // Main Office Account
  getMainOfficeAccount(): Promise<MainOfficeAccountType | undefined>;
  updateMainOfficeAccount(account: Partial<MainOfficeAccountType>): Promise<MainOfficeAccountType | undefined>;

  // Financial Summary
  getFinancialSummary(): Promise<{
    totalSafeBalanceUSD: number;
    totalSafeBalanceLYD: number;
    totalBankBalanceUSD: number;
    totalBankBalanceLYD: number;
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    goodsCapitalLYD: number;
    goodsCapitalUSD: number;
    recentTransactions: Array<{ type: string; amount: number; date: Date }>;
  }>;

  getGoodsCapitalDetails(): Promise<{
    items: Array<{ productId: string; productName: string; costPrice: number; sellPrice: number; branch: string; quantity: number; totalValue: number }>;
    totalCapital: number;
  }>;

  // ============ PRODUCTS & INVENTORY ============
  
  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getProductsWithInventory(): Promise<ProductWithInventory[]>;
  searchProductsByName(query: string, limit?: number): Promise<ProductWithInventory[]>;
  getProductsPaginated(params: { page: number; limit: number; search?: string; category?: string }): Promise<{ products: ProductWithInventory[]; total: number; page: number; totalPages: number }>;

  // Branch Inventory
  getBranchInventory(productId: string): Promise<BranchInventory[]>;
  upsertBranchInventory(inventory: InsertBranchInventory): Promise<BranchInventory>;
  deleteBranchInventory(id: string): Promise<boolean>;
  getProductStats(): Promise<{ total: number; active: number; lowStock: number; outOfStock: number; totalSellingValue: number }>;
  
  // Sales Invoices
  getAllInvoices(): Promise<SalesInvoiceWithItems[]>;
  getInvoice(id: string): Promise<SalesInvoiceWithItems | undefined>;
  createInvoice(invoice: InsertSalesInvoice, items: InsertInvoiceItem[]): Promise<SalesInvoiceWithItems>;
  updateInvoice(id: string, invoice: Partial<InsertSalesInvoice>, items?: InsertInvoiceItem[]): Promise<SalesInvoiceWithItems | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  returnInvoiceItems(invoiceId: string, returnItems: Array<{itemId: string; quantity: number}>): Promise<SalesInvoiceWithItems | undefined>;
  generateInvoiceNumber(): Promise<string>;
  checkInvoiceStock(branch: string, items: Array<{productId: string; quantity: number}>): Promise<{success: boolean; message?: string}>;

  // Expense Categories
  getAllExpenseCategories(): Promise<ExpenseCategory[]>;
  createExpenseCategory(data: InsertExpenseCategory): Promise<ExpenseCategory>;

  // Cashbox Reconciliation
  getAllReconciliations(): Promise<CashboxReconciliation[]>;
  createReconciliation(data: InsertCashboxReconciliation): Promise<CashboxReconciliation>;

  // Owner Accounts
  getAllOwnerAccounts(): Promise<OwnerAccount[]>;
  createOwnerAccount(data: InsertOwnerAccount): Promise<OwnerAccount>;
  updateOwnerAccount(id: string, data: Partial<InsertOwnerAccount>): Promise<OwnerAccount | undefined>;

  // Capital Transactions
  getCapitalTransactions(ownerAccountId: string): Promise<CapitalTransaction[]>;
  createCapitalTransaction(data: InsertCapitalTransaction): Promise<CapitalTransaction>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private customers: Map<string, Customer>;
  private orders: Map<string, Order>;
  private orderItems: Map<string, OrderItem>;
  private orderImages: Map<string, OrderImage>;
  private shippingRates: Map<string, ShippingRate>;
  private commissionRules: Map<string, CommissionRule>;
  private settings: Map<string, Setting>;
  private messages: Map<string, Message>;
  private deliveryTasks: Map<string, DeliveryTask>;
  private orderCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.orderImages = new Map();
    this.shippingRates = new Map();
    this.commissionRules = new Map();
    this.settings = new Map();
    this.messages = new Map();
    this.deliveryTasks = new Map();
    
    // Initialize with default data
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create default owner user with hashed password
    const hashedPassword = await hashPassword("admin");
    const defaultUser: User = {
      id: randomUUID(),
      username: "admin",
      password: hashedPassword,
      role: "owner",
      firstName: "Admin",
      lastName: "User",
      email: "admin@lynxly.com",
      isActive: true,
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Create default shipping rates
    const defaultRates: ShippingRate[] = [
      {
        id: randomUUID(),
        country: "China",
        category: "normal",
        pricePerKg: "8.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "China",
        category: "perfumes",
        pricePerKg: "12.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "Turkey",
        category: "normal",
        pricePerKg: "12.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UK",
        category: "normal",
        pricePerKg: "15.00",
        currency: "GBP",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UAE",
        category: "normal",
        pricePerKg: "18.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultRates.forEach(rate => this.shippingRates.set(rate.id, rate));

    // Create default commission rules
    const defaultCommissionRules: CommissionRule[] = [
      {
        id: randomUUID(),
        country: "China",
        minValue: "0.00",
        maxValue: "100.00",
        percentage: "0.1800",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "China",
        minValue: "100.01",
        maxValue: null,
        percentage: "0.1500",
        fixedFee: "1.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "Turkey",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.2000",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UK",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.1500",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        country: "UAE",
        minValue: "0.00",
        maxValue: null,
        percentage: "0.1200",
        fixedFee: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultCommissionRules.forEach(rule => this.commissionRules.set(rule.id, rule));
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "customer_service",
      isActive: insertUser.isActive ?? true,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(customer => customer.phone === phone);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.customers.values()).filter(customer => 
      customer.phone.includes(query) ||
      customer.firstName.toLowerCase().includes(lowerQuery) ||
      customer.lastName.toLowerCase().includes(lowerQuery) ||
      (customer.shippingCode && customer.shippingCode.toLowerCase().includes(lowerQuery))
    );
  }

  async getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const orders = Array.from(this.orders.values()).filter(order => order.customerId === id);
    return { ...customer, orders };
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      ...insertCustomer,
      id,
      address: insertCustomer.address ?? null,
      city: insertCustomer.city ?? null,
      postalCode: insertCustomer.postalCode ?? null,
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...customerData };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const customer = this.customers.get(order.customerId);
    if (!customer) return undefined;
    
    const items = Array.from(this.orderItems.values()).filter(item => item.orderId === id);
    const images = Array.from(this.orderImages.values()).filter(image => image.orderId === id);
    
    return { ...order, customer, items, images };
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.customerId === customerId);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    // Use provided orderNumber or generate one
    const orderNumber = insertOrder.orderNumber || `LY-${Date.now()}`;
    const now = new Date();
    
    const order: Order = {
      ...insertOrder,
      id,
      orderNumber,
      status: insertOrder.status || "pending",
      shippingCost: insertOrder.shippingCost || "0.00",
      commission: insertOrder.commission || "0.00",
      shippingProfit: insertOrder.shippingProfit || "0.00",
      itemsProfit: insertOrder.itemsProfit || "0.00",
      totalProfit: insertOrder.totalProfit || "0.00",
      notes: insertOrder.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder = { ...order, ...orderData, updatedAt: new Date() };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    // Delete associated order items
    Array.from(this.orderItems.keys())
      .filter(itemId => this.orderItems.get(itemId)?.orderId === id)
      .forEach(itemId => this.orderItems.delete(itemId));
    
    return this.orders.delete(id);
  }

  async getAllOrders(): Promise<OrderWithCustomer[]> {
    const orders: OrderWithCustomer[] = [];
    
    for (const order of Array.from(this.orders.values())) {
      const customer = this.customers.get(order.customerId);
      if (customer) {
        const items = Array.from(this.orderItems.values()).filter(item => item.orderId === order.id);
        const images = Array.from(this.orderImages.values()).filter(image => image.orderId === order.id);
        orders.push({ ...order, customer, items, images });
      }
    }
    
    return orders;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(item => item.orderId === orderId);
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = randomUUID();
    const item: OrderItem = {
      ...insertOrderItem,
      id,
      productUrl: insertOrderItem.productUrl ?? null,
      originalPrice: insertOrderItem.originalPrice ?? null,
      discountedPrice: insertOrderItem.discountedPrice ?? null,
      markupProfit: insertOrderItem.markupProfit ?? "0.00",
    };
    this.orderItems.set(id, item);
    return item;
  }

  async updateOrderItem(id: string, itemData: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const item = this.orderItems.get(id);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...itemData };
    this.orderItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteOrderItem(id: string): Promise<boolean> {
    return this.orderItems.delete(id);
  }

  // Order Images
  async getOrderImages(orderId: string): Promise<OrderImage[]> {
    return Array.from(this.orderImages.values()).filter(image => image.orderId === orderId);
  }

  async createOrderImage(insertOrderImage: InsertOrderImage): Promise<OrderImage> {
    const id = randomUUID();
    const image: OrderImage = {
      ...insertOrderImage,
      id,
      altText: insertOrderImage.altText ?? null,
      position: insertOrderImage.position ?? 1,
      createdAt: new Date(),
    };
    this.orderImages.set(id, image);
    return image;
  }

  async deleteOrderImage(id: string): Promise<boolean> {
    return this.orderImages.delete(id);
  }

  // Shipping Rates
  async getShippingRate(id: string): Promise<ShippingRate | undefined> {
    return this.shippingRates.get(id);
  }

  async getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined> {
    return Array.from(this.shippingRates.values()).find(
      rate => rate.country === country && rate.category === category
    );
  }

  async createShippingRate(insertShippingRate: InsertShippingRate): Promise<ShippingRate> {
    const id = randomUUID();
    const now = new Date();
    const rate: ShippingRate = {
      ...insertShippingRate,
      id,
      currency: insertShippingRate.currency ?? "USD",
      createdAt: now,
      updatedAt: now,
    };
    this.shippingRates.set(id, rate);
    return rate;
  }

  async updateShippingRate(id: string, rateData: Partial<InsertShippingRate>): Promise<ShippingRate | undefined> {
    const rate = this.shippingRates.get(id);
    if (!rate) return undefined;
    
    const updatedRate = { ...rate, ...rateData };
    this.shippingRates.set(id, updatedRate);
    return updatedRate;
  }

  async deleteShippingRate(id: string): Promise<boolean> {
    return this.shippingRates.delete(id);
  }

  async getAllShippingRates(): Promise<ShippingRate[]> {
    return Array.from(this.shippingRates.values());
  }

  // Commission Rules
  async getCommissionRule(id: string): Promise<CommissionRule | undefined> {
    return this.commissionRules.get(id);
  }

  async getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined> {
    return Array.from(this.commissionRules.values()).find(rule => {
      const minValue = parseFloat(rule.minValue);
      const maxValue = rule.maxValue ? parseFloat(rule.maxValue) : null;
      return rule.country === country && 
             minValue <= orderValue && 
             (maxValue === null || maxValue >= orderValue);
    });
  }

  async createCommissionRule(insertCommissionRule: InsertCommissionRule): Promise<CommissionRule> {
    const id = randomUUID();
    const now = new Date();
    const rule: CommissionRule = {
      ...insertCommissionRule,
      id,
      maxValue: insertCommissionRule.maxValue ?? null,
      fixedFee: insertCommissionRule.fixedFee ?? "0.00",
      createdAt: now,
      updatedAt: now,
    };
    this.commissionRules.set(id, rule);
    return rule;
  }

  async updateCommissionRule(id: string, ruleData: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined> {
    const rule = this.commissionRules.get(id);
    if (!rule) return undefined;
    
    const updatedRule = { 
      ...rule, 
      ...ruleData,
      updatedAt: new Date(),
    };
    this.commissionRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteCommissionRule(id: string): Promise<boolean> {
    return this.commissionRules.delete(id);
  }

  async getAllCommissionRules(): Promise<CommissionRule[]> {
    return Array.from(this.commissionRules.values());
  }

  // Shipping Calculation
  async calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }> {
    const shippingRate = await this.getShippingRateByCountryAndCategory(country, category);
    if (!shippingRate) {
      throw new Error(`No shipping rate found for country: ${country}, category: ${category}`);
    }

    const baseShipping = weight * parseFloat(shippingRate.pricePerKg);

    const commissionRule = await this.getCommissionRuleByCountryAndValue(country, orderValue);
    let commission = 0;
    
    if (commissionRule) {
      const percentageCommission = orderValue * parseFloat(commissionRule.percentage);
      const fixedFee = parseFloat(commissionRule.fixedFee);
      commission = percentageCommission + fixedFee;
    }

    return {
      base_shipping: baseShipping,
      commission,
      total: baseShipping + commission,
      currency: shippingRate.currency,
    };
  }

  // Analytics
  async getTotalProfit(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.reduce((total, order) => total + parseFloat(order.totalProfit), 0);
  }

  async getTotalRevenue(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.reduce((total, order) => total + parseFloat(order.totalAmount), 0);
  }

  async getActiveOrdersCount(): Promise<number> {
    const orders = Array.from(this.orders.values());
    return orders.filter(order => order.status !== "delivered" && order.status !== "cancelled").length;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = randomUUID();
    const now = new Date();
    const setting: Setting = {
      ...insertSetting,
      id,
      type: insertSetting.type ?? "string",
      description: insertSetting.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.settings.set(setting.key, setting);
    return setting;
  }

  async updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined> {
    const existing = this.settings.get(key);
    if (!existing) return undefined;

    const updated: Setting = {
      ...existing,
      value,
      type: type || existing.type,
      updatedAt: new Date(),
    };
    this.settings.set(key, updated);
    return updated;
  }

  async deleteSetting(key: string): Promise<boolean> {
    return this.settings.delete(key);
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  // Messages methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      isRead: false,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.senderId === userId || msg.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    return Array.from(this.messages.values())
      .filter(msg => msg.recipientId === userId && !msg.isRead)
      .length;
  }

  async markMessageAsRead(messageId: string): Promise<Message | undefined> {
    const message = this.messages.get(messageId);
    if (!message) return undefined;
    const updated = { ...message, isRead: true };
    this.messages.set(messageId, updated);
    return updated;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    return this.messages.delete(messageId);
  }
}

export class PostgreSQLStorage implements IStorage {
  constructor() {
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    try {
      // Check if admin user exists
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        // Create default owner user
        const hashedPassword = await hashPassword("admin");
        await db.insert(users).values({
          username: "admin",
          password: hashedPassword,
          role: "owner",
          firstName: "Admin",
          lastName: "User",
          email: "admin@lynxly.com",
          isActive: true,
        });
      }

      // Check if shipping rates exist
      const existingRates = await this.getAllShippingRates();
      if (existingRates.length === 0) {
        // Create default shipping rates
        await db.insert(shippingRates).values([
          {
            country: "China",
            category: "normal",
            pricePerKg: "8.00",
            currency: "USD",
          },
          {
            country: "China",
            category: "perfumes",
            pricePerKg: "12.00",
            currency: "USD",
          },
          {
            country: "Turkey",
            category: "normal",
            pricePerKg: "12.00",
            currency: "USD",
          },
          {
            country: "UK",
            category: "normal",
            pricePerKg: "15.00",
            currency: "GBP",
          },
          {
            country: "UAE",
            category: "normal",
            pricePerKg: "18.00",
            currency: "USD",
          },
        ]);
      }

      // Check if commission rules exist
      const existingCommissionRules = await this.getAllCommissionRules();
      if (existingCommissionRules.length === 0) {
        // Create default commission rules
        await db.insert(commissionRules).values([
          {
            country: "China",
            minValue: "0.00",
            maxValue: "100.00",
            percentage: "0.1800",
            fixedFee: "0.00",
          },
          {
            country: "China",
            minValue: "100.01",
            maxValue: null, // no max
            percentage: "0.1500",
            fixedFee: "1.00",
          },
          {
            country: "Turkey",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.2000",
            fixedFee: "0.00",
          },
          {
            country: "UK",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.1500",
            fixedFee: "0.00",
          },
          {
            country: "UAE",
            minValue: "0.00",
            maxValue: null,
            percentage: "0.1200",
            fixedFee: "0.00",
          },
        ]);
      }

    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role || "customer_service",
      isActive: insertUser.isActive ?? true,
    }).returning();
    return result[0];
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0];
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    return result[0];
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const result = await db
      .select()
      .from(customers)
      .where(
        or(
          ilike(customers.phone, `%${query}%`),
          ilike(customers.firstName, `%${query}%`),
          ilike(customers.lastName, `%${query}%`),
          ilike(customers.shippingCode, `%${query}%`)
        )
      )
      .orderBy(desc(customers.createdAt));
    return result;
  }

  async getCustomerWithOrders(id: string): Promise<CustomerWithOrders | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;
    
    const customerOrders = await db.select().from(orders).where(eq(orders.customerId, id));
    return { ...customer, orders: customerOrders };
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers).set(customerData).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id));
    return result.rowCount > 0;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderWithCustomer(id: string): Promise<OrderWithCustomer | undefined> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, id))
      .limit(1);
    
    if (!result[0] || !result[0].orders || !result[0].customers) return undefined;
    
    const items = await this.getOrderItems(id);
    return {
      ...result[0].orders,
      customer: result[0].customers,
      items,
      images: [],
    };
  }

  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerId, customerId));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Use provided orderNumber or generate one
    const orderNumber = insertOrder.orderNumber || `LY-${Date.now()}`;
    const result = await db.insert(orders).values({
      ...insertOrder,
      orderNumber,
    }).returning();
    return result[0];
  }

  async updateOrder(id: string, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const updateData = {
      ...orderData,
      updatedAt: new Date(),
    };
    const result = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount > 0;
  }

  async getAllOrders(): Promise<OrderWithCustomer[]> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(desc(orders.createdAt));
    
    const ordersWithCustomers: OrderWithCustomer[] = [];
    for (const row of result) {
      if (row.orders && row.customers) {
        const items = await this.getOrderItems(row.orders.id);
        ordersWithCustomers.push({
          ...row.orders,
          customer: row.customers,
          items,
          images: [],
        });
      }
    }
    
    return ordersWithCustomers;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(insertOrderItem).returning();
    return result[0];
  }

  async updateOrderItem(id: string, itemData: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const result = await db.update(orderItems).set(itemData).where(eq(orderItems.id, id)).returning();
    return result[0];
  }

  async deleteOrderItem(id: string): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.id, id));
    return result.rowCount > 0;
  }

  // Order Images
  async getOrderImages(orderId: string): Promise<OrderImage[]> {
    return await db.select().from(orderImages).where(eq(orderImages.orderId, orderId));
  }

  async createOrderImage(insertOrderImage: InsertOrderImage): Promise<OrderImage> {
    const result = await db.insert(orderImages).values(insertOrderImage).returning();
    return result[0];
  }

  async deleteOrderImage(id: string): Promise<boolean> {
    const result = await db.delete(orderImages).where(eq(orderImages.id, id));
    return result.rowCount > 0;
  }

  // Shipping Rates
  async getShippingRate(id: string): Promise<ShippingRate | undefined> {
    const result = await db.select().from(shippingRates).where(eq(shippingRates.id, id)).limit(1);
    return result[0];
  }

  async getShippingRateByCountryAndCategory(country: string, category: string): Promise<ShippingRate | undefined> {
    const result = await db.select().from(shippingRates)
      .where(sql`${shippingRates.country} = ${country} AND ${shippingRates.category} = ${category}`)
      .limit(1);
    return result[0];
  }

  async createShippingRate(insertShippingRate: InsertShippingRate): Promise<ShippingRate> {
    const result = await db.insert(shippingRates).values(insertShippingRate).returning();
    return result[0];
  }

  async updateShippingRate(id: string, rateData: Partial<InsertShippingRate>): Promise<ShippingRate | undefined> {
    const result = await db.update(shippingRates).set(rateData).where(eq(shippingRates.id, id)).returning();
    return result[0];
  }

  async deleteShippingRate(id: string): Promise<boolean> {
    const result = await db.delete(shippingRates).where(eq(shippingRates.id, id));
    return result.rowCount > 0;
  }

  async getAllShippingRates(): Promise<ShippingRate[]> {
    return await db.select().from(shippingRates).orderBy(shippingRates.country);
  }

  // Commission Rules
  async getCommissionRule(id: string): Promise<CommissionRule | undefined> {
    const result = await db.select().from(commissionRules).where(eq(commissionRules.id, id)).limit(1);
    return result[0];
  }

  async getCommissionRuleByCountryAndValue(country: string, orderValue: number): Promise<CommissionRule | undefined> {
    const result = await db.select().from(commissionRules)
      .where(sql`${commissionRules.country} = ${country} 
                 AND ${commissionRules.minValue} <= ${orderValue}
                 AND (${commissionRules.maxValue} IS NULL OR ${commissionRules.maxValue} >= ${orderValue})`)
      .orderBy(commissionRules.minValue)
      .limit(1);
    return result[0];
  }

  async createCommissionRule(insertCommissionRule: InsertCommissionRule): Promise<CommissionRule> {
    const result = await db.insert(commissionRules).values(insertCommissionRule).returning();
    return result[0];
  }

  async updateCommissionRule(id: string, ruleData: Partial<InsertCommissionRule>): Promise<CommissionRule | undefined> {
    const updateData = {
      ...ruleData,
      updatedAt: new Date(),
    };
    const result = await db.update(commissionRules).set(updateData).where(eq(commissionRules.id, id)).returning();
    return result[0];
  }

  async deleteCommissionRule(id: string): Promise<boolean> {
    const result = await db.delete(commissionRules).where(eq(commissionRules.id, id));
    return result.rowCount > 0;
  }

  async getAllCommissionRules(): Promise<CommissionRule[]> {
    return await db.select().from(commissionRules).orderBy(commissionRules.country, commissionRules.minValue);
  }

  // Shipping Calculation
  async calculateShipping(country: string, category: string, weight: number, orderValue: number): Promise<{
    base_shipping: number;
    commission: number;
    total: number;
    currency: string;
  }> {
    // Get shipping rate for country and category
    const shippingRate = await this.getShippingRateByCountryAndCategory(country, category);
    if (!shippingRate) {
      throw new Error(`No shipping rate found for country: ${country}, category: ${category}`);
    }

    // Calculate base shipping cost
    const baseShipping = weight * parseFloat(shippingRate.pricePerKg);

    // Get commission rule for country and order value
    const commissionRule = await this.getCommissionRuleByCountryAndValue(country, orderValue);
    let commission = 0;
    
    if (commissionRule) {
      // Calculate commission: percentage + fixed fee
      const percentageCommission = orderValue * parseFloat(commissionRule.percentage);
      const fixedFee = parseFloat(commissionRule.fixedFee);
      commission = percentageCommission + fixedFee;
    }

    return {
      base_shipping: baseShipping,
      commission,
      total: baseShipping + commission,
      currency: shippingRate.currency,
    };
  }

  // Analytics
  async getTotalProfit(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${orders.totalProfit} AS NUMERIC)), 0)`,
    }).from(orders);
    return Number(result[0]?.total || 0);
  }

  async getTotalRevenue(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS NUMERIC)), 0)`,
    }).from(orders);
    return Number(result[0]?.total || 0);
  }

  async getActiveOrdersCount(): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(orders).where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`);
    return Number(result[0]?.count || 0);
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0];
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const result = await db.insert(settings).values(insertSetting).returning();
    return result[0];
  }

  async updateSetting(key: string, value: string, type?: string): Promise<Setting | undefined> {
    const updateData: any = { 
      value, 
      updatedAt: new Date() 
    };
    if (type) {
      updateData.type = type;
    }
    
    const result = await db.update(settings)
      .set(updateData)
      .where(eq(settings.key, key))
      .returning();
    return result[0];
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await db.delete(settings).where(eq(settings.key, key)).returning();
    return result.length > 0;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  // Messages methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({
      count: sql<number>`COUNT(*)`,
    })
      .from(messages)
      .where(sql`${messages.recipientId} = ${userId} AND ${messages.isRead} = false`);
    return Number(result[0]?.count || 0);
  }

  async markMessageAsRead(messageId: string): Promise<Message | undefined> {
    const result = await db.update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId))
      .returning();
    return result[0];
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, messageId)).returning();
    return result.length > 0;
  }

  // Delivery Tasks methods
  async createDeliveryTask(insertTask: InsertDeliveryTask): Promise<DeliveryTask> {
    const result = await db.insert(deliveryTasks).values(insertTask).returning();
    return result[0];
  }

  async getDeliveryTask(id: string): Promise<DeliveryTaskWithDetails | undefined> {
    const result = await db.select()
      .from(deliveryTasks)
      .where(eq(deliveryTasks.id, id))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const task = result[0];
    const order = await this.getOrderWithCustomer(task.orderId);
    const assignedTo = await this.getUser(task.assignedToUserId);
    const assignedBy = await this.getUser(task.assignedByUserId);
    
    if (!order || !assignedTo || !assignedBy) {
      return undefined;
    }

    return {
      ...task,
      order,
      assignedTo,
      assignedBy,
    };
  }

  async getDeliveryTasksByUserId(userId: string): Promise<DeliveryTaskWithDetails[]> {
    const tasks = await db.select()
      .from(deliveryTasks)
      .where(eq(deliveryTasks.assignedToUserId, userId))
      .orderBy(desc(deliveryTasks.createdAt));

    const tasksWithDetails = await Promise.all(tasks.map(async (task) => {
      const order = task.orderId ? await this.getOrderWithCustomer(task.orderId) : undefined;
      const assignedTo = await this.getUser(task.assignedToUserId);
      const assignedBy = await this.getUser(task.assignedByUserId);
      
      if (!assignedTo || !assignedBy) {
        throw new Error("Task data incomplete");
      }

      return {
        ...task,
        order,
        assignedTo,
        assignedBy,
      };
    }));

    return tasksWithDetails;
  }

  async getAllDeliveryTasks(): Promise<DeliveryTaskWithDetails[]> {
    const tasks = await db.select()
      .from(deliveryTasks)
      .orderBy(desc(deliveryTasks.createdAt));

    const tasksWithDetails = await Promise.all(tasks.map(async (task) => {
      const order = task.orderId ? await this.getOrderWithCustomer(task.orderId) : undefined;
      const assignedTo = await this.getUser(task.assignedToUserId);
      const assignedBy = await this.getUser(task.assignedByUserId);
      
      if (!assignedTo || !assignedBy) {
        throw new Error("Task data incomplete");
      }

      return {
        ...task,
        order,
        assignedTo,
        assignedBy,
      };
    }));

    return tasksWithDetails;
  }

  async updateDeliveryTask(id: string, updateTask: Partial<InsertDeliveryTask>): Promise<DeliveryTask | undefined> {
    const result = await db.update(deliveryTasks)
      .set({ ...updateTask, updatedAt: new Date() })
      .where(eq(deliveryTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteDeliveryTask(id: string): Promise<boolean> {
    const result = await db.delete(deliveryTasks).where(eq(deliveryTasks.id, id)).returning();
    return result.length > 0;
  }

  async getShippingStaffUsers(): Promise<User[]> {
    return await db.select()
      .from(users)
      .where(eq(users.role, "shipping_staff"));
  }

  // Expenses methods
  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(insertExpense).returning();
    return result[0];
  }

  async getAllExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return result.length > 0;
  }

  // ============ FINANCIAL MODULE IMPLEMENTATIONS ============

  // Revenue Accounts
  async getAllRevenueAccounts(): Promise<RevenueAccount[]> {
    return await db.select().from(revenueAccounts).orderBy(revenueAccounts.code);
  }

  async createRevenueAccount(account: InsertRevenueAccount): Promise<RevenueAccount> {
    const result = await db.insert(revenueAccounts).values(account).returning();
    return result[0];
  }

  async updateRevenueAccount(id: string, account: Partial<InsertRevenueAccount>): Promise<RevenueAccount | undefined> {
    const result = await db.update(revenueAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(revenueAccounts.id, id))
      .returning();
    return result[0];
  }

  async deleteRevenueAccount(id: string): Promise<boolean> {
    const result = await db.delete(revenueAccounts).where(eq(revenueAccounts.id, id)).returning();
    return result.length > 0;
  }

  // Safes
  async getAllSafes(): Promise<Safe[]> {
    return await db.select().from(safes).orderBy(safes.code);
  }

  async createSafe(safe: InsertSafe): Promise<Safe> {
    const result = await db.insert(safes).values(safe).returning();
    return result[0];
  }

  async updateSafe(id: string, safe: Partial<InsertSafe>): Promise<Safe | undefined> {
    const result = await db.update(safes)
      .set({ ...safe, updatedAt: new Date() })
      .where(eq(safes.id, id))
      .returning();
    return result[0];
  }

  async deleteSafe(id: string): Promise<boolean> {
    const result = await db.delete(safes).where(eq(safes.id, id)).returning();
    return result.length > 0;
  }

  async getSafeTransactions(safeId: string): Promise<SafeTransaction[]> {
    return await db.select()
      .from(safeTransactions)
      .where(eq(safeTransactions.safeId, safeId))
      .orderBy(desc(safeTransactions.createdAt));
  }

  async getAllSafeTransactions(): Promise<SafeTransaction[]> {
    return await db.select()
      .from(safeTransactions)
      .orderBy(desc(safeTransactions.createdAt));
  }

  async createSafeTransaction(transaction: InsertSafeTransaction): Promise<SafeTransaction> {
    const result = await db.insert(safeTransactions).values(transaction).returning();
    
    // Update safe balance based on transaction type
    const safe = await db.select().from(safes).where(eq(safes.id, transaction.safeId)).limit(1);
    if (safe[0]) {
      let multiplier = 0;
      switch (transaction.type) {
        case 'deposit':
        case 'transfer': // Incoming transfer
          multiplier = 1;
          break;
        case 'withdrawal':
        case 'settlement':
        case 'currency_adjustment':
          // For settlement/adjustment, use the sign of the amount to determine direction
          multiplier = -1;
          break;
        default:
          multiplier = 0;
      }
      const newBalanceUSD = Number(safe[0].balanceUSD) + (Number(transaction.amountUSD || 0) * multiplier);
      const newBalanceLYD = Number(safe[0].balanceLYD) + (Number(transaction.amountLYD || 0) * multiplier);
      await db.update(safes)
        .set({ balanceUSD: String(newBalanceUSD), balanceLYD: String(newBalanceLYD), updatedAt: new Date() })
        .where(eq(safes.id, transaction.safeId));
    }
    
    return result[0];
  }

  // Banks
  async getAllBanks(): Promise<Bank[]> {
    return await db.select().from(banks).orderBy(banks.code);
  }

  async createBank(bank: InsertBank): Promise<Bank> {
    const result = await db.insert(banks).values(bank).returning();
    return result[0];
  }

  async updateBank(id: string, bank: Partial<InsertBank>): Promise<Bank | undefined> {
    const result = await db.update(banks)
      .set({ ...bank, updatedAt: new Date() })
      .where(eq(banks.id, id))
      .returning();
    return result[0];
  }

  async deleteBank(id: string): Promise<boolean> {
    const result = await db.delete(banks).where(eq(banks.id, id)).returning();
    return result.length > 0;
  }

  async getBankTransactions(bankId: string): Promise<BankTransaction[]> {
    return await db.select()
      .from(bankTransactions)
      .where(eq(bankTransactions.bankId, bankId))
      .orderBy(desc(bankTransactions.createdAt));
  }

  async createBankTransaction(transaction: InsertBankTransaction): Promise<BankTransaction> {
    const result = await db.insert(bankTransactions).values(transaction).returning();
    
    // Update bank balance based on transaction type
    const bank = await db.select().from(banks).where(eq(banks.id, transaction.bankId)).limit(1);
    if (bank[0]) {
      let multiplier = 0;
      switch (transaction.type) {
        case 'deposit':
        case 'transfer': // Incoming transfer
          multiplier = 1;
          break;
        case 'withdrawal':
        case 'settlement':
        case 'currency_adjustment':
          multiplier = -1;
          break;
        default:
          multiplier = 0;
      }
      const newBalanceUSD = Number(bank[0].balanceUSD) + (Number(transaction.amountUSD || 0) * multiplier);
      const newBalanceLYD = Number(bank[0].balanceLYD) + (Number(transaction.amountLYD || 0) * multiplier);
      await db.update(banks)
        .set({ balanceUSD: String(newBalanceUSD), balanceLYD: String(newBalanceLYD), updatedAt: new Date() })
        .where(eq(banks.id, transaction.bankId));
      
      // Only update linked safe for transfer type (where funds move between bank and safe)
      // For transfers: bank deposit (+) means safe withdrawal (-), and vice versa
      if (bank[0].linkedSafeId && transaction.type === 'transfer') {
        const linkedSafe = await db.select().from(safes).where(eq(safes.id, bank[0].linkedSafeId)).limit(1);
        if (linkedSafe[0]) {
          // Opposite sign for linked safe: if bank increases, safe decreases
          const safeMultiplier = -multiplier;
          const safeNewBalanceUSD = Number(linkedSafe[0].balanceUSD) + (Number(transaction.amountUSD || 0) * safeMultiplier);
          const safeNewBalanceLYD = Number(linkedSafe[0].balanceLYD) + (Number(transaction.amountLYD || 0) * safeMultiplier);
          await db.update(safes)
            .set({ balanceUSD: String(safeNewBalanceUSD), balanceLYD: String(safeNewBalanceLYD), updatedAt: new Date() })
            .where(eq(safes.id, bank[0].linkedSafeId));
        }
      }
    }
    
    return result[0];
  }

  // Currency Settlements
  async getAllCurrencySettlements(): Promise<CurrencySettlement[]> {
    return await db.select().from(currencySettlements).orderBy(desc(currencySettlements.createdAt));
  }

  async createCurrencySettlement(settlement: InsertCurrencySettlement): Promise<CurrencySettlement> {
    const result = await db.insert(currencySettlements).values(settlement).returning();
    return result[0];
  }

  // Warehouses
  async getAllWarehouses(): Promise<Warehouse[]> {
    return await db.select().from(warehouses).orderBy(warehouses.code);
  }

  async createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse> {
    const result = await db.insert(warehouses).values(warehouse).returning();
    return result[0];
  }

  async updateWarehouse(id: string, warehouse: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const result = await db.update(warehouses)
      .set({ ...warehouse, updatedAt: new Date() })
      .where(eq(warehouses.id, id))
      .returning();
    return result[0];
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    const result = await db.delete(warehouses).where(eq(warehouses.id, id)).returning();
    return result.length > 0;
  }

  async getWarehouseStock(warehouseId: string): Promise<WarehouseStock[]> {
    return await db.select()
      .from(warehouseStock)
      .where(eq(warehouseStock.warehouseId, warehouseId))
      .orderBy(warehouseStock.productName);
  }

  async addWarehouseStock(stock: InsertWarehouseStock): Promise<WarehouseStock> {
    // Calculate average cost for existing stock
    const existing = await db.select()
      .from(warehouseStock)
      .where(sql`${warehouseStock.warehouseId} = ${stock.warehouseId} AND ${warehouseStock.productCode} = ${stock.productCode}`)
      .limit(1);

    if (existing[0]) {
      // Update existing stock with new average cost
      const currentQty = Number(existing[0].quantity);
      const currentTotalCost = Number(existing[0].totalCost);
      const newQty = currentQty + Number(stock.quantity);
      const newTotalCost = currentTotalCost + Number(stock.totalCost);
      const newAverageCost = newTotalCost / newQty;

      const result = await db.update(warehouseStock)
        .set({
          quantity: newQty,
          totalCost: String(newTotalCost),
          averageCost: String(newAverageCost),
          lastPurchasePrice: stock.lastPurchasePrice,
          updatedAt: new Date(),
        })
        .where(eq(warehouseStock.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      // Insert new stock item
      const quantity = Number(stock.quantity);
      const totalCost = Number(stock.totalCost);
      const averageCost = quantity > 0 ? totalCost / quantity : 0;

      const result = await db.insert(warehouseStock).values({
        ...stock,
        averageCost: String(averageCost),
      }).returning();
      return result[0];
    }
  }

  async updateWarehouseStock(id: string, stock: Partial<InsertWarehouseStock>): Promise<WarehouseStock | undefined> {
    const result = await db.update(warehouseStock)
      .set({ ...stock, updatedAt: new Date() })
      .where(eq(warehouseStock.id, id))
      .returning();
    return result[0];
  }

  // Suppliers
  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const result = await db.insert(suppliers).values(supplier).returning();
    return result[0];
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const result = await db.update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return result[0];
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    return result.length > 0;
  }

  // Stock Purchases
  async getAllStockPurchases(): Promise<StockPurchase[]> {
    return await db.select().from(stockPurchases).orderBy(desc(stockPurchases.createdAt));
  }

  async createStockPurchase(purchase: InsertStockPurchase): Promise<StockPurchase> {
    const result = await db.insert(stockPurchases).values(purchase).returning();
    return result[0];
  }

  // Receipts
  async getAllReceipts(): Promise<Receipt[]> {
    return await db.select().from(receipts).orderBy(desc(receipts.createdAt));
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    const result = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
    return result[0];
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const result = await db.insert(receipts).values(receipt).returning();
    return result[0];
  }

  // Accounting Entries
  async getAllAccountingEntries(): Promise<AccountingEntry[]> {
    return await db.select().from(accountingEntries).orderBy(desc(accountingEntries.date));
  }

  async createAccountingEntry(entry: InsertAccountingEntry): Promise<AccountingEntry> {
    const result = await db.insert(accountingEntries).values(entry).returning();
    return result[0];
  }

  // Main Office Account
  async getMainOfficeAccount(): Promise<MainOfficeAccountType | undefined> {
    const result = await db.select().from(mainOfficeAccount).limit(1);
    if (result.length === 0) {
      // Create default account if not exists
      const created = await db.insert(mainOfficeAccount).values({ name: 'Main Office' }).returning();
      return created[0];
    }
    return result[0];
  }

  async updateMainOfficeAccount(account: Partial<MainOfficeAccountType>): Promise<MainOfficeAccountType | undefined> {
    const existing = await this.getMainOfficeAccount();
    if (!existing) return undefined;
    
    const result = await db.update(mainOfficeAccount)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(mainOfficeAccount.id, existing.id))
      .returning();
    return result[0];
  }

  // Financial Summary
  async getFinancialSummary(): Promise<{
    totalSafeBalanceUSD: number;
    totalSafeBalanceLYD: number;
    totalBankBalanceUSD: number;
    totalBankBalanceLYD: number;
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    goodsCapitalLYD: number;
    goodsCapitalUSD: number;
    recentTransactions: Array<{ type: string; amount: number; date: Date }>;
  }> {
    // Get safe totals
    const safeResults = await db.select({
      totalUSD: sql<number>`COALESCE(SUM(balance_usd::numeric), 0)`,
      totalLYD: sql<number>`COALESCE(SUM(balance_lyd::numeric), 0)`,
    }).from(safes);

    // Get bank totals
    const bankResults = await db.select({
      totalUSD: sql<number>`COALESCE(SUM(balance_usd::numeric), 0)`,
      totalLYD: sql<number>`COALESCE(SUM(balance_lyd::numeric), 0)`,
    }).from(banks);

    // Get customer debt total (balance_owed)
    const customerDebtResult = await db.select({
      total: sql<number>`COALESCE(SUM(balance_owed::numeric), 0)`,
    }).from(customers);

    // Get supplier debt total
    const supplierDebtResult = await db.select({
      total: sql<number>`COALESCE(SUM(balance_owed::numeric), 0)`,
    }).from(suppliers);

    // Get goods capital (total inventory value = sum of cost_price * quantity for all products)
    const goodsCapitalResult = await db.select({
      totalLYD: sql<number>`COALESCE(SUM(bi.quantity * p.cost_price::numeric), 0)`,
    }).from(sql`${branchInventory} bi INNER JOIN ${products} p ON p.id = bi.product_id WHERE bi.quantity > 0`);

    // Get recent transactions from both safes and banks (last 10)
    const recentSafeTransactions = await db.select({
      type: safeTransactions.type,
      amountUSD: safeTransactions.amountUSD,
      createdAt: safeTransactions.createdAt,
    }).from(safeTransactions).orderBy(desc(safeTransactions.createdAt)).limit(5);

    const recentBankTransactions = await db.select({
      type: bankTransactions.type,
      amountUSD: bankTransactions.amountUSD,
      createdAt: bankTransactions.createdAt,
    }).from(bankTransactions).orderBy(desc(bankTransactions.createdAt)).limit(5);

    // Combine and format recent transactions
    const recentTransactions = [
      ...recentSafeTransactions.map(t => ({
        type: `safe_${t.type}`,
        amount: Number(t.amountUSD),
        date: t.createdAt,
      })),
      ...recentBankTransactions.map(t => ({
        type: `bank_${t.type}`,
        amount: Number(t.amountUSD),
        date: t.createdAt,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

    return {
      totalSafeBalanceUSD: Number(safeResults[0]?.totalUSD || 0),
      totalSafeBalanceLYD: Number(safeResults[0]?.totalLYD || 0),
      totalBankBalanceUSD: Number(bankResults[0]?.totalUSD || 0),
      totalBankBalanceLYD: Number(bankResults[0]?.totalLYD || 0),
      totalCustomerDebt: Number(customerDebtResult[0]?.total || 0),
      totalSupplierDebt: Number(supplierDebtResult[0]?.total || 0),
      goodsCapitalLYD: Number(goodsCapitalResult[0]?.totalLYD || 0),
      goodsCapitalUSD: 0,
      recentTransactions,
    };
  }

  async getGoodsCapitalDetails(): Promise<{
    items: Array<{ productId: string; productName: string; costPrice: number; sellPrice: number; branch: string; quantity: number; totalValue: number }>;
    totalCapital: number;
  }> {
    const result = await db.select({
      productId: products.id,
      productName: products.name,
      costPrice: products.costPrice,
      sellPrice: products.price,
      branch: branchInventory.branch,
      quantity: branchInventory.quantity,
    }).from(branchInventory)
      .innerJoin(products, eq(branchInventory.productId, products.id))
      .where(sql`${branchInventory.quantity} > 0 AND ${products.costPrice} IS NOT NULL`);

    const items = result.map(r => ({
      productId: r.productId,
      productName: r.productName,
      costPrice: Number(r.costPrice),
      sellPrice: Number(r.sellPrice),
      branch: r.branch,
      quantity: r.quantity,
      totalValue: r.quantity * Number(r.costPrice),
    }));

    const totalCapital = items.reduce((sum, i) => sum + i.totalValue, 0);
    return { items, totalCapital };
  }

  // ============ PRODUCTS & INVENTORY ============

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    this.invalidateProductCaches();
    return result[0];
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products).set({ ...product, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    this.invalidateProductCaches();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    this.invalidateProductCaches();
    return result.length > 0;
  }

  async getProductsWithInventory(): Promise<ProductWithInventory[]> {
    const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
    const allInventory = await db.select().from(branchInventory);
    
    return allProducts.map(product => ({
      ...product,
      inventory: allInventory.filter(inv => inv.productId === product.id),
    }));
  }

  async searchProductsByName(query: string, maxResults: number = 10): Promise<ProductWithInventory[]> {
    const searchWords = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return [];
    
    const wordConditions = searchWords.map(word => {
      const term = `%${word}%`;
      return or(
        ilike(products.name, term),
        ilike(products.sku, term),
        ilike(products.category, term)
      );
    });
    
    const matchedProducts = await db
      .select()
      .from(products)
      .where(and(...wordConditions))
      .orderBy(desc(products.createdAt))
      .limit(maxResults);

    if (matchedProducts.length === 0) return [];

    const productIds = matchedProducts.map(p => p.id);
    const inventoryData = await db
      .select()
      .from(branchInventory)
      .where(sql`${branchInventory.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);

    return matchedProducts.map(product => ({
      ...product,
      inventory: inventoryData.filter(inv => inv.productId === product.id),
    }));
  }

  private _statsCache: { data: { total: number; active: number; lowStock: number; outOfStock: number; totalSellingValue: number } | null; timestamp: number } = { data: null, timestamp: 0 };
  private _totalCountCache: { count: number; timestamp: number } = { count: 0, timestamp: 0 };

  invalidateProductCaches() {
    this._statsCache.data = null;
    this._totalCountCache.timestamp = 0;
  }

  async getProductsPaginated(params: { page: number; limit: number; search?: string; category?: string }): Promise<{ products: ProductWithInventory[]; total: number; page: number; totalPages: number }> {
    const { page, limit, search, category } = params;
    const offset = (page - 1) * limit;
    const hasFilters = (search && search.trim()) || (category && category.trim());

    const conditions = [];
    if (search && search.trim()) {
      const searchWords = search.trim().split(/\s+/).filter(w => w.length > 0);
      for (const word of searchWords) {
        const term = `%${word}%`;
        conditions.push(
          or(
            ilike(products.name, term),
            ilike(products.sku, term),
            ilike(products.category, term)
          )
        );
      }
    }
    if (category && category.trim()) {
      conditions.push(eq(products.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let total: number;
    if (!hasFilters) {
      const now = Date.now();
      if (now - this._totalCountCache.timestamp < 10000) {
        total = this._totalCountCache.count;
      } else {
        const estResult = await db.execute(sql`SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'products'`);
        const estRow = (estResult as any).rows?.[0] || estResult[0];
        const estimate = Number(estRow?.estimate) || 0;
        if (estimate > 1000) {
          total = estimate;
        } else {
          const [countResult] = await db.select({ value: count() }).from(products);
          total = Number(countResult?.value) || 0;
        }
        this._totalCountCache = { count: total, timestamp: now };
      }
    } else {
      const [countResult] = await db.select({ value: count() }).from(products).where(whereClause);
      total = Number(countResult?.value) || 0;
    }

    const paginatedProducts = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    const productIds = paginatedProducts.map(p => p.id);
    let inventoryData: BranchInventory[] = [];
    if (productIds.length > 0) {
      inventoryData = await db
        .select()
        .from(branchInventory)
        .where(sql`${branchInventory.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const inventoryMap = new Map<string, BranchInventory[]>();
    for (const inv of inventoryData) {
      const existing = inventoryMap.get(inv.productId) || [];
      existing.push(inv);
      inventoryMap.set(inv.productId, existing);
    }

    const productsWithInv: ProductWithInventory[] = paginatedProducts.map(product => ({
      ...product,
      inventory: inventoryMap.get(product.id) || [],
    }));

    return {
      products: productsWithInv,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductStats(): Promise<{ total: number; active: number; lowStock: number; outOfStock: number; totalSellingValue: number }> {
    const now = Date.now();
    if (this._statsCache.data && now - this._statsCache.timestamp < 5000) {
      return this._statsCache.data;
    }

    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products)::int AS total,
        (SELECT COUNT(*) FROM products WHERE is_active = true)::int AS active,
        COUNT(*) FILTER (WHERE COALESCE(inv.total_qty, 0) = 0)::int AS out_of_stock,
        COUNT(*) FILTER (WHERE COALESCE(inv.total_qty, 0) > 0 AND COALESCE(inv.total_qty, 0) <= COALESCE(inv.min_threshold, 5))::int AS low_stock,
        (SELECT COALESCE(SUM(CAST(p2.price AS NUMERIC) * bi.quantity), 0) FROM products p2 JOIN branch_inventory bi ON bi.product_id = p2.id WHERE bi.quantity > 0 AND p2.price IS NOT NULL) AS total_selling_value
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity) AS total_qty, MIN(low_stock_threshold) AS min_threshold
        FROM branch_inventory
        GROUP BY product_id
      ) inv ON inv.product_id = p.id
    `);
    const row = (result as any).rows?.[0] || result[0] || {};
    const stats = {
      total: Number(row.total) || 0,
      active: Number(row.active) || 0,
      lowStock: Number(row.low_stock) || 0,
      outOfStock: Number(row.out_of_stock) || 0,
      totalSellingValue: Number(row.total_selling_value) || 0,
    };
    this._statsCache = { data: stats, timestamp: now };
    return stats;
  }

  async getBranchInventory(productId: string): Promise<BranchInventory[]> {
    return await db.select().from(branchInventory).where(eq(branchInventory.productId, productId));
  }

  async upsertBranchInventory(inventory: InsertBranchInventory): Promise<BranchInventory> {
    const existing = await db.select().from(branchInventory)
      .where(sql`${branchInventory.productId} = ${inventory.productId} AND ${branchInventory.branch} = ${inventory.branch}`);
    
    if (existing.length > 0) {
      const result = await db.update(branchInventory)
        .set({ quantity: inventory.quantity, lowStockThreshold: inventory.lowStockThreshold, updatedAt: new Date() })
        .where(eq(branchInventory.id, existing[0].id))
        .returning();
      this.invalidateProductCaches();
      return result[0];
    } else {
      const result = await db.insert(branchInventory).values(inventory).returning();
      this.invalidateProductCaches();
      return result[0];
    }
  }

  async deleteBranchInventory(id: string): Promise<boolean> {
    const result = await db.delete(branchInventory).where(eq(branchInventory.id, id)).returning();
    this.invalidateProductCaches();
    return result.length > 0;
  }

  async getAllInvoices(): Promise<SalesInvoiceWithItems[]> {
    const allInvoices = await db.select().from(salesInvoices).orderBy(desc(salesInvoices.createdAt));
    const allItems = await db.select().from(invoiceItems);
    
    return allInvoices.map(invoice => ({
      ...invoice,
      items: allItems.filter(item => item.invoiceId === invoice.id),
    }));
  }

  async getInvoice(id: string): Promise<SalesInvoiceWithItems | undefined> {
    const invoiceResult = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id));
    if (invoiceResult.length === 0) return undefined;
    
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    return { ...invoiceResult[0], items };
  }

  async createInvoice(invoice: InsertSalesInvoice, items: InsertInvoiceItem[]): Promise<SalesInvoiceWithItems> {
    const invoiceResult = await db.insert(salesInvoices).values(invoice).returning();
    const createdInvoice = invoiceResult[0];
    
    const itemsWithInvoiceId = items.map(item => ({
      ...item,
      invoiceId: createdInvoice.id,
    }));
    
    const createdItems = await db.insert(invoiceItems).values(itemsWithInvoiceId).returning();
    
    for (const item of items) {
      const inv = await db.select().from(branchInventory)
        .where(sql`${branchInventory.productId} = ${item.productId} AND ${branchInventory.branch} = ${invoice.branch}`);
      
      if (inv.length > 0) {
        const newQty = Math.max(0, inv[0].quantity - item.quantity);
        await db.update(branchInventory)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(branchInventory.id, inv[0].id));
      }
    }
    
    return { ...createdInvoice, items: createdItems };
  }

  async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    
    const existingInvoices = await db.select().from(salesInvoices)
      .where(sql`${salesInvoices.invoiceNumber} LIKE ${datePrefix + '%'}`);
    
    const nextNum = existingInvoices.length + 1;
    return `${datePrefix}-${String(nextNum).padStart(4, '0')}`;
  }
  
  async updateInvoice(id: string, invoiceData: Partial<InsertSalesInvoice>, newItems?: InsertInvoiceItem[]): Promise<SalesInvoiceWithItems | undefined> {
    const existing = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id));
    if (existing.length === 0) return undefined;

    const oldInvoice = existing[0];

    if (newItems && newItems.length > 0) {
      const oldItems = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      for (const oldItem of oldItems) {
        const inv = await db.select().from(branchInventory)
          .where(sql`${branchInventory.productId} = ${oldItem.productId} AND ${branchInventory.branch} = ${oldInvoice.branch}`);
        if (inv.length > 0) {
          await db.update(branchInventory)
            .set({ quantity: inv[0].quantity + oldItem.quantity, updatedAt: new Date() })
            .where(eq(branchInventory.id, inv[0].id));
        }
      }

      await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      const branch = invoiceData.branch || oldInvoice.branch;
      const itemsWithId = newItems.map(item => ({ ...item, invoiceId: id }));
      const createdItems = await db.insert(invoiceItems).values(itemsWithId).returning();

      for (const item of newItems) {
        const inv = await db.select().from(branchInventory)
          .where(sql`${branchInventory.productId} = ${item.productId} AND ${branchInventory.branch} = ${branch}`);
        if (inv.length > 0) {
          const newQty = Math.max(0, inv[0].quantity - item.quantity);
          await db.update(branchInventory)
            .set({ quantity: newQty, updatedAt: new Date() })
            .where(eq(branchInventory.id, inv[0].id));
        }
      }
    }

    const [updated] = await db.update(salesInvoices).set(invoiceData).where(eq(salesInvoices.id, id)).returning();
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    return { ...updated, items };
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const existing = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id));
    if (existing.length === 0) return false;

    const invoice = existing[0];
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

    for (const item of items) {
      const inv = await db.select().from(branchInventory)
        .where(sql`${branchInventory.productId} = ${item.productId} AND ${branchInventory.branch} = ${invoice.branch}`);
      if (inv.length > 0) {
        await db.update(branchInventory)
          .set({ quantity: inv[0].quantity + item.quantity, updatedAt: new Date() })
          .where(eq(branchInventory.id, inv[0].id));
      }
    }

    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await db.delete(salesInvoices).where(eq(salesInvoices.id, id));
    return true;
  }

  async returnInvoiceItems(invoiceId: string, returnItems: Array<{itemId: string; quantity: number}>): Promise<SalesInvoiceWithItems | undefined> {
    const existing = await db.select().from(salesInvoices).where(eq(salesInvoices.id, invoiceId));
    if (existing.length === 0) return undefined;

    const invoice = existing[0];

    for (const ret of returnItems) {
      const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, ret.itemId));
      if (!item) continue;

      if (ret.quantity >= item.quantity) {
        await db.delete(invoiceItems).where(eq(invoiceItems.id, ret.itemId));
      } else {
        const newQty = item.quantity - ret.quantity;
        const newLineTotal = newQty * Number(item.unitPrice);
        await db.update(invoiceItems)
          .set({ quantity: newQty, lineTotal: String(newLineTotal) })
          .where(eq(invoiceItems.id, ret.itemId));
      }

      const inv = await db.select().from(branchInventory)
        .where(sql`${branchInventory.productId} = ${item.productId} AND ${branchInventory.branch} = ${invoice.branch}`);
      if (inv.length > 0) {
        await db.update(branchInventory)
          .set({ quantity: inv[0].quantity + ret.quantity, updatedAt: new Date() })
          .where(eq(branchInventory.id, inv[0].id));
      }
    }

    const remainingItems = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    
    if (remainingItems.length === 0) {
      await db.delete(salesInvoices).where(eq(salesInvoices.id, invoiceId));
      return undefined;
    }

    const newTotal = remainingItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const [updated] = await db.update(salesInvoices)
      .set({ totalAmount: String(newTotal) })
      .where(eq(salesInvoices.id, invoiceId))
      .returning();

    return { ...updated, items: remainingItems };
  }

  async checkInvoiceStock(branch: string, items: Array<{productId: string; quantity: number}>): Promise<{success: boolean; message?: string}> {
    for (const item of items) {
      const inv = await db.select().from(branchInventory)
        .where(sql`${branchInventory.productId} = ${item.productId} AND ${branchInventory.branch} = ${branch}`);
      
      if (inv.length === 0) {
        const allInv = await db.select().from(branchInventory)
          .where(sql`${branchInventory.productId} = ${item.productId}`);
        if (allInv.length === 0) {
          await db.insert(branchInventory).values({
            productId: item.productId,
            branch: branch as any,
            quantity: 0,
            lowStockThreshold: 5,
          });
          return { success: false, message: `Product has 0 stock in ${branch}. Please add stock first.` };
        }
        return { success: false, message: `Product not available in ${branch}. It exists in: ${allInv.map(i => i.branch).join(', ')}` };
      }
      
      if (inv[0].quantity < item.quantity) {
        return { success: false, message: `Insufficient stock for product. Available: ${inv[0].quantity}, Requested: ${item.quantity}` };
      }
    }
    return { success: true };
  }

  async getAllExpenseCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories).orderBy(desc(expenseCategories.createdAt));
  }

  async createExpenseCategory(data: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [category] = await db.insert(expenseCategories).values(data).returning();
    return category;
  }

  async getAllReconciliations(): Promise<CashboxReconciliation[]> {
    return await db.select().from(cashboxReconciliations).orderBy(desc(cashboxReconciliations.createdAt));
  }

  async createReconciliation(data: InsertCashboxReconciliation): Promise<CashboxReconciliation> {
    const [reconciliation] = await db.insert(cashboxReconciliations).values(data).returning();
    return reconciliation;
  }

  async getAllOwnerAccounts(): Promise<OwnerAccount[]> {
    return await db.select().from(ownerAccounts).orderBy(desc(ownerAccounts.createdAt));
  }

  async createOwnerAccount(data: InsertOwnerAccount): Promise<OwnerAccount> {
    const [account] = await db.insert(ownerAccounts).values(data).returning();
    return account;
  }

  async updateOwnerAccount(id: string, data: Partial<InsertOwnerAccount>): Promise<OwnerAccount | undefined> {
    const [account] = await db.update(ownerAccounts).set({ ...data, updatedAt: new Date() }).where(eq(ownerAccounts.id, id)).returning();
    return account;
  }

  async getCapitalTransactions(ownerAccountId: string): Promise<CapitalTransaction[]> {
    return await db.select().from(capitalTransactions).where(eq(capitalTransactions.ownerAccountId, ownerAccountId)).orderBy(desc(capitalTransactions.createdAt));
  }

  async createCapitalTransaction(data: InsertCapitalTransaction): Promise<CapitalTransaction> {
    const [transaction] = await db.insert(capitalTransactions).values(data).returning();
    return transaction;
  }
}

export const storage = new PostgreSQLStorage();
