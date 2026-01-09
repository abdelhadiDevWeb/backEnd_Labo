import { Router } from "express";
import {
  createOrder,
  getClientOrders,
  getSupplierOrders,
  updateOrderStatus,
} from "./Commande.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireClient } from "../../middleware/role.middleware";
import { requireSupplier } from "../../middleware/role.middleware";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create order (clients only)
router.post("/", requireClient, createOrder);

// Get client orders
router.get("/client", requireClient, getClientOrders);

// Get supplier orders
router.get("/supplier", requireSupplier, getSupplierOrders);

// Update order status (suppliers only)
router.put("/:orderId/status", requireSupplier, updateOrderStatus);

export default router;

