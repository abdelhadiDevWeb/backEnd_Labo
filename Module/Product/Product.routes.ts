import { Router, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import jwt from "jsonwebtoken";
import {
  createProduct,
  uploadProductsFromExcel,
  getSupplierProducts,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "./Product.controller";
import { authenticateToken, AuthRequest } from "../../middleware/auth.middleware";
import { requireSupplier } from "../../middleware/role.middleware";
import { AppConfig } from "../../config/app.config";
import {
  sanitizeBody,
  validateCreateProduct,
} from "../../middleware/validation.middleware";
import {
  validateUploadedFiles,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_EXCEL_EXTENSIONS,
} from "../../middleware/fileSecurity.middleware";
import {
  fileUploadRateLimiter,
  productCreationRateLimiter,
} from "../../middleware/rateLimit.middleware";

const router = Router();

// Configure multer for Excel file uploads
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/excel/");
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "anonymous";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-products-${uniqueSuffix}${ext}`);
  },
});

const excelFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.originalname.match(/\.(xlsx|xls)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
  }
};

const uploadExcel = multer({
  storage: excelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: excelFileFilter,
});

// Configure multer for product images and video
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "images") {
      cb(null, "uploads/products/images/");
    } else if (file.fieldname === "video") {
      cb(null, "uploads/products/videos/");
    } else {
      cb(null, "uploads/products/");
    }
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "anonymous";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fieldName = file.fieldname === "images" ? "img" : "vid";
    cb(null, `${userId}-${fieldName}-${uniqueSuffix}${ext}`);
  },
});

const productFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === "images") {
    // Allow images
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for images field"));
    }
  } else if (file.fieldname === "video") {
    // Allow videos
    const allowedVideoTypes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"];
    if (allowedVideoTypes.includes(file.mimetype) || file.originalname.match(/\.(mp4|mov|avi)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files (mp4, mov, avi) are allowed"));
    }
  } else {
    cb(new Error("Invalid field name"));
  }
};

const uploadProduct = multer({
  storage: productStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for images and videos
  },
  fileFilter: productFileFilter,
});

// Optional authentication middleware - authenticates if token exists, but doesn't fail if no token
const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  
  if (token) {
    // Try to authenticate, but don't fail if token is invalid
    try {
      const decoded = jwt.verify(token, AppConfig.JwtSecret);
      
      if (decoded && typeof decoded === "object" && "id" in decoded) {
        req.userId = decoded.id as string;
        req.userEmail = decoded.email as string;
        req.userRole = decoded.role as string;
        req.userLaboType = decoded.laboType as string | undefined;
      }
    } catch (err) {
      // Token is invalid, but continue without authentication
      // This allows public access
    }
  }
  next();
};

// Public routes (optional authentication - will filter by laboType if client is logged in)
// Get all products (for clients)
router.get("/public", optionalAuth, getAllProducts);

// Get single product by ID (for clients)
router.get("/public/:id", optionalAuth, getProductById);

// Protected routes (require authentication and supplier role)
router.use(authenticateToken);
router.use(requireSupplier);

// Create a single product (with images and video)
router.post(
  "/",
  productCreationRateLimiter,
  uploadProduct.fields([
    { name: "images", maxCount: 10 }, // Allow up to 10 images
    { name: "video", maxCount: 1 }, // Allow only 1 video
  ]),
  sanitizeBody,
  validateCreateProduct,
  validateUploadedFiles([...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS], 11),
  createProduct
);

// Upload products from Excel
router.post(
  "/upload-excel",
  fileUploadRateLimiter,
  uploadExcel.single("excelFile"),
  validateUploadedFiles(ALLOWED_EXCEL_EXTENSIONS, 1),
  uploadProductsFromExcel
);

// Get all products for the authenticated supplier
router.get("/", getSupplierProducts);

// Update a product
router.put(
  "/:id",
  productCreationRateLimiter,
  uploadProduct.fields([
    { name: "images", maxCount: 10 },
    { name: "video", maxCount: 1 },
  ]),
  sanitizeBody,
  validateCreateProduct,
  validateUploadedFiles([...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS], 11),
  updateProduct
);

// Delete a product
router.delete("/:id", deleteProduct);

export default router;

