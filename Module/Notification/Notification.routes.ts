import { Router } from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "./Notification.controller";
import { authenticateToken } from "../../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get notifications (unread only by default, use ?unreadOnly=false for all)
router.get("/", getNotifications);

// Mark notification as read
router.put("/:notificationId/read", markAsRead);

// Mark all notifications as read
router.put("/read-all", markAllAsRead);

export default router;
