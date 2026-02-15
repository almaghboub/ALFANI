import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!roles.includes(req.user!.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner"])(req, res, next);
}

export function requireOperational(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "customer_service", "receptionist"])(req, res, next);
}

export function requireInventoryAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "stock_manager", "sorter"])(req, res, next);
}

export function requireDeliveryManager(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "customer_service", "receptionist"])(req, res, next);
}

export function requireShippingStaff(req: Request, res: Response, next: NextFunction) {
  return requireRole(["shipping_staff"])(req, res, next);
}

export function requireDeliveryAccess(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "customer_service", "receptionist", "shipping_staff"])(req, res, next);
}

export function requireProductManagement(req: Request, res: Response, next: NextFunction) {
  return requireRole(["owner", "stock_manager"])(req, res, next);
}
