import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { requireAuth, requireOwner, requireOperational, requireDeliveryManager, requireShippingStaff, requireDeliveryAccess } from "./middleware";
import { ObjectStorageService } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import {
  insertUserSchema,
  insertCustomerSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertShippingRateSchema,
  insertCommissionRuleSchema,
  insertSettingSchema,
  insertMessageSchema,
  insertDeliveryTaskSchema,
  insertExpenseSchema,
  insertRevenueAccountSchema,
  insertSafeSchema,
  insertSafeTransactionSchema,
  insertBankSchema,
  insertBankTransactionSchema,
  insertCurrencySettlementSchema,
  insertWarehouseSchema,
  insertWarehouseStockSchema,
  insertSupplierSchema,
  insertReceiptSchema,
  insertAccountingEntrySchema,
  insertProductSchema,
  insertBranchInventorySchema,
  loginSchema,
} from "@shared/schema";
import { darbAssabilService } from "./services/darbAssabil";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: "owner" | "customer_service" | "receptionist" | "sorter" | "stock_manager" | "shipping_staff";
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration with MemoryStore
  const MemoryStoreSession = MemoryStore(session);
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.set('trust proxy', 1);
  app.use(
    session({
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Passport configuration
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
        });
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isActive: user.isActive,
      });
    } catch (error) {
      done(error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid credentials format" });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        // Explicitly save session before responding
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return next(saveErr);
          }
          console.log("Login success - Session ID:", req.sessionID);
          console.log("Login success - User:", user.username);
          res.json({ user });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    console.log("Auth check - Session ID:", req.sessionID);
    console.log("Auth check - Session user:", (req.session as any)?.passport?.user);
    console.log("Auth check - isAuthenticated:", req.isAuthenticated());
    console.log("Auth check - Cookies received:", req.headers.cookie);
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User management routes
  app.get("/api/users", requireOwner, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireOwner, async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        console.error("User validation error:", result.error.errors);
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
      });

      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(500).json({ message: "Failed to create user", error: error?.message || "Unknown error" });
    }
  });

  app.put("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const result = insertUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      let updateData = result.data;
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Customer routes
  app.get("/api/customers", requireOperational, async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/search/phone", requireOperational, async (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ message: "Phone number is required" });
      }
      const customer = await storage.getCustomerByPhone(phone);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to search customer" });
    }
  });

  app.get("/api/customers/search", requireOperational, async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Search query is required" });
      }
      const customers = await storage.searchCustomers(query);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to search customers" });
    }
  });

  app.get("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const customer = await storage.getCustomerWithOrders(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireOperational, async (req, res) => {
    try {
      const result = insertCustomerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      const customer = await storage.createCustomer(result.data);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const result = insertCustomerSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      const customer = await storage.updateCustomer(req.params.id, result.data);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/customers/:id/update-with-payment", requireOperational, async (req, res) => {
    try {
      const { customerData, totalDownPayment } = req.body;
      
      const result = insertCustomerSchema.partial().safeParse(customerData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid customer data", errors: result.error.errors });
      }

      if (typeof totalDownPayment !== 'number' || totalDownPayment < 0 || isNaN(totalDownPayment)) {
        return res.status(400).json({ message: "Invalid down payment value" });
      }

      const customerOrders = await storage.getOrdersByCustomerId(req.params.id);
      
      if (customerOrders.length > 0) {
        const totalOrderAmount = customerOrders.reduce((sum: number, order) => sum + parseFloat(order.totalAmount), 0);
        
        if (totalOrderAmount <= 0 || isNaN(totalOrderAmount)) {
          return res.status(400).json({ message: "No valid orders to distribute payment to" });
        }
      }

      const customer = await storage.updateCustomer(req.params.id, result.data);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (customerOrders.length > 0) {
        const totalOrderAmount = customerOrders.reduce((sum: number, order) => sum + parseFloat(order.totalAmount), 0);
        const cappedDownPayment = Math.min(totalDownPayment, totalOrderAmount);
        
        let distributedSoFar = 0;
        
        for (let i = 0; i < customerOrders.length; i++) {
          const order = customerOrders[i];
          const orderAmount = parseFloat(order.totalAmount);
          
          let orderDownPayment: number;
          if (i === customerOrders.length - 1) {
            orderDownPayment = Math.min(cappedDownPayment - distributedSoFar, orderAmount);
          } else {
            const proportion = orderAmount / totalOrderAmount;
            orderDownPayment = Math.min(cappedDownPayment * proportion, orderAmount);
            distributedSoFar += orderDownPayment;
          }
          
          const orderRemaining = Math.max(0, orderAmount - orderDownPayment);
          
          await storage.updateOrder(order.id, {
            downPayment: orderDownPayment.toFixed(2),
            remainingBalance: orderRemaining.toFixed(2)
          });
        }
      }

      res.json({ customer, message: "Customer and payments updated successfully" });
    } catch (error) {
      console.error("Error updating customer with payment:", error);
      res.status(500).json({ message: "Failed to update customer", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/customers/:id", requireOperational, async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Order routes
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error: any) {
      console.error("Failed to fetch orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: error?.message });
    }
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrderWithCustomer(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", requireOperational, async (req, res) => {
    try {
      console.log("=== CREATE ORDER REQUEST ===");
      console.log("Body keys:", Object.keys(req.body));
      console.log("Has order:", !!req.body.order);
      console.log("Has items:", !!req.body.items);
      
      // Check if request contains order and items data (new format)
      if (req.body.order && req.body.items) {
        console.log("Order data:", JSON.stringify(req.body.order, null, 2));
        console.log("Items count:", req.body.items.length);
        
        const orderResult = insertOrderSchema.safeParse(req.body.order);
        if (!orderResult.success) {
          console.error("Order validation failed:", orderResult.error.errors);
          return res.status(400).json({ message: "Invalid order data", errors: orderResult.error.errors });
        }
        console.log("Order validation passed");

        const itemsResult = req.body.items.map((item: any) => 
          insertOrderItemSchema.omit({ orderId: true }).safeParse(item)
        );
        
        const invalidItems = itemsResult.filter((result: any) => !result.success);
        if (invalidItems.length > 0) {
          return res.status(400).json({ message: "Invalid order items data", errors: invalidItems });
        }

        // Auto-generate shipping code for customer if they don't have one
        const customer = await storage.getCustomer(orderResult.data.customerId);
        if (customer && !customer.shippingCode) {
          // Generate unique shipping code: TW + timestamp + random 4 digits
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.floor(1000 + Math.random() * 9000);
          const shippingCode = `TW${timestamp}${random}`;
          
          await storage.updateCustomer(customer.id, { shippingCode });
        }

        // Create order first
        const order = await storage.createOrder(orderResult.data);
        
        // Create order items
        const items = [];
        for (const itemData of req.body.items) {
          const item = await storage.createOrderItem({
            ...itemData,
            orderId: order.id,
          });
          items.push(item);
        }

        // Create order images if provided
        if (req.body.images && Array.isArray(req.body.images)) {
          for (let i = 0; i < Math.min(req.body.images.length, 3); i++) {
            const imageData = req.body.images[i];
            if (imageData.url) {
              await storage.createOrderImage({
                orderId: order.id,
                url: imageData.url,
                altText: imageData.altText || null,
                position: i,
              });
            }
          }
        }

        // Return order with items
        const orderWithItems = await storage.getOrderWithCustomer(order.id);
        res.status(201).json(orderWithItems);
      } else {
        // Legacy format - just order data
        const result = insertOrderSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ message: "Invalid order data", errors: result.error.errors });
        }

        // Auto-generate shipping code for customer if they don't have one
        const customer = await storage.getCustomer(result.data.customerId);
        if (customer && !customer.shippingCode) {
          // Generate unique shipping code: TW + timestamp + random 4 digits
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.floor(1000 + Math.random() * 9000);
          const shippingCode = `TW${timestamp}${random}`;
          
          await storage.updateCustomer(customer.id, { shippingCode });
        }

        const order = await storage.createOrder(result.data);
        res.status(201).json(order);
      }
    } catch (error) {
      console.error("Order creation error:", error);
      console.error("Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      res.status(500).json({ 
        message: "Failed to create order",
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  app.put("/api/orders/:id", requireOperational, async (req, res) => {
    try {
      const result = insertOrderSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order data", errors: result.error.errors });
      }

      const order = await storage.updateOrder(req.params.id, result.data);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Auto-send to Darb Assabil when status changes to "partially_arrived" (non-Tripoli orders)
      if (result.data.status === "partially_arrived" && darbAssabilService.isConfigured()) {
        const fullOrder = await storage.getOrderWithCustomer(req.params.id);
        
        if (fullOrder && 
            fullOrder.shippingCity && 
            fullOrder.shippingCity.toLowerCase() !== 'tripoli' &&
            !fullOrder.darbAssabilReference) {
          
          try {
            const customer = fullOrder.customer;
            const items = await storage.getOrderItems(fullOrder.id);

            const darbAssabilPayload = {
              receiverName: `${customer.firstName} ${customer.lastName}`,
              receiverPhone: customer.phone,
              receiverAddress: {
                city: fullOrder.shippingCity || customer.city || 'Libya',
                street: customer.address || '',
                notes: fullOrder.notes || '',
              },
              items: items.map(item => ({
                name: item.productName,
                quantity: item.quantity,
                price: parseFloat(item.unitPrice),
                weight: item.quantity * 0.5,
              })),
              totalAmount: parseFloat(fullOrder.totalAmount),
              notes: fullOrder.notes || `Order #${fullOrder.orderNumber}`,
              collectOnDelivery: parseFloat(fullOrder.remainingBalance) > 0,
              codAmount: parseFloat(fullOrder.remainingBalance),
            };

            const darbResult = await darbAssabilService.createOrder(darbAssabilPayload);

            if (darbResult.success) {
              await storage.updateOrder(fullOrder.id, {
                darbAssabilOrderId: darbResult.data?.orderId,
                darbAssabilReference: darbResult.data?.reference,
                trackingNumber: darbResult.data?.trackingNumber || darbResult.data?.reference,
                status: "with_shipping_company",
              });
              console.log(`Auto-sent order ${fullOrder.orderNumber} to Darb Assabil. Reference: ${darbResult.data?.reference}`);
            } else {
              console.error(`Failed to auto-send order ${fullOrder.orderNumber} to Darb Assabil:`, darbResult.error);
            }
          } catch (darbError) {
            console.error('Auto Darb Assabil integration error:', darbError);
          }
        }
      }

      res.json(order);
    } catch (error) {
      console.error("Order update error:", error);
      console.error("Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      res.status(500).json({ 
        message: "Failed to update order",
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  // PATCH endpoint for partial updates (same as PUT)
  app.patch("/api/orders/:id", requireOperational, async (req, res) => {
    try {
      const result = insertOrderSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order data", errors: result.error.errors });
      }

      const order = await storage.updateOrder(req.params.id, result.data);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      console.error("Order update error:", error);
      res.status(500).json({ 
        message: "Failed to update order",
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });

  app.delete("/api/orders/:id", requireOperational, async (req, res) => {
    try {
      const success = await storage.deleteOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Darb Assabil Integration Route
  app.post("/api/orders/:id/send-to-darb-assabil", requireOperational, async (req, res) => {
    try {
      if (!darbAssabilService.isConfigured()) {
        return res.status(400).json({ 
          message: "Darb Assabil API is not configured. Please add API credentials." 
        });
      }

      const order = await storage.getOrderWithCustomer(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const customer = order.customer;
      const items = await storage.getOrderItems(order.id);

      // Prepare order data for Darb Assabil API
      const darbAssabilPayload = {
        receiverName: `${customer.firstName} ${customer.lastName}`,
        receiverPhone: customer.phone,
        receiverAddress: {
          city: order.shippingCity || customer.city || 'Tripoli',
          street: customer.address || '',
          notes: order.notes || '',
        },
        items: items.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          price: parseFloat(item.unitPrice),
          weight: item.quantity * 0.5, // Estimate 0.5kg per item
        })),
        totalAmount: parseFloat(order.totalAmount),
        notes: order.notes || `Order #${order.orderNumber}`,
        collectOnDelivery: parseFloat(order.remainingBalance) > 0,
        codAmount: parseFloat(order.remainingBalance),
      };

      // Send to Darb Assabil
      const result = await darbAssabilService.createOrder(darbAssabilPayload);

      if (!result.success) {
        return res.status(500).json({ 
          message: result.message || "Failed to create order in Darb Assabil",
          error: result.error
        });
      }

      // Update order with Darb Assabil details
      await storage.updateOrder(order.id, {
        darbAssabilOrderId: result.data?.orderId,
        darbAssabilReference: result.data?.reference,
        trackingNumber: result.data?.trackingNumber || result.data?.reference,
        status: "with_shipping_company",
      });

      res.json({
        message: "Order sent to Darb Assabil successfully",
        darbAssabilOrderId: result.data?.orderId,
        reference: result.data?.reference,
        trackingNumber: result.data?.trackingNumber || result.data?.reference,
      });
    } catch (error) {
      console.error("Darb Assabil integration error:", error);
      res.status(500).json({ message: "Failed to send order to Darb Assabil" });
    }
  });

  // Order Items routes
  app.get("/api/orders/:orderId/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getOrderItems(req.params.orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders/:orderId/items", requireOperational, async (req, res) => {
    try {
      const result = insertOrderItemSchema.safeParse({
        ...req.body,
        orderId: req.params.orderId,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order item data", errors: result.error.errors });
      }

      const item = await storage.createOrderItem(result.data);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order item" });
    }
  });

  app.put("/api/order-items/:id", requireOperational, async (req, res) => {
    try {
      const result = insertOrderItemSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid order item data", errors: result.error.errors });
      }

      const item = await storage.updateOrderItem(req.params.id, result.data);
      if (!item) {
        return res.status(404).json({ message: "Order item not found" });
      }

      // Recalculate order totals
      const allItems = await storage.getOrderItems(item.orderId);
      const order = await storage.getOrder(item.orderId);
      
      if (order) {
        // Calculate new totals
        const itemsSubtotal = allItems.reduce((sum, i) => {
          const originalPrice = parseFloat(i.originalPrice || '0');
          const discountedPrice = parseFloat(i.discountedPrice || '0');
          const quantity = i.quantity;
          return sum + (originalPrice * quantity);
        }, 0);

        const itemsProfit = allItems.reduce((sum, i) => {
          const originalPrice = parseFloat(i.originalPrice || '0');
          const unitPrice = parseFloat(i.unitPrice || '0');
          const quantity = i.quantity;
          return sum + ((originalPrice - unitPrice) * quantity);
        }, 0);

        const shippingCost = parseFloat(order.shippingCost || '0');
        const commission = parseFloat(order.commission || '0');
        const totalAmount = itemsSubtotal + shippingCost + commission;
        const shippingProfit = parseFloat(order.shippingProfit || '0');
        const totalProfit = itemsProfit + shippingProfit;

        // Update order with new totals
        await storage.updateOrder(item.orderId, {
          totalAmount: totalAmount.toFixed(2),
          itemsProfit: itemsProfit.toFixed(2),
          totalProfit: totalProfit.toFixed(2),
        });
      }

      res.json(item);
    } catch (error) {
      console.error("Failed to update order item:", error);
      res.status(500).json({ message: "Failed to update order item" });
    }
  });

  // Shipping rates routes
  app.get("/api/shipping-rates", requireAuth, async (req, res) => {
    try {
      const rates = await storage.getAllShippingRates();
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping rates" });
    }
  });

  app.post("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const rate = await storage.createShippingRate(result.data);
      res.status(201).json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to create shipping rate" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/dashboard", requireAuth, async (req, res) => {
    try {
      const [totalProfit, totalRevenue, activeOrders] = await Promise.all([
        storage.getTotalProfit(),
        storage.getTotalRevenue(),
        storage.getActiveOrdersCount(),
      ]);

      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      res.json({
        totalProfit,
        totalRevenue,
        activeOrders,
        profitMargin,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Settings routes
  app.get("/api/settings", requireOwner, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", requireOwner, async (req, res) => {
    try {
      const result = insertSettingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid setting data", errors: result.error.errors });
      }

      const setting = await storage.createSetting(result.data);
      res.status(201).json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const { value, type } = req.body;
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }

      const setting = await storage.updateSetting(req.params.key, value, type);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:key", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteSetting(req.params.key);
      if (!success) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  // Shipping Rates routes
  app.get("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const shippingRates = await storage.getAllShippingRates();
      res.json(shippingRates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping rates" });
    }
  });

  app.post("/api/shipping-rates", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const shippingRate = await storage.createShippingRate(result.data);
      res.status(201).json(shippingRate);
    } catch (error) {
      console.error("Error creating shipping rate:", error);
      res.status(500).json({ message: "Failed to create shipping rate" });
    }
  });

  app.put("/api/shipping-rates/:id", requireOwner, async (req, res) => {
    try {
      const result = insertShippingRateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid shipping rate data", errors: result.error.errors });
      }

      const shippingRate = await storage.updateShippingRate(req.params.id, result.data);
      if (!shippingRate) {
        return res.status(404).json({ message: "Shipping rate not found" });
      }
      res.json(shippingRate);
    } catch (error) {
      res.status(500).json({ message: "Failed to update shipping rate" });
    }
  });

  app.delete("/api/shipping-rates/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteShippingRate(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Shipping rate not found" });
      }
      res.json({ message: "Shipping rate deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shipping rate" });
    }
  });

  app.get("/api/shipping-countries", requireAuth, async (req, res) => {
    try {
      const shippingRates = await storage.getAllShippingRates();
      const countriesSet = new Set(shippingRates.map(rate => rate.country));
      const uniqueCountries = Array.from(countriesSet);
      res.json(uniqueCountries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping countries" });
    }
  });

  // Commission Rules routes
  app.get("/api/commission-rules", requireOwner, async (req, res) => {
    try {
      const commissionRules = await storage.getAllCommissionRules();
      res.json(commissionRules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch commission rules" });
    }
  });

  app.post("/api/commission-rules", requireOwner, async (req, res) => {
    try {
      // Handle empty maxValue by converting to null
      const processedData = {
        ...req.body,
        maxValue: req.body.maxValue === "" || req.body.maxValue === null || req.body.maxValue === undefined ? null : req.body.maxValue,
      };

      const result = insertCommissionRuleSchema.safeParse(processedData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid commission rule data", errors: result.error.errors });
      }

      const commissionRule = await storage.createCommissionRule(result.data);
      res.status(201).json(commissionRule);
    } catch (error) {
      console.error("Error creating commission rule:", error);
      res.status(500).json({ message: "Failed to create commission rule" });
    }
  });

  app.put("/api/commission-rules/:id", requireOwner, async (req, res) => {
    try {
      // Handle empty maxValue by converting to null
      const processedData = {
        ...req.body,
        maxValue: req.body.maxValue === "" || req.body.maxValue === null || req.body.maxValue === undefined ? null : req.body.maxValue,
      };

      const result = insertCommissionRuleSchema.partial().safeParse(processedData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid commission rule data", errors: result.error.errors });
      }

      const commissionRule = await storage.updateCommissionRule(req.params.id, result.data);
      if (!commissionRule) {
        return res.status(404).json({ message: "Commission rule not found" });
      }
      res.json(commissionRule);
    } catch (error) {
      console.error("Error updating commission rule:", error);
      res.status(500).json({ message: "Failed to update commission rule" });
    }
  });

  app.delete("/api/commission-rules/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteCommissionRule(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Commission rule not found" });
      }
      res.json({ message: "Commission rule deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete commission rule" });
    }
  });

  // Shipping Calculation route
  app.post("/api/calculate-shipping", requireAuth, async (req, res) => {
    try {
      const { country, category, weight, orderValue } = req.body;
      
      if (!country || !category || !weight || !orderValue) {
        return res.status(400).json({ 
          message: "Missing required fields: country, category, weight, orderValue" 
        });
      }

      const calculation = await storage.calculateShipping(country, category, weight, orderValue);
      res.json(calculation);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to calculate shipping" 
      });
    }
  });

  // Messages routes
  app.get("/api/messages/recipients", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Return minimal user data for recipient selection (exclude passwords and sensitive info)
      const recipients = users
        .filter(u => u.id !== req.user?.id) // Exclude current user
        .map(({ id, firstName, lastName, role }) => ({
          id,
          firstName,
          lastName,
          role,
        }));
      res.json(recipients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipients" });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const result = insertMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid message data", errors: result.error.errors });
      }

      const message = await storage.createMessage(result.data);
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const messages = await storage.getMessagesByUserId(req.user.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/unread-count", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/messages/:id/read", requireAuth, async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteMessage(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Profile management routes (for users to edit their own profile)
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { username, firstName, lastName } = req.body;
      
      // Validate input
      if (!username || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required" });
      }

      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const updatedUser = await storage.updateUser(req.user.id, {
        username: username.trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch("/api/profile/password", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get current user from database
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.user.id, {
        password: hashedPassword,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // Delivery Tasks routes
  // Create a new delivery task (assign task to shipping staff) - managers only
  app.post("/api/delivery-tasks", requireDeliveryManager, async (req, res) => {
    try {
      const result = insertDeliveryTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid task data", errors: result.error.errors });
      }

      const task = await storage.createDeliveryTask(result.data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating delivery task:", error);
      res.status(500).json({ message: "Failed to create delivery task" });
    }
  });

  // Get all delivery tasks (for managers/admins) or user's tasks (for shipping staff)
  app.get("/api/delivery-tasks", requireDeliveryAccess, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // If user is shipping staff, only show their tasks
      if (req.user.role === "shipping_staff") {
        const tasks = await storage.getDeliveryTasksByUserId(req.user.id);
        return res.json(tasks);
      }

      // For other roles, show all tasks
      const tasks = await storage.getAllDeliveryTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching delivery tasks:", error);
      res.status(500).json({ message: "Failed to fetch delivery tasks" });
    }
  });

  // Get a specific delivery task
  app.get("/api/delivery-tasks/:id", requireDeliveryAccess, async (req, res) => {
    try {
      const task = await storage.getDeliveryTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Shipping staff can only view their own tasks
      if (req.user!.role === "shipping_staff" && task.assignedToUserId !== req.user!.id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch delivery task" });
    }
  });

  // Update delivery task (change status, add notes, etc.)
  app.patch("/api/delivery-tasks/:id", requireDeliveryAccess, async (req, res) => {
    try {
      // First, get the task to check ownership
      const existingTask = await storage.getDeliveryTask(req.params.id);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Shipping staff can only update their own tasks
      if (req.user!.role === "shipping_staff" && existingTask.assignedToUserId !== req.user!.id) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      const { status, customerCode, paymentAmount, notes, completedAt } = req.body;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (customerCode !== undefined) updateData.customerCode = customerCode;
      if (paymentAmount !== undefined) updateData.paymentAmount = paymentAmount;
      if (notes !== undefined) updateData.notes = notes;
      if (completedAt !== undefined) {
        // Convert ISO string to Date object for Drizzle timestamp column
        updateData.completedAt = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;
      }
      
      const task = await storage.updateDeliveryTask(req.params.id, updateData);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // When down payment is collected (status changed to "to_collect" or "completed")
      // Update the order status to "ready_to_buy" if it has a down payment
      if ((status === "to_collect" || status === "completed") && existingTask.orderId) {
        const order = await storage.getOrder(existingTask.orderId);
        if (order && parseFloat(order.downPayment) > 0) {
          await storage.updateOrder(existingTask.orderId, { status: "ready_to_buy" });
        }
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error updating delivery task:", error);
      res.status(500).json({ message: "Failed to update delivery task", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete delivery task - managers only
  app.delete("/api/delivery-tasks/:id", requireDeliveryManager, async (req, res) => {
    try {
      const success = await storage.deleteDeliveryTask(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete delivery task" });
    }
  });

  // Get all shipping staff users (for task assignment) - managers only
  app.get("/api/shipping-staff", requireDeliveryManager, async (req, res) => {
    try {
      const shippingStaff = await storage.getShippingStaffUsers();
      const staffList = shippingStaff.map(({ id, firstName, lastName, username }) => ({
        id,
        firstName,
        lastName,
        username,
      }));
      res.json(staffList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shipping staff" });
    }
  });

  // Get task history for a specific shipping staff member - managers only
  app.get("/api/delivery-tasks/history/:userId", requireDeliveryManager, async (req, res) => {
    try {
      const tasks = await storage.getDeliveryTasksByUserId(req.params.userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task history" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const expenses = await storage.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireOwner, async (req, res) => {
    try {
      const result = insertExpenseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid expense data", errors: result.error.errors });
      }

      const expense = await storage.createExpense(result.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteExpense(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // ============ PRODUCTS & INVENTORY ROUTES ============

  // Products
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/with-inventory", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProductsWithInventory();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products with inventory" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const result = insertProductSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid product data", errors: result.error.errors });
      }
      const product = await storage.createProduct(result.data);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Branch Inventory
  app.post("/api/inventory", requireAuth, async (req, res) => {
    try {
      const result = insertBranchInventorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid inventory data", errors: result.error.errors });
      }
      const inventory = await storage.upsertBranchInventory(result.data);
      res.status(201).json(inventory);
    } catch (error) {
      res.status(500).json({ message: "Failed to update inventory" });
    }
  });

  app.get("/api/inventory/:productId", requireAuth, async (req, res) => {
    try {
      const inventory = await storage.getBranchInventory(req.params.productId);
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // ============ FINANCIAL MODULE ROUTES ============

  // Revenue Accounts
  app.get("/api/revenue-accounts", requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getAllRevenueAccounts();
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch revenue accounts" });
    }
  });

  app.post("/api/revenue-accounts", requireOwner, async (req, res) => {
    try {
      const result = insertRevenueAccountSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid revenue account data", errors: result.error.errors });
      }
      const account = await storage.createRevenueAccount(result.data);
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to create revenue account" });
    }
  });

  app.patch("/api/revenue-accounts/:id", requireOwner, async (req, res) => {
    try {
      const account = await storage.updateRevenueAccount(req.params.id, req.body);
      if (!account) {
        return res.status(404).json({ message: "Revenue account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to update revenue account" });
    }
  });

  app.delete("/api/revenue-accounts/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteRevenueAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Revenue account not found" });
      }
      res.json({ message: "Revenue account deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete revenue account" });
    }
  });

  // Safes
  app.get("/api/safes", requireAuth, async (req, res) => {
    try {
      const safes = await storage.getAllSafes();
      res.json(safes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch safes" });
    }
  });

  app.post("/api/safes", requireOwner, async (req, res) => {
    try {
      const result = insertSafeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid safe data", errors: result.error.errors });
      }
      const safe = await storage.createSafe(result.data);
      res.status(201).json(safe);
    } catch (error) {
      res.status(500).json({ message: "Failed to create safe" });
    }
  });

  app.patch("/api/safes/:id", requireOwner, async (req, res) => {
    try {
      const safe = await storage.updateSafe(req.params.id, req.body);
      if (!safe) {
        return res.status(404).json({ message: "Safe not found" });
      }
      res.json(safe);
    } catch (error) {
      res.status(500).json({ message: "Failed to update safe" });
    }
  });

  app.delete("/api/safes/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteSafe(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Safe not found" });
      }
      res.json({ message: "Safe deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete safe" });
    }
  });

  // Safe Transactions
  app.get("/api/safes/:safeId/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getSafeTransactions(req.params.safeId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch safe transactions" });
    }
  });

  app.post("/api/safes/:safeId/transactions", requireOwner, async (req, res) => {
    try {
      const result = insertSafeTransactionSchema.safeParse({
        ...req.body,
        safeId: req.params.safeId,
        createdByUserId: req.user!.id,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid transaction data", errors: result.error.errors });
      }
      const transaction = await storage.createSafeTransaction(result.data);
      res.status(201).json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to create safe transaction" });
    }
  });

  // Banks
  app.get("/api/banks", requireAuth, async (req, res) => {
    try {
      const banks = await storage.getAllBanks();
      res.json(banks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch banks" });
    }
  });

  app.post("/api/banks", requireOwner, async (req, res) => {
    try {
      const result = insertBankSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid bank data", errors: result.error.errors });
      }
      const bank = await storage.createBank(result.data);
      res.status(201).json(bank);
    } catch (error) {
      res.status(500).json({ message: "Failed to create bank" });
    }
  });

  app.patch("/api/banks/:id", requireOwner, async (req, res) => {
    try {
      const bank = await storage.updateBank(req.params.id, req.body);
      if (!bank) {
        return res.status(404).json({ message: "Bank not found" });
      }
      res.json(bank);
    } catch (error) {
      res.status(500).json({ message: "Failed to update bank" });
    }
  });

  app.delete("/api/banks/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteBank(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Bank not found" });
      }
      res.json({ message: "Bank deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete bank" });
    }
  });

  // Bank Transactions
  app.get("/api/banks/:bankId/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getBankTransactions(req.params.bankId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bank transactions" });
    }
  });

  app.post("/api/banks/:bankId/transactions", requireOwner, async (req, res) => {
    try {
      const result = insertBankTransactionSchema.safeParse({
        ...req.body,
        bankId: req.params.bankId,
        createdByUserId: req.user!.id,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid transaction data", errors: result.error.errors });
      }
      const transaction = await storage.createBankTransaction(result.data);
      res.status(201).json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to create bank transaction" });
    }
  });

  // Currency Settlements
  app.get("/api/currency-settlements", requireOwner, async (req, res) => {
    try {
      const settlements = await storage.getAllCurrencySettlements();
      res.json(settlements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch currency settlements" });
    }
  });

  app.post("/api/currency-settlements", requireOwner, async (req, res) => {
    try {
      const result = insertCurrencySettlementSchema.safeParse({
        ...req.body,
        createdByUserId: req.user!.id,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid settlement data", errors: result.error.errors });
      }
      const settlement = await storage.createCurrencySettlement(result.data);
      res.status(201).json(settlement);
    } catch (error) {
      res.status(500).json({ message: "Failed to create currency settlement" });
    }
  });

  // Warehouses
  app.get("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const warehouses = await storage.getAllWarehouses();
      res.json(warehouses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  app.post("/api/warehouses", requireOwner, async (req, res) => {
    try {
      const result = insertWarehouseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid warehouse data", errors: result.error.errors });
      }
      const warehouse = await storage.createWarehouse(result.data);
      res.status(201).json(warehouse);
    } catch (error) {
      res.status(500).json({ message: "Failed to create warehouse" });
    }
  });

  app.patch("/api/warehouses/:id", requireOwner, async (req, res) => {
    try {
      const warehouse = await storage.updateWarehouse(req.params.id, req.body);
      if (!warehouse) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      res.json(warehouse);
    } catch (error) {
      res.status(500).json({ message: "Failed to update warehouse" });
    }
  });

  app.delete("/api/warehouses/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteWarehouse(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Warehouse not found" });
      }
      res.json({ message: "Warehouse deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete warehouse" });
    }
  });

  // Warehouse Stock
  app.get("/api/warehouses/:warehouseId/stock", requireAuth, async (req, res) => {
    try {
      const stock = await storage.getWarehouseStock(req.params.warehouseId);
      res.json(stock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch warehouse stock" });
    }
  });

  app.post("/api/warehouses/:warehouseId/stock", requireOwner, async (req, res) => {
    try {
      const result = insertWarehouseStockSchema.safeParse({
        ...req.body,
        warehouseId: req.params.warehouseId,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid stock data", errors: result.error.errors });
      }
      const stockItem = await storage.addWarehouseStock(result.data);
      res.status(201).json(stockItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to add warehouse stock" });
    }
  });

  app.patch("/api/warehouse-stock/:id", requireOwner, async (req, res) => {
    try {
      const stockItem = await storage.updateWarehouseStock(req.params.id, req.body);
      if (!stockItem) {
        return res.status(404).json({ message: "Stock item not found" });
      }
      res.json(stockItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update stock item" });
    }
  });

  // Suppliers
  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", requireOwner, async (req, res) => {
    try {
      const result = insertSupplierSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid supplier data", errors: result.error.errors });
      }
      const supplier = await storage.createSupplier(result.data);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  app.patch("/api/suppliers/:id", requireOwner, async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(req.params.id, req.body);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireOwner, async (req, res) => {
    try {
      const success = await storage.deleteSupplier(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // Receipts
  app.get("/api/receipts", requireAuth, async (req, res) => {
    try {
      const receipts = await storage.getAllReceipts();
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.post("/api/receipts", requireOwner, async (req, res) => {
    try {
      const result = insertReceiptSchema.safeParse({
        ...req.body,
        createdByUserId: req.user!.id,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid receipt data", errors: result.error.errors });
      }
      const receipt = await storage.createReceipt(result.data);
      res.status(201).json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create receipt" });
    }
  });

  app.get("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipt" });
    }
  });

  // Accounting Entries
  app.get("/api/accounting-entries", requireOwner, async (req, res) => {
    try {
      const entries = await storage.getAllAccountingEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch accounting entries" });
    }
  });

  app.post("/api/accounting-entries", requireOwner, async (req, res) => {
    try {
      const result = insertAccountingEntrySchema.safeParse({
        ...req.body,
        createdByUserId: req.user!.id,
      });
      if (!result.success) {
        return res.status(400).json({ message: "Invalid accounting entry data", errors: result.error.errors });
      }
      const entry = await storage.createAccountingEntry(result.data);
      res.status(201).json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to create accounting entry" });
    }
  });

  // Main Office Account
  app.get("/api/main-office-account", requireOwner, async (req, res) => {
    try {
      const account = await storage.getMainOfficeAccount();
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch main office account" });
    }
  });

  app.patch("/api/main-office-account", requireOwner, async (req, res) => {
    try {
      const account = await storage.updateMainOfficeAccount(req.body);
      res.json(account);
    } catch (error) {
      res.status(500).json({ message: "Failed to update main office account" });
    }
  });

  // Financial Summary for Dashboard
  app.get("/api/financial-summary", requireOwner, async (req, res) => {
    try {
      const summary = await storage.getFinancialSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  // Sales Invoices
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const { customerName, branch, items } = req.body;
      
      if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
        return res.status(400).json({ message: "Customer name is required" });
      }
      
      if (!branch || (branch !== 'ALFANI1' && branch !== 'ALFANI2')) {
        return res.status(400).json({ message: "Invalid branch" });
      }
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one item is required" });
      }
      
      for (const item of items) {
        if (!item.productId || !item.productName || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res.status(400).json({ message: "Invalid item data" });
        }
        if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
          return res.status(400).json({ message: "Invalid unit price" });
        }
      }
      
      const stockCheck = await storage.checkInvoiceStock(branch, items);
      if (!stockCheck.success) {
        return res.status(400).json({ message: stockCheck.message });
      }
      
      const invoiceNumber = await storage.generateInvoiceNumber();
      
      const itemsData = items.map((item: any) => {
        const lineTotal = item.quantity * item.unitPrice;
        return {
          invoiceId: "",
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          lineTotal: String(lineTotal),
        };
      });
      
      const totalAmount = itemsData.reduce((sum: number, item: any) => sum + parseFloat(item.lineTotal), 0);
      
      const invoiceData = {
        invoiceNumber,
        customerName: customerName.trim(),
        branch,
        totalAmount: String(totalAmount),
      };
      
      const invoice = await storage.createInvoice(invoiceData, itemsData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Failed to create invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
