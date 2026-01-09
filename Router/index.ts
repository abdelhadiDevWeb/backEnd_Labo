import { Router } from "express";
import type { Request, Response } from "express";
import clientRoutes from "../Module/Client/Client.routes";
import supplierRoutes from "../Module/Supplier/Supplier.routes";
import productRoutes from "../Module/Product/Product.routes";
import commandeRoutes from "../Module/Commande/Commande.routes";
import notificationRoutes from "../Module/Notification/Notification.routes";

const router = Router();

// Health check endpoint
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Client routes
router.use("/client", clientRoutes);

// Supplier routes
router.use("/supplier", supplierRoutes);

// Product routes
router.use("/products", productRoutes);

// Commande routes
router.use("/commandes", commandeRoutes);

// Notification routes
router.use("/notifications", notificationRoutes);

export default router;

