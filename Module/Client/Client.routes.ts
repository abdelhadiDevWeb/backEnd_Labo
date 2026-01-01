import { Router } from "express";
import { 
  register, 
  login, 
  getProfile, 
  updateProfile, 
  updatePassword, 
  getDevices,
  getUserRole
} from "./Client.controller";
import { authenticateToken } from "../../middleware/auth.middleware";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes (require authentication)
router.get("/profile", authenticateToken, getProfile);
router.put("/profile", authenticateToken, updateProfile);
router.put("/password", authenticateToken, updatePassword);
router.get("/devices", authenticateToken, getDevices);
router.get("/role", authenticateToken, getUserRole);

export default router;

