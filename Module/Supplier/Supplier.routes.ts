import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  registerSupplier,
  uploadDocuments,
  getDocuments,
  updateProfile,
  updatePassword,
  uploadProfileImage,
  getProfileImage,
} from "./Supplier.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requireSupplier } from "../../middleware/role.middleware";
import {
  sanitizeBody,
  validateUpdateProfile,
  validateUpdatePassword,
} from "../../middleware/validation.middleware";
import {
  validateUploadedFiles,
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
} from "../../middleware/fileSecurity.middleware";
import {
  authRateLimiter,
  passwordUpdateRateLimiter,
  fileUploadRateLimiter,
  profileUpdateRateLimiter,
} from "../../middleware/rateLimit.middleware";

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

// Configure multer for profile image uploads
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile/");
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "anonymous";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-profile-${uniqueSuffix}${ext}`);
  },
});

const profileImageFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const uploadProfileImageMulter = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: profileImageFilter,
});

// Public routes
router.post("/register", authRateLimiter, sanitizeBody, registerSupplier);

// Protected routes (require authentication)
router.post(
  "/documents",
  authenticateToken,
  fileUploadRateLimiter,
  upload.fields([
    { name: "Tax_number", maxCount: 1 },
    { name: "identity", maxCount: 1 },
    { name: "commercial_register", maxCount: 1 },
  ]),
  validateUploadedFiles(ALLOWED_DOCUMENT_EXTENSIONS, 3),
  uploadDocuments
);

router.get("/documents", authenticateToken, getDocuments);

// Profile management routes (require authentication and supplier role)
router.use(authenticateToken);
router.use(requireSupplier);

// Update profile (without password)
router.put(
  "/profile",
  profileUpdateRateLimiter,
  sanitizeBody,
  validateUpdateProfile,
  updateProfile
);

// Update password
router.put(
  "/password",
  passwordUpdateRateLimiter,
  sanitizeBody,
  validateUpdatePassword,
  updatePassword
);

// Upload profile image
router.post(
  "/profile-image",
  fileUploadRateLimiter,
  uploadProfileImageMulter.single("image"),
  validateUploadedFiles(ALLOWED_IMAGE_EXTENSIONS, 1),
  uploadProfileImage
);

// Get profile image
router.get("/profile-image", getProfileImage);

export default router;

