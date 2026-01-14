import { Router } from "express";
import multer from "multer";
import path from "path";
import { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  updatePassword, 
  getDevices,
  getUserRole,
  uploadClientDocuments,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  refreshToken,
  createProblem,
} from "./Client.controller";
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
router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", requestPasswordReset);
router.post("/verify-reset-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);
router.post("/support", createProblem);

// Protected routes (require authentication)
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/password", authenticateToken, updatePassword);
router.get("/devices", authenticateToken, getDevices);
router.get("/role", authenticateToken, getUserRole);
// Client can only upload identity document
router.post(
  "/documents",
  authenticateToken,
  upload.fields([
    { name: "identity", maxCount: 1 },
  ]),
  uploadClientDocuments
);

export default router;

