import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// Health check endpoint
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Placeholder for future routes
// Example: router.use("/users", userRoutes);

export default router;

