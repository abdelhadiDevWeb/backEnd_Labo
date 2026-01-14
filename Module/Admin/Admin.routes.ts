import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getAdminStatistics,
  getDetailedAdminStatistics,
  getAllOrders,
  getAllUsers,
  updateUserStatus,
  getAdminProfile,
  updateAdminProfile,
  updateAdminPassword,
  uploadAdminProfileImage,
  getAdminProfileImage,
  getAllAdmins,
  createAdmin,
  updateAdminStatus,
  getUsersForSubscription,
  createSubscription,
  getAllSubscriptions,
  updateSubscription,
  getUserPapers,
  getUserDocuments,
  getAllProblems,
  markProblemAsRead,
} from "./Admin.controller";
import { authenticateToken } from "../../middleware/auth.middleware";

const router = Router();

// Ensure uploads/profile-images directory exists
const profileImagesDir = "uploads/profile-images";
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Configure multer for profile image uploads
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists
    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
    }
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    // userId will be available after authentication middleware runs
    // We'll use a temporary name and update it in the controller if needed
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-profile-${uniqueSuffix}${ext}`);
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

// All admin routes require authentication
router.get("/statistics", authenticateToken, getAdminStatistics);
router.get("/statistics/detailed", authenticateToken, getDetailedAdminStatistics);
router.get("/orders", authenticateToken, getAllOrders);
router.get("/users", authenticateToken, getAllUsers);
router.put("/users/:userId/status", authenticateToken, updateUserStatus);

// Admin management routes
router.get("/admins", authenticateToken, getAllAdmins);
router.post("/admins", authenticateToken, createAdmin);
router.put("/admins/:adminId/status", authenticateToken, updateAdminStatus);

// Subscription routes
router.get("/subscriptions/users", authenticateToken, getUsersForSubscription);
router.post("/subscriptions", authenticateToken, createSubscription);
router.get("/subscriptions", authenticateToken, getAllSubscriptions);
router.put("/subscriptions/:subscriptionId", authenticateToken, updateSubscription);
router.get("/subscriptions/users/:userId/papers", authenticateToken, getUserPapers);
router.get("/subscriptions/users/:userId/documents", authenticateToken, getUserDocuments);

// Admin profile routes
router.get("/profile", authenticateToken, getAdminProfile);
router.put("/profile", authenticateToken, updateAdminProfile);
router.put("/password", authenticateToken, updateAdminPassword);
router.post(
  "/profile-image",
  authenticateToken,
  uploadProfileImageMulter.single("image"),
  uploadAdminProfileImage
);
router.get("/profile-image", authenticateToken, getAdminProfileImage);

// Problem routes
router.get("/problems", authenticateToken, getAllProblems);
router.put("/problems/:problemId/read", authenticateToken, markProblemAsRead);

export default router;
