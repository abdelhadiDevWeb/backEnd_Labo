import { Router } from "express";
import multer from "multer";
import {
  createPayment,
  getPaymentByCommande,
  getUserPayments,
} from "./Payment.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireClient } from "../../middleware/role.middleware";
import {
  validateUploadedFiles,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from "../../middleware/fileSecurity.middleware";
import { fileUploadRateLimiter } from "../../middleware/rateLimit.middleware";
import path from "path";
import fs from "fs";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Ensure uploads/payments directory exists
const paymentsDir = "uploads/payments";
if (!fs.existsSync(paymentsDir)) {
  fs.mkdirSync(paymentsDir, { recursive: true });
}

// Configure multer for payment image uploads
const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentsDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000000);
    const ext = path.extname(file.originalname);
    const filename = `${userId}-payment-${timestamp}-${random}${ext}`;
    cb(null, filename);
  },
});

const paymentFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only allow PDF files for payment proof
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed for payment proof"));
  }
};

const uploadPaymentMulter = multer({
  storage: paymentStorage,
  fileFilter: paymentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Create payment (clients only)
router.post(
  "/",
  requireClient,
  fileUploadRateLimiter,
  uploadPaymentMulter.single("image"),
  validateUploadedFiles(ALLOWED_DOCUMENT_EXTENSIONS, 1),
  createPayment
);

// Get payment by commande ID
router.get("/commande/:commandeId", getPaymentByCommande);

// Get all payments for current user (clients only)
router.get("/user", requireClient, getUserPayments);

export default router;
