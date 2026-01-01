import { Router } from "express";
import multer from "multer";
import path from "path";
import { registerSupplier, uploadDocuments, getDocuments } from "./Supplier.controller";
import { authenticateToken } from "../../middleware/auth.middleware";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/documents/");
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "anonymous";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Public routes
router.post("/register", registerSupplier);

// Protected routes (require authentication)
router.post(
  "/documents",
  authenticateToken,
  upload.fields([
    { name: "Tax_number", maxCount: 1 },
    { name: "identity", maxCount: 1 },
    { name: "commercial_register", maxCount: 1 },
  ]),
  uploadDocuments
);

router.get("/documents", authenticateToken, getDocuments);

export default router;

