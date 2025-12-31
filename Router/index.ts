import { Router } from "express";
import type { Request, Response } from "express";
import clientRoutes from "../Module/Client/Client.routes";

const router = Router();

// Health check endpoint
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Client routes
router.use("/client", clientRoutes);

export default router;

